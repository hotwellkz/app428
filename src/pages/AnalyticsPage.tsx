import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  fetchDealsForCompany,
  fetchConversationsForCompany,
  fetchMessagesSince,
  fetchRecentMessages,
  fetchChatManagers,
  invalidateAnalyticsCache,
  type DealRow,
  type MessageRow,
  type ConversationRow,
  type ManagerRow
} from '../lib/firebase/analyticsDashboard';
import { useCompanyId } from '../contexts/CompanyContext';
import { listPipelines, listStages } from '../lib/firebase/deals';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  MessageCircle,
  DollarSign,
  Percent,
  PieChart as PieIcon,
  Activity,
  Moon,
  Sun,
  Zap,
  Radio
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MS_DAY = 86400000;
const MS_MIN = 60000;
const COLORS_PIE = ['#e11d48', '#2563eb', '#16a34a', '#9333ea', '#d97706', '#64748b'];
const STORAGE_TARGET = 'analytics_sales_target_monthly';

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function startOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function endOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
}
function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

type SectionId =
  | 'executive'
  | 'sales'
  | 'messaging'
  | 'managers'
  | 'sources'
  | 'finance'
  | 'live';

export const AnalyticsPage: React.FC = () => {
  const companyId = useCompanyId();
  const reportRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(() => localStorage.getItem('analytics_dark') === '1');
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [managersList, setManagersList] = useState<ManagerRow[]>([]);
  const [stageMeta, setStageMeta] = useState<{ id: string; name: string; type: string }[]>([]);
  const [liveFeed, setLiveFeed] = useState<MessageRow[]>([]);
  const [activeSection, setActiveSection] = useState<SectionId>('executive');

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [managerId, setManagerId] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [leadsRange, setLeadsRange] = useState<'1' | '7' | '30' | '90' | '365'>('30');
  const [salesTarget, setSalesTarget] = useState(() =>
    Number(localStorage.getItem(STORAGE_TARGET) || '0')
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('analytics_dark', dark ? '1' : '0');
  }, [dark]);

  const load = useCallback(
    async (force = false) => {
      if (!companyId) return;
      if (force) invalidateAnalyticsCache();
      setLoading(true);
      try {
        const [d, c, mgr, pipelines] = await Promise.all([
          fetchDealsForCompany(companyId, !force),
          fetchConversationsForCompany(companyId, !force),
          fetchChatManagers(companyId),
          listPipelines(companyId)
        ]);
        setDeals(d);
        setConversations(c);
        setManagersList(mgr);
        const pid = pipelines[0]?.id;
        if (pid) {
          const stages = await listStages(companyId, pid);
          setStageMeta(stages.map((s) => ({ id: s.id, name: s.name, type: s.type })));
        } else setStageMeta([]);
        const since = Date.now() - 400 * MS_DAY;
        const msg = await fetchMessagesSince(companyId, since, 8000, !force);
        setMessages(msg);
        if (msg.length === 0 && d.length > 0) {
          toast('Для графиков WhatsApp создайте индекс: whatsappMessages (companyId + createdAt)', {
            duration: 5000
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const tick = async () => {
      const since = Date.now() - 10 * MS_MIN;
      const recent = await fetchRecentMessages(companyId, since, 80);
      if (!cancelled) setLiveFeed(recent);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [companyId]);

  const wonStageIds = useMemo(
    () => new Set(stageMeta.filter((s) => s.type === 'won').map((s) => s.id)),
    [stageMeta]
  );
  const managerName = useCallback(
    (id: string | null) => {
      if (!id) return '—';
      return managersList.find((m) => m.id === id)?.name ?? id.slice(0, 8) + '…';
    },
    [managersList]
  );

  const fromMs = useMemo(() => new Date(dateFrom).getTime(), [dateFrom]);
  const toMs = useMemo(() => new Date(dateTo).getTime() + MS_DAY - 1, [dateTo]);
  const now = Date.now();
  const todayStart = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const dealsActive = useMemo(() => deals.filter((x) => !x.deletedAt), [deals]);

  const dealsFiltered = useMemo(() => {
    return dealsActive.filter((d) => {
      if (d.createdAt < fromMs || d.createdAt > toMs) return false;
      if (managerId !== 'all') {
        if (managerId === 'none' && d.responsibleUserId) return false;
        if (managerId !== 'none' && d.responsibleUserId !== managerId) return false;
      }
      if (sourceFilter !== 'all' && (d.source || 'Ручной') !== sourceFilter) return false;
      if (channelFilter === 'whatsapp' && !d.whatsappConversationId) return false;
      if (channelFilter === 'instagram' && !(d.source || '').toLowerCase().includes('insta')) return false;
      if (channelFilter === 'other' && d.whatsappConversationId) return false;
      return true;
    });
  }, [dealsActive, fromMs, toMs, managerId, sourceFilter, channelFilter]);

  const dealsAllTimeFiltered = useMemo(() => {
    return dealsActive.filter((d) => {
      if (managerId !== 'all') {
        if (managerId === 'none' && d.responsibleUserId) return false;
        if (managerId !== 'none' && d.responsibleUserId !== managerId) return false;
      }
      if (sourceFilter !== 'all' && (d.source || 'Ручной') !== sourceFilter) return false;
      if (channelFilter === 'whatsapp' && !d.whatsappConversationId) return false;
      if (channelFilter === 'instagram' && !(d.source || '').toLowerCase().includes('insta')) return false;
      if (channelFilter === 'other' && d.whatsappConversationId) return false;
      return true;
    });
  }, [dealsActive, managerId, sourceFilter, channelFilter]);

  const messagesInRange = useMemo(
    () => messages.filter((m) => !m.system && m.createdAt >= fromMs && m.createdAt <= toMs),
    [messages, fromMs, toMs]
  );

  const clientsWaitingReply = useMemo(() => {
    return conversations.filter((c) => {
      if (c.unreadCount > 0) return true;
      const lo = c.lastOutgoingAt || 0;
      const li = c.lastIncomingAt || 0;
      return li > 0 && li > lo;
    }).length;
  }, [conversations]);

  const kpi = useMemo(() => {
    const leadsToday = dealsAllTimeFiltered.filter((d) => d.createdAt >= todayStart).length;
    const leadsMonth = dealsAllTimeFiltered.filter(
      (d) => d.createdAt >= monthStart && d.createdAt <= monthEnd
    ).length;
    const closedInMonth = dealsAllTimeFiltered.filter(
      (d) =>
        wonStageIds.has(d.stageId) &&
        d.stageChangedAt >= monthStart &&
        d.stageChangedAt <= monthEnd
    );
    const dealsClosedMonth = closedInMonth.length;
    const revenueMonth =
      closedInMonth.length > 0
        ? closedInMonth.reduce((s, d) => s + d.amount, 0)
        : dealsAllTimeFiltered
            .filter((d) => d.createdAt >= monthStart && d.createdAt <= monthEnd)
            .reduce((s, d) => s + d.amount, 0);
    const wonCount = dealsAllTimeFiltered.filter((d) => wonStageIds.has(d.stageId)).length;
    const conversion =
      dealsAllTimeFiltered.length > 0
        ? Math.min(100, Math.round((wonCount / dealsAllTimeFiltered.length) * 100))
        : 0;
    const wonWithAmount = dealsAllTimeFiltered.filter((d) => wonStageIds.has(d.stageId) && d.amount > 0);
    const avgDeal =
      wonWithAmount.length > 0
        ? Math.round(wonWithAmount.reduce((s, d) => s + d.amount, 0) / wonWithAmount.length)
        : dealsAllTimeFiltered.filter((d) => d.amount > 0).length > 0
          ? Math.round(
              dealsAllTimeFiltered.filter((d) => d.amount > 0).reduce((s, d) => s + d.amount, 0) /
                dealsAllTimeFiltered.filter((d) => d.amount > 0).length
            )
          : 0;
    return {
      leadsToday,
      leadsMonth,
      dealsClosedMonth,
      revenueMonth,
      conversion,
      avgDeal
    };
  }, [dealsAllTimeFiltered, todayStart, monthStart, monthEnd, wonStageIds]);

  const funnelData = useMemo(() => {
    const stages = stageMeta.filter((s) => s.type === 'open' || s.type === 'won' || s.type === 'lost');
    const list = stages.length ? stages : stageMeta;
    if (!list.length) {
      return [
        { name: 'Новый лид', value: 0, fill: '#0ea5e9', pctFromPrev: 100 },
        { name: 'Контакт', value: 0, fill: '#6366f1', pctFromPrev: 0 },
        { name: 'Замер', value: 0, fill: '#8b5cf6', pctFromPrev: 0 },
        { name: 'Смета', value: 0, fill: '#a855f7', pctFromPrev: 0 },
        { name: 'Договор', value: 0, fill: '#d946ef', pctFromPrev: 0 },
        { name: 'Оплата', value: 0, fill: '#ec4899', pctFromPrev: 0 }
      ];
    }
    let prev = 0;
    return list.slice(0, 8).map((s, i) => {
      const value = dealsAllTimeFiltered.filter((d) => d.stageId === s.id).length;
      const pctFromPrev =
        i === 0 ? 100 : prev > 0 ? Math.round((value / prev) * 100) : value > 0 ? 100 : 0;
      prev = Math.max(value, 1);
      const fills = ['#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#10b981'];
      return { name: s.name, value, fill: fills[i % fills.length], pctFromPrev };
    });
  }, [stageMeta, dealsAllTimeFiltered]);

  const leadsDays = useMemo(() => {
    const days =
      leadsRange === '1'
        ? 1
        : leadsRange === '7'
          ? 7
          : leadsRange === '30'
            ? 30
            : leadsRange === '90'
              ? 90
              : 365;
    const start = Date.now() - days * MS_DAY;
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      map.set(startOfDay(new Date(start + i * MS_DAY)).toString(), 0);
    }
    dealsAllTimeFiltered.forEach((d) => {
      if (d.createdAt < start || d.createdAt > now) return;
      const key = startOfDay(new Date(d.createdAt)).toString();
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => ({ date: fmtDate(Number(k)), leads: v }));
  }, [dealsAllTimeFiltered, leadsRange, now]);

  const waKpi = useMemo(() => {
    const incomingToday = messages.filter(
      (m) => m.direction === 'incoming' && !m.system && m.createdAt >= todayStart
    ).length;
    const convToday = new Set(
      messages.filter((m) => m.createdAt >= todayStart).map((m) => m.conversationId)
    ).size;
    const replies = messages.filter(
      (m) => m.direction === 'outgoing' && !m.system && m.createdAt >= todayStart
    ).length;
    const unread = conversations.reduce((s, c) => s + c.unreadCount, 0);
    const pairs: number[] = [];
    const byConv = new Map<string, MessageRow[]>();
    messages.forEach((m) => {
      if (m.system) return;
      const arr = byConv.get(m.conversationId) || [];
      arr.push(m);
      byConv.set(m.conversationId, arr);
    });
    byConv.forEach((arr) => {
      arr.sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].direction === 'incoming' && arr[i + 1].direction === 'outgoing') {
          pairs.push(arr[i + 1].createdAt - arr[i].createdAt);
        }
      }
    });
    const avgMin =
      pairs.length > 0 ? Math.round(pairs.reduce((a, b) => a + b, 0) / pairs.length / MS_MIN) : 0;
    return { incomingToday, convToday, replies, unread, avgMin };
  }, [messages, conversations, todayStart]);

  const messagesPerDay = useMemo(() => {
    const days = 30;
    const start = Date.now() - days * MS_DAY;
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) map.set(startOfDay(new Date(start + i * MS_DAY)).toString(), 0);
    messages.forEach((m) => {
      if (m.system || m.direction !== 'incoming' || m.createdAt < start) return;
      const key = startOfDay(new Date(m.createdAt)).toString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => ({ date: fmtDate(Number(k)), incoming: v }));
  }, [messages]);

  const convMetrics = useMemo(() => {
    return {
      newConv: conversations.filter((c) => c.createdAt >= todayStart).length,
      active: conversations.filter((c) => c.status === 'active').length,
      closed: conversations.filter((c) => c.status === 'closed' || c.status === 'archived').length
    };
  }, [conversations, todayStart]);

  const msgDealConversion = useMemo(() => {
    const incoming = messagesInRange.filter((m) => m.direction === 'incoming').length;
    const dealsWa = dealsFiltered.filter((d) => d.whatsappConversationId).length;
    const rate =
      incoming > 0 ? Math.min(100, Math.round((dealsWa / Math.max(1, conversations.length)) * 100)) : 0;
    return { incoming, dealsWa, rate };
  }, [messagesInRange, dealsFiltered, conversations.length]);

  const managerPerf = useMemo(() => {
    const convToManager = new Map<string, string | null>();
    dealsAllTimeFiltered.forEach((d) => {
      if (d.whatsappConversationId)
        convToManager.set(d.whatsappConversationId, d.responsibleUserId);
    });
    const rows: Record<
      string,
      { leads: number; closed: number; revenue: number; msgIn: number; msgOut: number; times: number[] }
    > = {};
    const ensure = (id: string) => {
      if (!rows[id]) rows[id] = { leads: 0, closed: 0, revenue: 0, msgIn: 0, msgOut: 0, times: [] };
      return rows[id];
    };
    dealsAllTimeFiltered.forEach((d) => {
      const id = d.responsibleUserId || '__none__';
      const r = ensure(id);
      if (d.createdAt >= fromMs && d.createdAt <= toMs) r.leads++;
      if (
        wonStageIds.has(d.stageId) &&
        d.stageChangedAt >= fromMs &&
        d.stageChangedAt <= toMs
      ) {
        r.closed++;
        r.revenue += d.amount;
      }
    });
    messagesInRange.forEach((m) => {
      if (m.system) return;
      const mgr =
        convToManager.get(m.conversationId) ||
        dealsAllTimeFiltered.find((d) => d.whatsappConversationId === m.conversationId)
          ?.responsibleUserId ||
        '__none__';
      const id = mgr || '__none__';
      const r = ensure(id);
      if (m.direction === 'incoming') r.msgIn++;
      else r.msgOut++;
    });
    const byConv: Record<string, MessageRow[]> = {};
    messagesInRange.forEach((m) => {
      if (m.system) return;
      (byConv[m.conversationId] = byConv[m.conversationId] || []).push(m);
    });
    Object.values(byConv).forEach((arr) => {
      arr.sort((a, b) => a.createdAt - b.createdAt);
      const mgr =
        convToManager.get(arr[0]?.conversationId) ||
        '__none__';
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].direction === 'incoming' && arr[i + 1].direction === 'outgoing') {
          ensure(mgr).times.push(arr[i + 1].createdAt - arr[i].createdAt);
        }
      }
    });
    return Object.entries(rows).map(([id, v]) => ({
      manager: id === '__none__' ? 'Не назначен' : managerName(id),
      leads: v.leads,
      closed: v.closed,
      revenue: v.revenue,
      msgHandled: v.msgIn + v.msgOut,
      avgMin:
        v.times.length > 0 ? Math.round(v.times.reduce((a, b) => a + b, 0) / v.times.length / MS_MIN) : waKpi.avgMin
    }));
  }, [
    dealsAllTimeFiltered,
    messagesInRange,
    fromMs,
    toMs,
    wonStageIds,
    managerName,
    waKpi.avgMin
  ]);

  const sourcePie = useMemo(() => {
    const map = new Map<string, number>();
    dealsFiltered.forEach((d) => {
      const s = (d.source || 'Другое').toLowerCase();
      let key = 'Другое';
      if (s.includes('whatsapp') || s.includes('wa')) key = 'WhatsApp';
      else if (s.includes('google')) key = 'Google';
      else if (s.includes('insta')) key = 'Instagram';
      else if (s.includes('refer') || s.includes('рекоменд')) key = 'Referral';
      else if (s.includes('kaspi')) key = 'Kaspi';
      else if (d.source && d.source.length < 24) key = d.source;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [dealsFiltered]);

  const unreadAlerts = useMemo(() => {
    const t = Date.now();
    let u30 = 0;
    let u60 = 0;
    conversations.forEach((c) => {
      if (c.unreadCount <= 0) return;
      const lastIn = c.lastIncomingAt || c.createdAt;
      const ageMin = (t - lastIn) / MS_MIN;
      if (ageMin > 30) u30 += c.unreadCount;
      if (ageMin > 60) u60 += c.unreadCount;
    });
    return {
      now: conversations.reduce((s, c) => s + c.unreadCount, 0),
      u30,
      u60
    };
  }, [conversations]);

  const liveMetrics = useMemo(() => {
    const tenMin = now - 10 * MS_MIN;
    const hourAgo = now - 60 * MS_MIN;
    const msg10 = liveFeed.filter((m) => m.createdAt >= tenMin && !m.system).length;
    const activeConv = conversations.filter((c) => c.status === 'active').length;
    const unreadConv = conversations.filter((c) => c.unreadCount > 0).length;
    const leadsHour = dealsAllTimeFiltered.filter((d) => d.createdAt >= hourAgo).length;
    return { msg10, activeConv, unreadConv, leadsHour };
  }, [liveFeed, conversations, dealsAllTimeFiltered, now]);

  const convById = useMemo(() => {
    const m = new Map<string, ConversationRow>();
    conversations.forEach((c) => m.set(c.id, c));
    return m;
  }, [conversations]);

  const saveTarget = () => {
    localStorage.setItem(STORAGE_TARGET, String(salesTarget));
    toast.success('План сохранён');
  };

  const exportCsv = () => {
    const lines = [
      ['Показатель', 'Значение'],
      ['Лиды сегодня', String(kpi.leadsToday)],
      ['Закрыто сделок (мес.)', String(kpi.dealsClosedMonth)],
      ['Выручка (мес.)', String(kpi.revenueMonth)],
      ['Ждут ответа (диалоги)', String(clientsWaitingReply)],
      ['Входящие WA сегодня', String(waKpi.incomingToday)],
      ['Непрочитано', String(waKpi.unread)]
    ];
    const blob = new Blob(['\ufeff' + lines.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-${companyId}-${dateFrom}.csv`;
    a.click();
    toast.success('CSV');
  };

  const exportPdf = async () => {
    if (!reportRef.current) return;
    toast.loading('PDF…', { id: 'pdf' });
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 1.15, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, Math.min(h, 280));
      pdf.save(`analytics-${dateFrom}.pdf`);
      toast.success('Готово', { id: 'pdf' });
    } catch {
      toast.error('Ошибка PDF', { id: 'pdf' });
    }
  };

  const sections: { id: SectionId; label: string }[] = [
    { id: 'executive', label: 'Директор' },
    { id: 'sales', label: 'Продажи' },
    { id: 'messaging', label: 'WhatsApp' },
    { id: 'managers', label: 'Менеджеры' },
    { id: 'sources', label: 'Источники' },
    { id: 'finance', label: 'Финансы' },
    { id: 'live', label: 'Мониторинг' }
  ];

  const shell = (child: React.ReactNode) => (
    <div
      className={`min-h-full transition-colors ${
        dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {child}
    </div>
  );

  if (!companyId) {
    return shell(<div className="p-6 text-slate-500">Компания не выбрана</div>);
  }

  return shell(
    <>
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          dark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'
        }`}
      >
        <div className="max-w-[1680px] mx-auto px-3 sm:px-5 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Центр аналитики CRM</h1>
                <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Лиды · сделки · WhatsApp · менеджеры · live · кэш ~45 с
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDark(!dark)}
              className={`p-2 rounded-xl border ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
            >
              {dark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              className={`p-2 rounded-xl border ${dark ? 'border-slate-700' : 'border-slate-200'}`}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex flex-wrap gap-2 ml-auto">
              <button
                type="button"
                onClick={exportCsv}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border ${
                  dark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
          <div
            className={`flex flex-wrap gap-2 p-2 rounded-xl ${dark ? 'bg-slate-800/80' : 'bg-slate-50'}`}
          >
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`rounded-lg px-2 py-1.5 text-sm border ${dark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'}`}
            />
            <span className="self-center text-slate-500">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`rounded-lg px-2 py-1.5 text-sm border ${dark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-200'}`}
            />
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className={`rounded-lg px-2 py-1.5 text-sm border max-w-[160px] ${dark ? 'bg-slate-900 border-slate-600' : 'bg-white'}`}
            >
              <option value="all">Все менеджеры</option>
              <option value="none">Без менеджера</option>
              {managersList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className={`rounded-lg px-2 py-1.5 text-sm border ${dark ? 'bg-slate-900 border-slate-600' : 'bg-white'}`}
            >
              <option value="all">Источник: все</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Google">Google</option>
              <option value="Звонок">Звонок</option>
              <option value="Сайт">Сайт</option>
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className={`rounded-lg px-2 py-1.5 text-sm border ${dark ? 'bg-slate-900 border-slate-600' : 'bg-white'}`}
            >
              <option value="all">Канал: все</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram (по источнику)</option>
              <option value="other">Без WA</option>
            </select>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveSection(s.id);
                  document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeSection === s.id
                    ? 'bg-violet-600 text-white'
                    : dark
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {loading && !deals.length ? (
        <div className="flex justify-center py-32">
          <LoadingSpinner />
        </div>
      ) : (
        <div
          ref={reportRef}
          className="max-w-[1680px] mx-auto px-3 sm:px-5 py-6 space-y-10 pb-24"
        >
          {/* 1 Executive Dashboard */}
          <section id="sec-executive">
            <h2
              className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${
                dark ? 'text-violet-400' : 'text-violet-600'
              }`}
            >
              <Zap className="w-4 h-4" /> Executive Dashboard — обзор для руководителя
            </h2>
            <p className={`text-sm mb-4 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              Статус бизнеса за секунды: лиды, закрытия, выручка, ответы клиентам.
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x scrollbar-thin -mx-1 px-1">
              {[
                {
                  label: 'Лиды сегодня',
                  value: kpi.leadsToday,
                  icon: Users,
                  grad: 'from-cyan-500 to-blue-600'
                },
                {
                  label: 'Лиды за месяц',
                  value: kpi.leadsMonth,
                  icon: TrendingUp,
                  grad: 'from-blue-500 to-indigo-600'
                },
                {
                  label: 'Закрыто сделок (мес.)',
                  value: kpi.dealsClosedMonth,
                  icon: BarChart3,
                  grad: 'from-indigo-500 to-violet-600'
                },
                {
                  label: 'Выручка (мес.)',
                  value: `${(kpi.revenueMonth / 1000).toFixed(0)}k ₸`,
                  sub: kpi.revenueMonth.toLocaleString('ru-RU') + ' ₸',
                  icon: DollarSign,
                  grad: 'from-emerald-500 to-teal-600'
                },
                {
                  label: 'Конверсия в победу',
                  value: `${kpi.conversion}%`,
                  icon: Percent,
                  grad: 'from-amber-500 to-orange-600'
                },
                {
                  label: 'Средний чек (won)',
                  value: kpi.avgDeal ? `${(kpi.avgDeal / 1000).toFixed(0)}k ₸` : '—',
                  icon: Target,
                  grad: 'from-rose-500 to-pink-600'
                },
                {
                  label: 'Ждут ответа',
                  value: clientsWaitingReply,
                  icon: Radio,
                  grad: 'from-red-500 to-rose-700'
                }
              ].map((c) => (
                <div
                  key={c.label}
                  className={`min-w-[158px] sm:min-w-[180px] snap-start rounded-2xl p-4 text-white shadow-xl bg-gradient-to-br ${c.grad}`}
                >
                  <c.icon className="w-8 h-8 opacity-90 mb-3" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{c.label}</p>
                  <p className="text-3xl sm:text-4xl font-black tabular-nums mt-1 leading-none">{c.value}</p>
                  {'sub' in c && c.sub && (
                    <p className="text-[10px] opacity-80 mt-0.5 truncate max-w-full">{c.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Unread alerts */}
          <section
            className={`rounded-2xl border p-4 ${
              dark ? 'bg-red-950/40 border-red-900' : 'bg-red-50 border-red-200'
            }`}
          >
            <h3 className={`text-sm font-bold mb-3 ${dark ? 'text-red-300' : 'text-red-800'}`}>
              Unread Alert System
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Сейчас непрочитано', v: unreadAlerts.now, tone: 'bg-red-600 text-white' },
                { label: '> 30 мин с входящего', v: unreadAlerts.u30, tone: 'bg-red-700 text-white' },
                { label: '> 1 час', v: unreadAlerts.u60, tone: 'bg-red-900 text-white' }
              ].map((x) => (
                <div
                  key={x.label}
                  className={`rounded-xl px-4 py-3 ${x.tone} shadow-lg`}
                >
                  <p className="text-xs font-semibold opacity-90">{x.label}</p>
                  <p className="text-3xl font-black mt-1 tabular-nums">{x.v}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 2 Sales funnel + 3 Leads graph */}
          <section id="sec-sales" className="grid lg:grid-cols-2 gap-6">
            <div
              className={`rounded-2xl border p-5 shadow-sm ${
                dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h2 className="text-base font-bold mb-1">Sales Analytics — воронка</h2>
              <p className={`text-xs mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Этапы CRM · количество · конверсия между этапами (%)
              </p>
              <div className="h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 4, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                    <XAxis type="number" tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={88}
                      tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: dark ? '#1e293b' : '#fff',
                        border: dark ? '1px solid #334155' : '1px solid #e2e8f0'
                      }}
                      formatter={(v: number, _n: string, p: { payload: { pctFromPrev: number } }) => [
                        `${v} сделок · ${p.payload.pctFromPrev}% от пред.`,
                        'Этап'
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} name="Сделок">
                      {funnelData.map((e, i) => (
                        <Cell key={i} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div
              className={`rounded-2xl border p-5 shadow-sm ${
                dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-base font-bold">Лиды по дням</h2>
                <div className="flex gap-1 flex-wrap">
                  {(['1', '7', '30', '90', '365'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLeadsRange(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        leadsRange === d
                          ? 'bg-violet-600 text-white'
                          : dark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d === '1' ? 'Сегодня' : d === '365' ? 'Год' : `${d}д`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={leadsDays}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        background: dark ? '#1e293b' : '#fff',
                        border: dark ? '1px solid #334155' : '1px solid #e2e8f0'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="leads"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* 4–6 Messaging */}
          <section id="sec-messaging">
            <h2
              className={`text-xs font-bold uppercase tracking-widest mb-4 ${
                dark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              Messaging Analytics (WhatsApp)
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x mb-6">
              {[
                { label: 'Входящие сегодня', v: waKpi.incomingToday, icon: MessageCircle },
                { label: 'Диалогов сегодня', v: waKpi.convToday, icon: Users },
                { label: 'Ответов менеджеров', v: waKpi.replies, icon: Activity },
                { label: 'Непрочитано', v: waKpi.unread, icon: Radio },
                { label: 'Ср. ответ (мин)', v: waKpi.avgMin, icon: Zap }
              ].map((x) => (
                <div
                  key={x.label}
                  className={`min-w-[140px] snap-start rounded-2xl border p-4 ${
                    dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <x.icon className={`w-6 h-6 mb-2 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <p className={`text-[10px] font-bold uppercase ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {x.label}
                  </p>
                  <p className="text-xl font-black mt-1 tabular-nums">{x.v}</p>
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div
                className={`rounded-2xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <h3 className="font-bold mb-4">Message activity — входящие / день</h3>
                <div className="h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={messagesPerDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: dark ? '#94a3b8' : '#64748b' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="incoming" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div
                className={`rounded-2xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <h3 className="font-bold mb-4">Диалоги</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { t: 'Новые сегодня', v: convMetrics.newConv, c: 'from-cyan-500 to-blue-600' },
                    { t: 'Активные', v: convMetrics.active, c: 'from-violet-500 to-purple-600' },
                    { t: 'Закрытые', v: convMetrics.closed, c: 'from-slate-500 to-slate-700' }
                  ].map((x) => (
                    <div
                      key={x.t}
                      className={`rounded-xl p-4 text-white bg-gradient-to-br ${x.c} shadow-lg`}
                    >
                      <p className="text-2xl font-black">{x.v}</p>
                      <p className="text-[10px] font-semibold mt-1 opacity-90">{x.t}</p>
                    </div>
                  ))}
                </div>
                <div
                  className={`mt-6 rounded-xl p-4 border ${dark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
                >
                  <h4 className="text-sm font-bold mb-2">Message → Deal conversion</h4>
                  <p className="text-sm">
                    Входящих в периоде: <strong>{msgDealConversion.incoming}</strong>
                  </p>
                  <p className="text-sm">
                    Сделок с WA: <strong>{msgDealConversion.dealsWa}</strong>
                  </p>
                  <p className="text-sm text-violet-600 dark:text-violet-400 font-bold mt-1">
                    Конверсия ~ {msgDealConversion.rate}%
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 8 Managers */}
          <section id="sec-managers">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 text-indigo-500 dark:text-indigo-400">
              Managers Performance
            </h2>
            <div
              className={`rounded-2xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                      {['Менеджер', 'Лиды', 'Закрыто', 'Выручка', 'Сообщений', 'Ср. ответ (мин)'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {managerPerf.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b ${dark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}
                      >
                        <td className="py-3 px-4 font-semibold">{r.manager}</td>
                        <td className="py-3 px-4 tabular-nums">{r.leads}</td>
                        <td className="py-3 px-4 tabular-nums">{r.closed}</td>
                        <td className="py-3 px-4 tabular-nums">{r.revenue.toLocaleString('ru-RU')} ₸</td>
                        <td className="py-3 px-4 tabular-nums">{r.msgHandled}</td>
                        <td className="py-3 px-4 tabular-nums">{r.avgMin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 9 Sources + 10 Finance */}
          <section id="sec-sources" className="grid lg:grid-cols-2 gap-6">
            <div
              className={`rounded-2xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <PieIcon className="w-5 h-5" /> Lead Sources
              </h3>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourcePie.length ? sourcePie : [{ name: 'Нет данных', value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {(sourcePie.length ? sourcePie : [{ name: '—', value: 1 }]).map((_, i) => (
                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div id="sec-finance" className={`rounded-2xl border p-5 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" /> Finance — план vs факт
              </h3>
              <input
                type="number"
                placeholder="План выручки ₸"
                className={`w-full rounded-xl border px-4 py-3 text-sm mb-3 ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
                value={salesTarget || ''}
                onChange={(e) => setSalesTarget(Number(e.target.value) || 0)}
              />
              <button
                type="button"
                onClick={saveTarget}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold mb-4"
              >
                Сохранить план
              </button>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>Факт</p>
              <p className="text-3xl font-black">{kpi.revenueMonth.toLocaleString('ru-RU')} ₸</p>
              {salesTarget > 0 && (
                <>
                  <div className="mt-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.round((kpi.revenueMonth / salesTarget) * 100))}%` }}
                    />
                  </div>
                  <p className="text-sm font-bold mt-2">
                    {Math.round((kpi.revenueMonth / salesTarget) * 100)}% плана
                  </p>
                </>
              )}
            </div>
          </section>

          {/* 11 Live */}
          <section id="sec-live">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-rose-500">
              <Radio className="w-4 h-4 animate-pulse" /> Live Monitoring — каждые 10 с
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { l: 'Сообщ. за 10 мин', v: liveMetrics.msg10 },
                { l: 'Активных диалогов', v: liveMetrics.activeConv },
                { l: 'С непрочитанным', v: liveMetrics.unreadConv },
                { l: 'Лидов за час', v: liveMetrics.leadsHour }
              ].map((x) => (
                <div
                  key={x.l}
                  className={`rounded-xl border p-4 ${dark ? 'bg-slate-900 border-rose-900/50' : 'bg-rose-50 border-rose-200'}`}
                >
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{x.l}</p>
                  <p className="text-2xl font-black mt-1">{x.v}</p>
                </div>
              ))}
            </div>
            <div
              className={`rounded-2xl border max-h-[360px] overflow-y-auto ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <table className="w-full text-sm min-w-[520px]">
                <thead className={`sticky top-0 ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <tr>
                    {['Время', 'Телефон', 'Превью', 'Менеджер', 'Статус'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveFeed.slice(0, 40).map((m) => {
                    const c = convById.get(m.conversationId);
                    const status =
                      c && c.unreadCount > 0 ? 'Непрочитано' : m.direction === 'incoming' ? 'Входящее' : 'Исходящее';
                    return (
                      <tr
                        key={m.id}
                        className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}
                      >
                        <td className="py-2 px-3 whitespace-nowrap text-xs tabular-nums">
                          {fmtTime(m.createdAt)}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{c?.phone || '—'}</td>
                        <td className="py-2 px-3 max-w-[200px] truncate text-xs">
                          {(m.text || '').replace(/\s+/g, ' ')}
                        </td>
                        <td className="py-2 px-3 text-xs truncate max-w-[100px]">
                          {c?.dealResponsibleName || '—'}
                        </td>
                        <td className="py-2 px-3 text-xs">{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {liveFeed.length === 0 && (
                <p className={`p-8 text-center text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Нет сообщений за 10 мин (или нет индекса Firestore)
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default AnalyticsPage;
