import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useCompanyId } from '../contexts/CompanyContext';
import { usePipelines, usePipelineStages, useDeals } from '../hooks/useDeals';
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
  ChevronUp
} from 'lucide-react';

const DEAL_CARD_HEIGHT = 136;
const SOURCES = ['Все', 'WhatsApp', 'Звонок', 'Сайт', 'Ручной', 'Другое'];

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

function formatCardDate(d: Deal['createdAt']): string {
  if (!d) return '—';
  const ms = dealTime(d);
  return new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export const DealsPage: React.FC = () => {
  const companyId = useCompanyId();
  const [searchParams, setSearchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get('deal');
  const [sidebarDeal, setSidebarDeal] = useState<Deal | null>(null);
  const { pipelines, loading: loadingPipelines, error: pipelinesError } = usePipelines(companyId);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const effectivePipelineId =
    selectedPipelineId ?? (pipelines.length > 0 ? pipelines[0].id : null);
  const { stages, loading: loadingStages } = usePipelineStages(companyId, effectivePipelineId);
  const { deals: rawDeals, loading: loadingDeals } = useDeals(companyId, effectivePipelineId);

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

  const deals = useMemo(() => {
    let list = rawDeals.filter((d) => !d.isArchived);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.clientNameSnapshot ?? '').toLowerCase().includes(q) ||
          (d.clientPhoneSnapshot ?? '').includes(q)
      );
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
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((d) => dealTime(d.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      list = list.filter((d) => dealTime(d.createdAt) <= to);
    }
    const min = amountMin.trim() ? Number(amountMin.replace(/\s/g, '')) : NaN;
    const max = amountMax.trim() ? Number(amountMax.replace(/\s/g, '')) : NaN;
    if (!Number.isNaN(min)) list = list.filter((d) => (d.amount ?? 0) >= min);
    if (!Number.isNaN(max)) list = list.filter((d) => (d.amount ?? 0) <= max);
    return list;
  }, [
    rawDeals,
    searchQuery,
    filterManager,
    filterSource,
    filterStage,
    dateFrom,
    dateTo,
    amountMin,
    amountMax
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

  const openSidebar = useCallback((deal: Deal) => {
    setMenuDealId(null);
    setSidebarDeal(deal);
    setSearchParams({ deal: deal.id }, { replace: true });
  }, [setSearchParams]);

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

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Компания не привязана.</p>
      </div>
    );
  }

  const loading = loadingPipelines || loadingStages || loadingDeals;

  return (
    <div className="flex flex-col h-full bg-slate-100/80">
      <header className="flex-none bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Сделки</h1>
          <select
            value={effectivePipelineId ?? ''}
            onChange={(e) => setSelectedPipelineId(e.target.value || null)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
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
          <Link
            to="/deals/trash"
            className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            Корзина
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="search"
              placeholder="Поиск…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-44 md:w-56"
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
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
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
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
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
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
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
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-semibold">Дата по</label>
                <input
                  type="date"
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-semibold">Сумма от</label>
                  <input
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                    placeholder="₸"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-semibold">до</label>
                  <input
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                    placeholder="₸"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                  />
                </div>
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
          <div className="h-full overflow-x-auto overflow-y-hidden flex gap-3 p-3 pb-4">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                items={groupedDeals[stage.id] ?? []}
                allDeals={deals}
                onCardDrop={handleCardDrop}
                onOpenDeal={openSidebar}
                menuDealId={menuDealId}
                setMenuDealId={setMenuDealId}
                menuRef={menuRef}
                onEditTitle={handleEditTitle}
                onArchive={handleArchive}
                onDelete={(d) => setDeleteTarget(d)}
                onNewDeal={() => setCreateModal({ stage })}
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
            <h2 className="text-lg font-semibold">Удалить сделку?</h2>
            <p className="text-sm text-slate-600 mt-2">Сделка будет в корзине; восстановление возможно.</p>
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
                Удалить
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
  onCardDrop,
  onOpenDeal,
  menuDealId,
  setMenuDealId,
  menuRef,
  onEditTitle,
  onArchive,
  onDelete,
  onNewDeal
}: {
  stage: DealsPipelineStage;
  items: Deal[];
  allDeals: Deal[];
  onCardDrop: (deal: Deal, stageId: string, index: number) => void;
  onOpenDeal: (d: Deal) => void;
  menuDealId: string | null;
  setMenuDealId: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onEditTitle: (d: Deal) => void;
  onArchive: (d: Deal) => void;
  onDelete: (d: Deal) => void;
  onNewDeal: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const count = items.length;
  const sumAmount = items.reduce((s, d) => s + (d.amount ?? 0), 0);
  const stageColor =
    stage.color && /^#[0-9A-Fa-f]{3,8}$/i.test(stage.color) ? stage.color : '#64748b';

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => DEAL_CARD_HEIGHT,
    overscan: 6
  });

  return (
    <div className="flex-shrink-0 w-[300px] flex flex-col rounded-xl border border-slate-200 bg-slate-100/90 shadow-sm max-h-full min-h-0">
      <div
        className="flex-none px-3 py-3 border-b border-slate-200 rounded-t-xl bg-white"
        style={{ borderTopWidth: 3, borderTopColor: stageColor }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow"
            style={{ backgroundColor: stageColor }}
          />
          <h3 className="font-semibold text-slate-800 text-sm truncate">{stage.name}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 pl-4">
          {count} {count === 1 ? 'сделка' : count < 5 ? 'сделки' : 'сделок'} ·{' '}
          <span className="font-semibold text-slate-700">{sumAmount.toLocaleString('ru-RU')} ₸</span>
        </p>
        <button
          type="button"
          onClick={onNewDeal}
          className="mt-2 w-full py-2 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-emerald-700 hover:bg-emerald-50/80 flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Новая сделка
        </button>
      </div>
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-0"
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
          <p className="text-xs text-slate-400 text-center py-8">Перетащите сделку сюда</p>
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
                    className="deal-card h-[128px] rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-sm flex flex-col overflow-hidden"
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
                    <button
                      type="button"
                      onClick={() => onOpenDeal(deal)}
                      className="flex-1 min-h-0 text-left px-3 pt-2 pb-1 overflow-hidden w-full"
                    >
                      <p className="font-semibold text-slate-900 truncate text-[13px] leading-tight">
                        {deal.title}
                      </p>
                      <p className="text-xs text-slate-600 truncate mt-0.5">
                        {deal.clientNameSnapshot || '—'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {deal.clientPhoneSnapshot || '—'}
                      </p>
                      <div className="flex items-center justify-between mt-1 gap-1">
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">
                          {deal.amount != null ? `${deal.amount.toLocaleString('ru-RU')} ₸` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span className="truncate max-w-[45%]">{deal.responsibleNameSnapshot || '—'}</span>
                        <span className="truncate max-w-[45%] text-right">{deal.source || 'Ручной'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatCardDate(deal.createdAt)}</p>
                    </button>
                    <div className="flex items-center justify-end gap-0.5 px-1 pb-1 border-t border-slate-50 bg-slate-50/50">
                      {isNewTitle && (
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
                      )}
                      <div className="relative ml-auto" ref={menuDealId === deal.id ? menuRef : undefined}>
                        <button
                          type="button"
                          className="p-1 rounded text-slate-500 hover:bg-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuDealId(menuDealId === deal.id ? null : deal.id);
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuDealId === deal.id && (
                          <div className="absolute right-0 bottom-full mb-1 z-50 w-40 rounded-lg border bg-white shadow-xl py-1 text-left">
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                              onClick={() => onOpenDeal(deal)}
                            >
                              Открыть
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex gap-1"
                              onClick={() => onEditTitle(deal)}
                            >
                              <Pencil className="w-3 h-3" /> Редактировать
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex gap-1"
                              onClick={() => onArchive(deal)}
                            >
                              <Archive className="w-3 h-3" /> Архив
                            </button>
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setMenuDealId(null);
                                onDelete(deal);
                              }}
                            >
                              <Trash2 className="w-3 h-3 inline mr-1" />
                              Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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
