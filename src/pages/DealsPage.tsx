import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useCompanyId } from '../contexts/CompanyContext';
import { usePipelines, usePipelineStages, useDeals, useTrashedDeals } from '../hooks/useDeals';
import { useConversationMetaMap } from '../hooks/useConversationMetaMap';
import type { Deal, DealsPipelineStage } from '../types/deals';
import {
  createDeal,
  moveDealToStage,
  softDeleteDeal,
  updateDeal
} from '../lib/firebase/deals';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DealSidebar, type ManagerOption } from '../components/deals/DealSidebar';
import {
  Plus,
  Settings2,
  X,
  MoreVertical,
  Pencil,
  Archive,
  Trash2,
  Filter,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Trash2 as TrashIcon,
  MessageCircle,
  User,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

const DEAL_CARD_HEIGHT = 212;
const SOURCES = ['Все', 'WhatsApp', 'Звонок', 'Сайт', 'Ручной', 'Другое'];
const MS_DAY = 86400000;

function dealTime(d: Deal['createdAt']): number {
  if (!d) return 0;
  if (typeof (d as { toMillis?: () => number }).toMillis === 'function') {
    return (d as { toMillis: () => number }).toMillis();
  }
  if (typeof d === 'object' && d !== null && 'seconds' in (d as object)) {
    return ((d as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(d as string).getTime();
}

function lastActivityMs(deal: Deal): number {
  const u = deal.updatedAt ? dealTime(deal.updatedAt) : 0;
  const s = deal.stageChangedAt ? dealTime(deal.stageChangedAt) : 0;
  const c = deal.createdAt ? dealTime(deal.createdAt) : 0;
  return Math.max(u, s, c) || Date.now();
}

function formatLastActivity(deal: Deal): string {
  const ms = lastActivityMs(deal);
  return new Date(ms).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function daysSinceActivity(deal: Deal): number {
  return Math.floor((Date.now() - lastActivityMs(deal)) / MS_DAY);
}

function nextActionMs(deal: Deal): number | null {
  if (!deal.nextActionAt) return null;
  return dealTime(deal.nextActionAt);
}

function isStageOpen(deal: Deal, stages: DealsPipelineStage[]): boolean {
  const t = stages.find((s) => s.id === deal.stageId)?.type;
  return t === 'open' || t === undefined;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function isNewLeadToday(deal: Deal): boolean {
  const c = deal.createdAt ? dealTime(deal.createdAt) : 0;
  return c >= startOfToday() && c <= endOfToday();
}

function dealWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'сделок';
  if (m10 === 1) return 'сделка';
  if (m10 >= 2 && m10 <= 4) return 'сделки';
  return 'сделок';
}

export const DealsPage: React.FC = () => {
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get('deal');
  const [sidebarDeal, setSidebarDeal] = useState<Deal | null>(null);
  const { pipelines, loading: loadingPipelines, error: pipelinesError } = usePipelines(companyId);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const effectivePipelineId =
    selectedPipelineId ?? (pipelines.length > 0 ? pipelines[0].id : null);
  const { stages, loading: loadingStages } = usePipelineStages(companyId, effectivePipelineId);
  const { deals: rawDeals, loading: loadingDeals } = useDeals(companyId, effectivePipelineId);
  const { deals: trashedDeals } = useTrashedDeals(companyId);
  const convMetaMap = useConversationMetaMap(companyId);

  const trashCount = trashedDeals.length;

  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [menuDealId, setMenuDealId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterManager, setFilterManager] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('Все');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterStaleHours, setFilterStaleHours] = useState<string>(''); // 24 | 72 | 168 | ''
  const [filterTag, setFilterTag] = useState('');
  const [quickChip, setQuickChip] = useState<string | null>(null);

  const [createModal, setCreateModal] = useState<{ stage: DealsPipelineStage } | null>(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    clientName: '',
    phone: '',
    amount: '',
    responsibleUserId: '',
    source: 'Ручной'
  });

  useEffect(() => {
    if (!companyId) {
      setManagers([]);
      return;
    }
    const q = query(collection(db, 'chatManagers'), where('companyId', '==', companyId));
    return onSnapshot(q, (snap) => {
      setManagers(
        snap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, name: (x.name as string) ?? '', color: x.color as string | undefined };
        })
      );
    });
  }, [companyId]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuDealId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const activeDealsAll = useMemo(
    () => rawDeals.filter((d) => !d.isArchived),
    [rawDeals]
  );

  const summary = useMemo(() => {
    const active = activeDealsAll;
    const totalDeals = active.length;
    const totalAmount = active.reduce((s, d) => s + (d.amount ?? 0), 0);
    const noManager = active.filter((d) => !d.responsibleUserId).length;
    const stale3 = active.filter((d) => daysSinceActivity(d) > 3).length;
    const newToday = active.filter(isNewLeadToday).length;
    const now = Date.now();
    const overdue = active.filter((d) => {
      if (!isStageOpen(d, stages)) return false;
      const na = nextActionMs(d);
      return na != null && na < now;
    }).length;
    const todayTouch = active.filter((d) => {
      if (!isStageOpen(d, stages)) return false;
      const na = nextActionMs(d);
      return na != null && na >= startOfToday() && na <= endOfToday();
    }).length;
    const stale24h = active.filter((d) => now - lastActivityMs(d) > 86400000).length;
    return {
      totalDeals,
      totalAmount,
      trashCount,
      noManager,
      stale3,
      newToday,
      overdue,
      todayTouch,
      stale24h
    };
  }, [activeDealsAll, trashCount, stages]);

  const deals = useMemo(() => {
    let list = activeDealsAll;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.clientNameSnapshot ?? '').toLowerCase().includes(q) ||
          (d.clientPhoneSnapshot ?? '').includes(q)
      );
    }
    if (quickChip === 'no_manager') {
      list = list.filter((d) => !d.responsibleUserId);
    } else if (quickChip === 'overdue') {
      const now = Date.now();
      list = list.filter((d) => {
        if (!isStageOpen(d, stages)) return false;
        const na = nextActionMs(d);
        return na != null && na < now;
      });
    } else if (quickChip === 'today') {
      list = list.filter((d) => {
        if (!isStageOpen(d, stages)) return false;
        const na = nextActionMs(d);
        return na != null && na >= startOfToday() && na <= endOfToday();
      });
    } else if (quickChip === 'new_leads') {
      list = list.filter(isNewLeadToday);
    }
    if (filterManager === 'none') {
      list = list.filter((d) => !d.responsibleUserId);
    } else if (filterManager !== 'all') {
      list = list.filter((d) => d.responsibleUserId === filterManager);
    }
    if (filterSource !== 'Все') {
      list = list.filter((d) => (d.source ?? 'Ручной') === filterSource);
    }
    if (filterStage !== 'all') {
      list = list.filter((d) => d.stageId === filterStage);
    }
    if (filterPriority !== 'all') {
      list = list.filter((d) => (d.priority || 'medium') === filterPriority);
    }
    if (filterOverdue) {
      const now = Date.now();
      list = list.filter((d) => {
        if (!isStageOpen(d, stages)) return false;
        const na = nextActionMs(d);
        return na != null && na < now;
      });
    }
    if (filterStaleHours) {
      const h = Number(filterStaleHours);
      const ms = h * 3600000;
      const now = Date.now();
      list = list.filter((d) => now - lastActivityMs(d) > ms);
    }
    if (filterTag.trim()) {
      const t = filterTag.trim().toLowerCase();
      list = list.filter((d) => (d.tags ?? []).some((x) => x.toLowerCase().includes(t)));
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((d) => dealTime(d.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + MS_DAY;
      list = list.filter((d) => dealTime(d.createdAt) <= to);
    }
    const min = amountMin.trim() ? Number(amountMin.replace(/\s/g, '')) : NaN;
    const max = amountMax.trim() ? Number(amountMax.replace(/\s/g, '')) : NaN;
    if (!Number.isNaN(min)) list = list.filter((d) => (d.amount ?? 0) >= min);
    if (!Number.isNaN(max)) list = list.filter((d) => (d.amount ?? 0) <= max);
    return list;
  }, [
    activeDealsAll,
    searchQuery,
    filterManager,
    filterSource,
    filterStage,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    filterPriority,
    filterOverdue,
    filterStaleHours,
    filterTag,
    quickChip,
    stages
  ]);

  const groupedDeals = useMemo(() => {
    const byStage: Record<string, Deal[]> = {};
    for (const stage of stages) byStage[stage.id] = [];
    for (const deal of deals) {
      if (!byStage[deal.stageId]) byStage[deal.stageId] = [];
      byStage[deal.stageId].push(deal);
    }
    Object.values(byStage).forEach((list) =>
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
    return byStage;
  }, [stages, deals]);

  const handleCreateInStage = async () => {
    if (!createModal || !companyId || !effectivePipelineId) return;
    const title = createForm.title.trim() || 'Новая сделка';
    const mgr = managers.find((m) => m.id === createForm.responsibleUserId);
    setCreating(true);
    try {
      await createDeal(companyId, effectivePipelineId, createModal.stage.id, {
        title,
        clientNameSnapshot: createForm.clientName.trim() || undefined,
        clientPhoneSnapshot: createForm.phone.trim() || undefined,
        amount: createForm.amount.trim() ? Number(createForm.amount.replace(/\s/g, '')) : undefined,
        responsibleUserId: createForm.responsibleUserId || null,
        responsibleNameSnapshot: mgr?.name ?? null,
        source: createForm.source
      });
      setCreateModal(null);
      setCreateForm({
        title: '',
        clientName: '',
        phone: '',
        amount: '',
        responsibleUserId: '',
        source: 'Ручной'
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCardDrop = async (deal: Deal, targetStageId: string, targetIndex: number) => {
    try {
      const stage = stages.find((s) => s.id === targetStageId);
      await moveDealToStage(deal.companyId, deal.id, targetStageId, Date.now() + targetIndex, {
        name: stage?.name ?? 'Этап',
        color: stage?.color ?? null
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[Deals] stage move failed:', err);
    }
  };

  const openSidebar = useCallback(
    (deal: Deal) => {
      setMenuDealId(null);
      setSidebarDeal(deal);
      setSearchParams({ deal: deal.id }, { replace: true });
    },
    [setSearchParams]
  );

  const closeSidebar = () => {
    setSidebarDeal(null);
    searchParams.delete('deal');
    setSearchParams(searchParams, { replace: true });
  };

  useEffect(() => {
    if (!dealIdFromUrl) {
      setSidebarDeal(null);
      return;
    }
    const d = deals.find((x) => x.id === dealIdFromUrl) ?? rawDeals.find((x) => x.id === dealIdFromUrl);
    if (d) setSidebarDeal(d);
  }, [dealIdFromUrl, deals, rawDeals]);

  const handleEditTitle = async (deal: Deal) => {
    setMenuDealId(null);
    const t = window.prompt('Название сделки', deal.title);
    if (t == null || !t.trim()) return;
    await updateDeal(deal.id, { title: t.trim() });
  };

  const handleArchive = async (deal: Deal) => {
    setMenuDealId(null);
    await updateDeal(deal.id, { isArchived: true });
  };

  const confirmSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await softDeleteDeal(deleteTarget.id, companyId);
      if (sidebarDeal?.id === deleteTarget.id) closeSidebar();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const onSidebarMove = async (stageId: string) => {
    if (!sidebarDeal) return;
    const stage = stages.find((s) => s.id === stageId);
    await moveDealToStage(companyId!, sidebarDeal.id, stageId, Date.now(), {
      name: stage?.name ?? '',
      color: stage?.color ?? null
    });
  };

  const moveToNextStage = async (deal: Deal) => {
    setMenuDealId(null);
    const idx = stages.findIndex((s) => s.id === deal.stageId);
    if (idx < 0 || idx >= stages.length - 1) return;
    const next = stages[idx + 1];
    await handleCardDrop(deal, next.id, groupedDeals[next.id]?.length ?? 0);
  };

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Компания не привязана.</p>
      </div>
    );
  }

  const loading = loadingPipelines || loadingStages || loadingDeals;

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <header className="flex-none bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Сделки</h1>
          <nav className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
            <Link
              to="/deals"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white text-slate-900 shadow-sm"
            >
              <LayoutGrid className="w-4 h-4 opacity-80" />
              Воронка
            </Link>
            <Link
              to="/deals/trash"
              title={trashCount > 0 ? `В корзине: ${trashCount} ${dealWord(trashCount)}` : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                trashCount > 0
                  ? 'text-slate-800 hover:bg-white/90 bg-slate-100/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <TrashIcon className={`w-4 h-4 ${trashCount > 0 ? 'text-red-500' : 'opacity-70'}`} />
              Корзина
              {trashCount > 0 && (
                <span
                  className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold leading-none tabular-nums"
                  title={`В корзине: ${trashCount} ${dealWord(trashCount)}`}
                >
                  {trashCount > 99 ? '99+' : trashCount}
                </span>
              )}
            </Link>
          </nav>
          <select
            value={effectivePipelineId ?? ''}
            onChange={(e) => setSelectedPipelineId(e.target.value || null)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-800"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            <Settings2 className="w-4 h-4" />
            Воронка
          </button>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              placeholder="Поиск…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-44 md:w-56 bg-white"
            />
            <button
              type="button"
              disabled={creating || stages.length === 0}
              onClick={() => stages[0] && setCreateModal({ stage: stages[0] })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Новая сделка
            </button>
          </div>
        </div>

        <div className="px-4 pb-2 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: null, label: 'Все' },
                { id: 'overdue' as const, label: 'Просрочено', tone: 'red' },
                { id: 'no_manager' as const, label: 'Без менеджера', tone: 'slate' },
                { id: 'today' as const, label: 'Сегодня связаться', tone: 'amber' },
                { id: 'new_leads' as const, label: 'Новые лиды', tone: 'emerald' }
              ].map((c) => (
                <button
                  key={c.id ?? 'all'}
                  type="button"
                  onClick={() => setQuickChip(c.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                    quickChip === c.id
                      ? c.tone === 'red'
                        ? 'bg-red-600 text-white border-red-600'
                        : c.tone === 'amber'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : c.tone === 'emerald'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  } ${!c.id && quickChip === null ? 'ring-2 ring-slate-300' : ''}`}
                >
                  {c.label}
                </button>
              ))}
              <Link
                to="/deals/trash"
                className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
              >
                Корзина ({summary.trashCount})
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-2.5 text-[11px] sm:text-xs">
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-white border border-slate-100 shadow-sm">
                <span className="text-slate-500 font-semibold">Всего</span>
                <span className="font-bold text-slate-900 tabular-nums">{summary.totalDeals}</span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-white border border-slate-100 shadow-sm">
                <span className="text-slate-500 font-semibold">Сумма</span>
                <span className="font-bold text-emerald-700 tabular-nums">
                  {summary.totalAmount.toLocaleString('ru-RU')} ₸
                </span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-emerald-800 font-semibold">Новые сегодня</span>
                <span className="font-bold text-emerald-900 tabular-nums">{summary.newToday}</span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-red-50 border border-red-100">
                <span className="text-red-800 font-semibold">Просрочено</span>
                <span className="font-bold text-red-700 tabular-nums">{summary.overdue}</span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-amber-900 font-semibold">Касание сегодня</span>
                <span className="font-bold tabular-nums">{summary.todayTouch}</span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                <span className="text-slate-600 font-semibold">Без менедж.</span>
                <span className="font-bold tabular-nums">{summary.noManager}</span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
                <span className="text-slate-600 font-semibold">&gt;24ч без акт.</span>
                <span className="font-bold tabular-nums">{summary.stale24h}</span>
              </div>
              <div className="flex items-baseline gap-1 px-2 py-1 rounded-lg bg-white border border-slate-100">
                <span className="text-slate-500 font-semibold">Корзина</span>
                <span className="font-bold text-red-600 tabular-nums">{summary.trashCount}</span>
              </div>
            </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full px-4 py-2 flex items-center justify-between text-left text-sm font-medium text-slate-700 hover:bg-slate-100/80"
          >
            <span className="inline-flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              Фильтры
            </span>
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {filtersOpen && (
            <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Этап</label>
                <select
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                >
                  <option value="all">Все этапы</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Ответственный</label>
                <select
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={filterManager}
                  onChange={(e) => setFilterManager(e.target.value)}
                >
                  <option value="all">Все</option>
                  <option value="none">Без ответственного</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Источник</label>
                <select
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Дата с</label>
                <input
                  type="date"
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Дата по</label>
                <input
                  type="date"
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-semibold">Сумма от</label>
                  <input
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                    placeholder="₸"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-semibold">до</label>
                  <input
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                    placeholder="₸"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Приоритет</label>
                <select
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <option value="all">Все</option>
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterOverdue}
                    onChange={(e) => setFilterOverdue(e.target.checked)}
                  />
                  <span className="text-slate-700 font-medium">Просрочен next step</span>
                </label>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Без активности</label>
                <select
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={filterStaleHours}
                  onChange={(e) => setFilterStaleHours(e.target.value)}
                >
                  <option value="">Не фильтровать</option>
                  <option value="24">&gt; 24 ч</option>
                  <option value="72">&gt; 3 дн.</option>
                  <option value="168">&gt; 7 дн.</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Тег</label>
                <input
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
                  placeholder="горячий, КП…"
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        )}
        {!loading && pipelinesError && (
          <div className="p-4 text-sm text-red-600">{pipelinesError}</div>
        )}
        {!loading && !pipelinesError && stages.length === 0 && (
          <div className="p-4 text-sm text-slate-500">Нет этапов воронки.</div>
        )}
        {!loading && !pipelinesError && stages.length > 0 && (
          <div className="h-full overflow-x-auto overflow-y-hidden flex gap-3 p-3 pb-4 bg-slate-100/50">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                items={groupedDeals[stage.id] ?? []}
                allDeals={deals}
                stages={stages}
                convMetaMap={convMetaMap}
                onCardDrop={handleCardDrop}
                onOpenDeal={openSidebar}
                menuDealId={menuDealId}
                setMenuDealId={setMenuDealId}
                menuRef={menuRef}
                onEditTitle={handleEditTitle}
                onArchive={handleArchive}
                onDelete={(d) => setDeleteTarget(d)}
                onNewDeal={() => setCreateModal({ stage })}
                onMoveNext={moveToNextStage}
                onOpenChat={(d) => {
                  setMenuDealId(null);
                  if (d.whatsappConversationId)
                    navigate(`/whatsapp?chatId=${encodeURIComponent(d.whatsappConversationId)}`);
                }}
                onOpenClient={(d) => {
                  setMenuDealId(null);
                  if (d.clientId) navigate(`/clients`, { state: { focusClientId: d.clientId } });
                  else navigate('/clients');
                }}
              />
            ))}
          </div>
        )}
      </div>

      {createModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900">
              Новая сделка — {createModal.stage.name}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="text-xs font-medium text-slate-500">Название</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Дом 120м²"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              />
              <label className="text-xs font-medium text-slate-500">Клиент</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={createForm.clientName}
                onChange={(e) => setCreateForm((f) => ({ ...f, clientName: e.target.value }))}
              />
              <label className="text-xs font-medium text-slate-500">Телефон</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <label className="text-xs font-medium text-slate-500">Сумма (₸)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={createForm.amount}
                onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <label className="text-xs font-medium text-slate-500">Ответственный</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={createForm.responsibleUserId}
                onChange={(e) => setCreateForm((f) => ({ ...f, responsibleUserId: e.target.value }))}
              >
                <option value="">—</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <label className="text-xs font-medium text-slate-500">Источник</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={createForm.source}
                onChange={(e) => setCreateForm((f) => ({ ...f, source: e.target.value }))}
              >
                {SOURCES.filter((s) => s !== 'Все').map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateInStage}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <h2 className="text-lg font-semibold">В корзину?</h2>
            <p className="text-sm text-slate-600 mt-2">Сделка попадёт в корзину; восстановление возможно.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border rounded-lg text-sm">
                Отмена
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmSoftDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
              >
                В корзину
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebarDeal && companyId && (
        <DealSidebar
          deal={sidebarDeal}
          companyId={companyId}
          stages={stages}
          managers={managers}
          onClose={closeSidebar}
          onDeleted={closeSidebar}
          onMoveStage={onSidebarMove}
        />
      )}
    </div>
  );
};

function StageColumn({
  stage,
  items,
  allDeals,
  stages,
  convMetaMap,
  onCardDrop,
  onOpenDeal,
  menuDealId,
  setMenuDealId,
  menuRef,
  onEditTitle,
  onArchive,
  onDelete,
  onNewDeal,
  onMoveNext,
  onOpenChat,
  onOpenClient
}: {
  stage: DealsPipelineStage;
  items: Deal[];
  allDeals: Deal[];
  stages: DealsPipelineStage[];
  convMetaMap: Record<string, import('../hooks/useConversationMetaMap').ConversationMeta>;
  onCardDrop: (deal: Deal, stageId: string, index: number) => void;
  onOpenDeal: (d: Deal) => void;
  menuDealId: string | null;
  setMenuDealId: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onEditTitle: (d: Deal) => void;
  onArchive: (d: Deal) => void;
  onDelete: (d: Deal) => void;
  onNewDeal: () => void;
  onMoveNext: (d: Deal) => void;
  onOpenChat: (d: Deal) => void;
  onOpenClient: (d: Deal) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const count = items.length;
  const sumAmount = items.reduce((s, d) => s + (d.amount ?? 0), 0);
  const stageColor =
    stage.color && /^#[0-9A-Fa-f]{3,8}$/i.test(stage.color) ? stage.color : '#64748b';
  const isEmpty = count === 0;
  const stageIndex = stages.findIndex((s) => s.id === stage.id);
  const hasNext = stageIndex >= 0 && stageIndex < stages.length - 1;
  const nextStageName = hasNext ? stages[stageIndex + 1]?.name : null;

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => DEAL_CARD_HEIGHT,
    overscan: 6
  });

  return (
    <div
      className={`flex-shrink-0 w-[308px] flex flex-col rounded-xl border max-h-full min-h-0 shadow-sm overflow-hidden transition-colors ${
        isEmpty
          ? 'border-slate-200/90 bg-slate-100/70'
          : 'border-slate-200 bg-slate-50/95 ring-1 ring-slate-200/60'
      }`}
    >
      <div
        className={`flex-none px-3 pt-0 pb-3 border-b rounded-t-xl ${
          isEmpty ? 'bg-slate-50/90 border-slate-200/80' : 'bg-white border-slate-200'
        }`}
      >
        <div
          className="h-1 w-full rounded-t-xl -mx-0 mb-2.5"
          style={{ backgroundColor: stageColor, marginLeft: 0, marginRight: 0, width: '100%' }}
        />
        <h3
          className={`font-bold truncate text-[15px] leading-tight ${
            isEmpty ? 'text-slate-500' : 'text-slate-900'
          }`}
        >
          {stage.name}
        </h3>
        <p
          className={`text-xs mt-1.5 font-medium tabular-nums ${
            isEmpty ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {count} {dealWord(count)} <span className="text-slate-300 mx-1">•</span>{' '}
          <span className={isEmpty ? 'text-slate-500' : 'text-slate-900 font-semibold'}>
            {sumAmount.toLocaleString('ru-RU')} ₸
          </span>
        </p>
        <button
          type="button"
          onClick={onNewDeal}
          className="mt-2.5 w-full py-2 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-emerald-700 hover:bg-emerald-50/90 flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Новая сделка
        </button>
      </div>
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-0 bg-slate-100/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}') as { dealId?: string };
            if (!data.dealId) return;
            const dragged = allDeals.find((d) => d.id === data.dealId);
            if (!dragged || dragged.stageId === stage.id) return;
            onCardDrop(dragged, stage.id, items.length);
          } catch {
            /* ignore */
          }
        }}
      >
        {items.length === 0 && (
          <div className="py-10 px-3 text-center rounded-lg border border-dashed border-slate-200/80 bg-white/50 mx-1">
            <p className="text-[11px] font-medium text-slate-500">Пустой этап</p>
            <p className="text-[10px] text-slate-400 mt-1">Перетащите сюда сделку или создайте новую</p>
          </div>
        )}
        {items.length > 0 && (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const deal = items[virtualRow.index];
              const isNewTitle = deal.title.trim() === 'Новая сделка';
              const meta =
                deal.whatsappConversationId != null
                  ? convMetaMap[deal.whatsappConversationId]
                  : undefined;
              const unread = meta?.unreadCount ?? 0;
              const staleDays = daysSinceActivity(deal);
              const open = isStageOpen(deal, stages);
              const naMs = nextActionMs(deal);
              const now = Date.now();
              const overdueStep = open && naMs != null && naMs < now;
              const todayStep =
                open && naMs != null && naMs >= startOfToday() && naMs <= endOfToday();
              const noStep = !deal.nextAction?.trim() && !naMs;
              const clientPing =
                meta &&
                meta.lastIncomingAt > meta.lastOutgoingAt &&
                meta.lastIncomingAt > lastActivityMs(deal) - 60000;
              const isHot =
                deal.priority === 'high' ||
                (deal.tags ?? []).some((t) => /горяч/i.test(t));
              const newLead = isNewLeadToday(deal);

              return (
                <div
                  key={deal.id}
                  className="absolute left-0 right-0 px-0.5"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <div
                    className={`deal-card h-[204px] rounded-xl border bg-white shadow-md hover:shadow-lg transition-all text-sm flex flex-col overflow-hidden ${
                      overdueStep
                        ? 'border-red-300 ring-1 ring-red-100'
                        : todayStep
                          ? 'border-amber-300 ring-1 ring-amber-50'
                          : clientPing
                            ? 'border-sky-300 ring-1 ring-sky-50'
                            : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.setData('text/plain', JSON.stringify({ dealId: deal.id }));
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}') as {
                          dealId?: string;
                        };
                        if (!data.dealId || data.dealId === deal.id) return;
                        const dragged = allDeals.find((d) => d.id === data.dealId);
                        if (!dragged || dragged.stageId === stage.id) return;
                        onCardDrop(dragged, stage.id, virtualRow.index);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <div className="flex items-start gap-1 px-2 pt-1.5 min-h-0 flex-1 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onOpenDeal(deal)}
                        className="flex-1 min-w-0 text-left overflow-hidden pb-1"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold text-slate-900 truncate text-[12px] leading-tight pr-1">
                            {deal.title}
                          </p>
                          <div className="flex flex-wrap justify-end gap-0.5 shrink-0 max-w-[42%]">
                            {unread > 0 && (
                              <span className="h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                            {!deal.responsibleUserId && (
                              <span className="text-[8px] font-bold uppercase text-slate-600 bg-slate-100 px-1 rounded">
                                нет менедж.
                              </span>
                            )}
                            {overdueStep && (
                              <span className="text-[8px] font-bold text-white bg-red-600 px-1 rounded">просроч.</span>
                            )}
                            {todayStep && !overdueStep && (
                              <span className="text-[8px] font-bold text-amber-900 bg-amber-200 px-1 rounded">
                                сегодня
                              </span>
                            )}
                            {isHot && (
                              <span className="text-[8px] font-bold text-orange-900 bg-orange-100 px-1 rounded">
                                горячий
                              </span>
                            )}
                            {newLead && (
                              <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">
                                новый
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{stage.name}</p>
                        <p className="text-[11px] text-slate-800 truncate font-medium">
                          {deal.clientNameSnapshot || '—'}
                        </p>
                        <p className="text-[9px] text-slate-500 font-mono truncate">{deal.clientPhoneSnapshot || '—'}</p>
                        <p className="text-xs font-bold text-emerald-700 tabular-nums">
                          {deal.amount != null ? `${deal.amount.toLocaleString('ru-RU')} ₸` : '—'}
                        </p>
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {(deal.tags ?? []).slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[8px] px-1 py-px rounded bg-slate-100 text-slate-600 max-w-[4.5rem] truncate"
                              title={(deal.tags ?? []).join(', ')}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-500 truncate mt-0.5">
                          {deal.responsibleNameSnapshot || 'Без менеджера'} · {deal.source || 'Ручной'}
                        </p>
                        <div
                          className={`text-[9px] mt-0.5 truncate px-1 py-0.5 rounded ${
                            overdueStep
                              ? 'bg-red-50 text-red-800 font-semibold'
                              : todayStep
                                ? 'bg-amber-50 text-amber-900 font-semibold'
                                : noStep
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {deal.nextAction?.trim()
                            ? `${deal.nextAction}${naMs ? ` · ${new Date(naMs).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}`
                            : naMs
                              ? `Касание: ${new Date(naMs).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                              : 'Нет следующего шага'}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                          Активн. {formatLastActivity(deal)}
                          {meta?.lastMessageAt
                            ? ` · WA ${new Date(meta.lastMessageAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                            : ''}
                        </p>
                      </button>
                      <div
                        className="relative shrink-0 pt-0.5"
                        ref={menuDealId === deal.id ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="p-1 rounded-md text-slate-500 hover:bg-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuDealId(menuDealId === deal.id ? null : deal.id);
                          }}
                          aria-label="Меню"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuDealId === deal.id && (
                          <div className="absolute right-0 top-full mt-1 z-[60] w-52 rounded-lg border border-slate-200 bg-white shadow-xl py-1 text-left">
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                              onClick={() => {
                                setMenuDealId(null);
                                onOpenDeal(deal);
                              }}
                            >
                              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                              Открыть сделку
                            </button>
                            <button
                              type="button"
                              disabled={!deal.whatsappConversationId}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                              onClick={() => onOpenChat(deal)}
                            >
                              <MessageCircle className="w-3.5 h-3.5 opacity-70" />
                              Открыть чат
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                              onClick={() => onOpenClient(deal)}
                            >
                              <User className="w-3.5 h-3.5 opacity-70" />
                              Открыть клиента
                            </button>
                            {hasNext && (
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                                onClick={() => onMoveNext(deal)}
                              >
                                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                                Далее: {nextStageName}
                              </button>
                            )}
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                              onClick={() => onEditTitle(deal)}
                            >
                              <Pencil className="w-3.5 h-3.5 opacity-70" />
                              Переименовать
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                              onClick={() => onArchive(deal)}
                            >
                              <Archive className="w-3.5 h-3.5 opacity-70" />
                              В архив
                            </button>
                            <div className="border-t border-slate-100 my-0.5" />
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                              onClick={() => {
                                setMenuDealId(null);
                                onDelete(deal);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              В корзину
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {isNewTitle && (
                      <div className="flex justify-end px-1 pb-1 border-t border-slate-50 bg-slate-50/60">
                        <button
                          type="button"
                          title="Удалить"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(deal);
                          }}
                          className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DealsPage;
