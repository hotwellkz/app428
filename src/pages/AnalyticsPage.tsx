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
  AnalyticsForbiddenError,
  type DealRow,
  type MessageRow,
  type ConversationRow,
  type ManagerRow
} from '../lib/firebase/analyticsDashboard';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { auth } from '../lib/firebase/auth';
import { listPipelines, listStages } from '../lib/firebase/deals';
import {
  fetchClientsForAnalytics,
  fetchTransactionsForAnalytics,
  fetchProductsForAnalytics,
  fetchWarehouseDocumentsForAnalytics,
  type ClientAnalyticsRow,
  type TxAnalyticsRow,
  type ProductAnalyticsRow,
  type WarehouseDocRow
} from '../lib/firebase/analyticsExtended';
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
  Radio,
  LayoutDashboard,
  Clock,
  Wrench,
  X,
  Building2,
  Package,
  Wallet
} from 'lucide-react';
import ru from '../locales/ru.json';
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
  | 'director'
  | 'ops'
  | 'construction'
  | 'txfinance'
  | 'warehouse'
  | 'leads'
  | 'messaging'
  | 'managers'
  | 'sources'
  | 'finance'
  | 'live';

const t = ru.analytics;

export const AnalyticsPage: React.FC = () => {
  const companyId = useCompanyId();
  const { menuAccess } = useCurrentCompanyUser();
  const reportRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(() => localStorage.getItem('analytics_dark') === '1');
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [managersList, setManagersList] = useState<ManagerRow[]>([]);
  const [stageMeta, setStageMeta] = useState<{ id: string; name: string; type: string }[]>([]);
  const [liveFeed, setLiveFeed] = useState<MessageRow[]>([]);
  const [activeSection, setActiveSection] = useState<SectionId>('director');
  const [clientsRows, setClientsRows] = useState<ClientAnalyticsRow[]>([]);
  const [txRows, setTxRows] = useState<TxAnalyticsRow[]>([]);
  const [productsRows, setProductsRows] = useState<ProductAnalyticsRow[]>([]);
  const [whDocs, setWhDocs] = useState<WarehouseDocRow[]>([]);

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const defaultDateRange = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
  }, []);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const [draftManager, setDraftManager] = useState(managerId);
  const [draftSource, setDraftSource] = useState(sourceFilter);
  const [draftChannel, setDraftChannel] = useState(channelFilter);
  const [chartHMain, setChartHMain] = useState(320);
  const [chartHMsg, setChartHMsg] = useState(256);
  const [chartHPie, setChartHPie] = useState(288);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      const m = mq.matches;
      setChartHMain(m ? 240 : 320);
      setChartHMsg(m ? 228 : 256);
      setChartHPie(m ? 240 : 288);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const openFilterSheet = useCallback(() => {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
    setDraftManager(managerId);
    setDraftSource(sourceFilter);
    setDraftChannel(channelFilter);
    setMobileFiltersOpen(true);
  }, [dateFrom, dateTo, managerId, sourceFilter, channelFilter]);

  const applyFilterSheet = useCallback(() => {
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    setManagerId(draftManager);
    setSourceFilter(draftSource);
    setChannelFilter(draftChannel);
    setMobileFiltersOpen(false);
  }, [draftFrom, draftTo, draftManager, draftSource, draftChannel]);

  const resetFilterSheet = useCallback(() => {
    const { from, to } = defaultDateRange();
    setDraftFrom(from);
    setDraftTo(to);
    setDraftManager('all');
    setDraftSource('all');
    setDraftChannel('all');
    setDateFrom(from);
    setDateTo(to);
    setManagerId('all');
    setSourceFilter('all');
    setChannelFilter('all');
    setMobileFiltersOpen(false);
  }, [defaultDateRange]);

  const filterChips = useMemo(() => {
    const chips: { key: string; text: string }[] = [];
    const df = new Date(dateFrom);
    const dt = new Date(dateTo);
    chips.push({
      key: 'period',
      text: `📅 ${df.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} — ${dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
    });
    if (managerId === 'all') chips.push({ key: 'mgr', text: `👤 ${t.allManagers}` });
    else if (managerId === 'none') chips.push({ key: 'mgr', text: `👤 ${t.noManager}` });
    else
      chips.push({
        key: 'mgr',
        text: `👤 ${managersList.find((m) => m.id === managerId)?.name ?? managerId}`
      });
    if (sourceFilter === 'all') chips.push({ key: 'src', text: `📊 ${t.sourceAll}` });
    else chips.push({ key: 'src', text: `📊 ${t.sourceLabel}: ${sourceFilter}` });
    if (channelFilter === 'all') chips.push({ key: 'ch', text: `📡 ${t.channelAll}` });
    else if (channelFilter === 'whatsapp') chips.push({ key: 'ch', text: `📡 ${t.channelWhatsapp}` });
    else if (channelFilter === 'instagram') chips.push({ key: 'ch', text: `📡 ${t.channelInstagram}` });
    else chips.push({ key: 'ch', text: `📡 ${t.channelOther}` });
    return chips;
  }, [dateFrom, dateTo, managerId, sourceFilter, channelFilter, managersList]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('analytics_dark', dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    if (!companyId || !auth.currentUser) return;
    addDoc(collection(db, 'analytics_access_log'), {
      companyId,
      userId: auth.currentUser.uid,
      action: 'analytics_open',
      at: serverTimestamp()
    }).catch(() => {});
  }, [companyId]);

  const load = useCallback(
    async (force = false) => {
      if (!companyId) return;
      if (force) invalidateAnalyticsCache();
      setLoading(true);
      try {
        const [d, c, mgr, pipelines] = await Promise.all([
          fetchDealsForCompany(companyId, !force, menuAccess),
          fetchConversationsForCompany(companyId, !force, menuAccess),
          fetchChatManagers(companyId, menuAccess),
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
        const msg = await fetchMessagesSince(companyId, since, 8000, !force, menuAccess);
        setMessages(msg);
        const [cl, tx, pr, wh] = await Promise.all([
          fetchClientsForAnalytics(companyId, menuAccess),
          fetchTransactionsForAnalytics(companyId, 2800, menuAccess),
          fetchProductsForAnalytics(companyId, menuAccess),
          fetchWarehouseDocumentsForAnalytics(companyId, 900, menuAccess)
        ]);
        setClientsRows(cl);
        setTxRows(tx);
        setProductsRows(pr);
        setWhDocs(wh);
        if (msg.length === 0 && d.length > 0) {
          toast(
            'Сообщения WhatsApp: нужен индекс Firestore. Выполните: firebase deploy --only firestore:indexes (коллекция whatsappMessages: companyId + createdAt).',
            { duration: 8000 }
          );
        }
      } catch (e) {
        if (e instanceof AnalyticsForbiddenError) {
          toast.error('Нет права analytics:view (403)');
        } else {
          toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
        }
      } finally {
        setLoading(false);
      }
    },
    [companyId, menuAccess]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const since = Date.now() - 10 * MS_MIN;
        const recent = await fetchRecentMessages(companyId, since, 80, menuAccess);
        if (!cancelled) setLiveFeed(recent);
      } catch {
        if (!cancelled) setLiveFeed([]);
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [companyId, menuAccess]);

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

  /** KPI директорской панели: период + фильтры менеджер/источник/канал */
  const directorKpi = useMemo(() => {
    const leadsToday = dealsAllTimeFiltered.filter((d) => d.createdAt >= todayStart).length;
    const leadsPeriod = dealsFiltered.length;
    const closedPeriod = dealsAllTimeFiltered.filter(
      (d) =>
        wonStageIds.has(d.stageId) && d.stageChangedAt >= fromMs && d.stageChangedAt <= toMs
    );
    const revenuePeriod = closedPeriod.reduce((s, d) => s + (d.amount || 0), 0);
    const convPct =
      leadsPeriod > 0 ? Math.min(100, Math.round((closedPeriod.length / leadsPeriod) * 100)) : 0;
    const avgCheck =
      closedPeriod.length > 0 ? Math.round(revenuePeriod / closedPeriod.length) : 0;
    return {
      leadsToday,
      leadsPeriod,
      dealsClosedPeriod: closedPeriod.length,
      revenuePeriod,
      convPct,
      avgCheck
    };
  }, [dealsAllTimeFiltered, dealsFiltered, fromMs, toMs, wonStageIds, todayStart]);

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
    { id: 'director', label: t.navDirector },
    { id: 'ops', label: t.opsAnalytics },
    { id: 'construction', label: t.navConstruction },
    { id: 'txfinance', label: t.navTxFinance },
    { id: 'warehouse', label: t.navWarehouse },
    { id: 'leads', label: t.navLeads },
    { id: 'messaging', label: t.navWhatsapp },
    { id: 'managers', label: t.navManagers },
    { id: 'sources', label: t.navSources },
    { id: 'finance', label: t.navFinance },
    { id: 'live', label: t.navLive }
  ];

  const clientsInPeriod = useMemo(
    () => clientsRows.filter((c) => c.createdAt >= fromMs && c.createdAt <= toMs),
    [clientsRows, fromMs, toMs]
  );
  const constructionKpi = useMemo(() => {
    const total = clientsRows.length;
    const building = clientsRows.filter((c) => c.status === 'building').length;
    const built = clientsRows.filter((c) => c.status === 'built').length;
    const depositStatus = clientsRows.filter((c) => c.status === 'deposit').length;
    const withDeposit = clientsRows.filter((c) => c.deposit > 0).length;
    const completedMonth = clientsRows.filter(
      (c) => c.status === 'built' && c.updatedAt >= monthStart && c.updatedAt <= monthEnd
    ).length;
    const newMonth = clientsRows.filter((c) => c.createdAt >= monthStart && c.createdAt <= monthEnd).length;
    const newPeriod = clientsInPeriod.length;
    let overdue = 0;
    clientsRows.forEach((c) => {
      if (c.status !== 'building' || !c.startDate) return;
      const start = new Date(c.startDate).getTime();
      if (!start) return;
      const days = c.buildDays || 45;
      const end = start + days * MS_DAY;
      if (end < now) overdue++;
    });
    return {
      total,
      building,
      built,
      depositStatus,
      waiting: depositStatus,
      withDeposit,
      completedMonth,
      newMonth,
      newPeriod,
      overdue
    };
  }, [clientsRows, clientsInPeriod, monthStart, monthEnd, now]);

  const clientsNewByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let t = fromMs; t <= toMs; t += MS_DAY) map.set(startOfDay(new Date(t)).toString(), 0);
    clientsInPeriod.forEach((c) => {
      const k = startOfDay(new Date(c.createdAt)).toString();
      if (map.has(k)) map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => ({ date: fmtDate(Number(k)), count: v }));
  }, [clientsInPeriod, fromMs, toMs]);

  const builtByMonth = useMemo(() => {
    const map = new Map<string, number>();
    clientsRows
      .filter((c) => c.status === 'built' && c.updatedAt > 0)
      .forEach((c) => {
        const d = new Date(c.updatedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map.set(key, (map.get(key) || 0) + 1);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([month, count]) => ({ month, count }));
  }, [clientsRows]);

  const activeBuildsRows = useMemo(() => {
    return clientsRows
      .filter((c) => c.status === 'building')
      .map((c) => {
        const start = c.startDate ? new Date(c.startDate).getTime() : 0;
        const days = c.buildDays || 45;
        const planEnd = start ? start + days * MS_DAY : 0;
        let progress = 0;
        if (start && planEnd > start) {
          progress = Math.min(100, Math.round(((now - start) / (planEnd - start)) * 100));
        }
        return {
          id: c.id,
          client: c.name || '—',
          object: c.objectName || '—',
          status: t.statusBuilding,
          progress: `${progress}%`,
          start: c.startDate || '—',
          planEnd: planEnd ? new Date(planEnd).toLocaleDateString('ru-RU') : '—'
        };
      })
      .slice(0, 80);
  }, [clientsRows, now, t.statusBuilding]);

  const txInPeriod = useMemo(
    () => txRows.filter((x) => x.dateMs >= fromMs && x.dateMs <= toMs),
    [txRows, fromMs, toMs]
  );
  const txMonth = useMemo(
    () => txRows.filter((x) => x.dateMs >= monthStart && x.dateMs <= monthEnd),
    [txRows, monthStart, monthEnd]
  );
  const txFinanceKpiFixed = useMemo(() => {
    const incomeToday = txRows.filter((x) => x.type === 'income' && x.dateMs >= todayStart).reduce((s, x) => s + x.amount, 0);
    const incomeM = txMonth.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const expenseM = txMonth.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const incCount = txMonth.filter((x) => x.type === 'income').length;
    return {
      incomeToday,
      incomeMonth: incomeM,
      expenseMonth: expenseM,
      netProfit: incomeM - expenseM,
      avgPayment: incCount ? Math.round(incomeM / incCount) : 0
    };
  }, [txRows, txMonth, todayStart]);

  const incomeByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let t = fromMs; t <= toMs; t += MS_DAY) map.set(startOfDay(new Date(t)).toString(), 0);
    txInPeriod.filter((x) => x.type === 'income').forEach((x) => {
      const k = startOfDay(new Date(x.dateMs)).toString();
      if (map.has(k)) map.set(k, (map.get(k) || 0) + x.amount);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => ({ date: fmtDate(Number(k)), sum: v }));
  }, [txInPeriod, fromMs, toMs]);

  const incomeByMonthChart = useMemo(() => {
    const map = new Map<string, number>();
    txRows
      .filter((x) => x.type === 'income')
      .forEach((x) => {
        const d = new Date(x.dateMs);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map.set(key, (map.get(key) || 0) + x.amount);
      });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, sum]) => ({ month, sum }));
  }, [txRows]);

  const recentTxTable = useMemo(() => {
    return txInPeriod.slice(0, 25).map((x) => ({
      id: x.id,
      date: new Date(x.dateMs).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      client: x.fromUser || x.toUser || '—',
      type: x.type === 'income' ? t.incomeType : t.expenseType,
      amount: x.amount,
      comment: (x.description || '').slice(0, 80)
    }));
  }, [txInPeriod, t.incomeType, t.expenseType]);

  const warehouseKpi = useMemo(() => {
    const totalValue = productsRows.reduce((s, p) => s + p.quantity * (p.averagePurchasePrice || 0), 0);
    const monthMs = monthStart;
    const monthEndMs = monthEnd;
    let purchases = 0;
    let consumption = 0;
    const usageByName = new Map<string, number>();
    whDocs.forEach((doc) => {
      if (doc.dateMs < monthMs || doc.dateMs > monthEndMs) return;
      doc.items.forEach((it) => {
        const sum = it.quantity * it.price;
        if (doc.type === 'income') purchases += sum;
        else {
          consumption += sum;
          const n = it.product?.name || '—';
          usageByName.set(n, (usageByName.get(n) || 0) + it.quantity);
        }
      });
    });
    const topMaterials = Array.from(usageByName.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, used]) => {
        const prod = productsRows.find((p) => p.name === name);
        const stock = prod?.quantity ?? 0;
        const cost = stock * (prod?.averagePurchasePrice || 0);
        return { name, used, stock, cost };
      });
    const lowStock = productsRows.filter((p) => p.quantity <= (p.minQuantity ?? 5));
    return {
      totalValue,
      count: productsRows.length,
      purchasesMonth: purchases,
      consumptionMonth: consumption,
      topMaterials,
      lowStock
    };
  }, [productsRows, whDocs, monthStart, monthEnd]);

  const opsKpi = useMemo(
    () => ({
      activeBuilds: clientsRows.filter((c) => c.status === 'building').length,
      newClients: clientsInPeriod.length,
      incomeMonth: txFinanceKpiFixed.incomeMonth,
      materialsCount: productsRows.length
    }),
    [clientsRows, clientsInPeriod, txFinanceKpiFixed.incomeMonth, productsRows.length]
  );

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
    return shell(<div className="p-6 text-slate-500">{t.noCompany}</div>);
  }

  return shell(
    <>
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md shadow-sm ${
          dark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="max-w-[1680px] mx-auto px-3 sm:px-5 py-2 md:py-3 flex flex-col gap-2 md:gap-3">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-1.5 md:p-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shrink-0">
                <BarChart3 className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold tracking-tight truncate">{t.pageTitle}</h1>
                <p className={`text-[10px] md:text-xs truncate hidden sm:block ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.pageSubtitle}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setDark(!dark)} className={`p-2 rounded-xl border shrink-0 ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`} aria-label="Тема">
              {dark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
            <button type="button" onClick={() => load(true)} className={`p-2 rounded-xl border shrink-0 ${dark ? 'border-slate-700' : 'border-slate-200'}`} aria-label="Обновить">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openFilterSheet}
              className={`md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border shrink-0 ${dark ? 'border-violet-500 bg-violet-950 text-violet-200' : 'border-violet-300 bg-violet-50 text-violet-800'}`}
            >
              <Wrench className="w-4 h-4" />
              {t.filtersButton}
            </button>
            <div className="flex gap-1.5 md:gap-2 ml-auto shrink-0">
              <button type="button" onClick={exportCsv} className={`inline-flex items-center gap-1 px-2.5 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold border ${dark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </button>
              <button type="button" onClick={exportPdf} className="inline-flex items-center gap-1 px-2.5 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md">
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
          <div className={`hidden md:flex flex-wrap gap-2 p-2 rounded-xl ${dark ? 'bg-slate-800/80' : 'bg-slate-50'}`}>
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
              <option value="all">{t.allManagers}</option>
              <option value="none">{t.noManager}</option>
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
              <option value="all">{t.sourceAll}</option>
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
              <option value="all">{t.channelAll}</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">{t.channelInstagram}</option>
              <option value="other">{t.channelOther}</option>
            </select>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 touch-pan-x">
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

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="Закрыть" onClick={() => setMobileFiltersOpen(false)} />
          <div className={`relative rounded-t-2xl shadow-2xl max-h-[88vh] overflow-hidden flex flex-col ${dark ? 'bg-slate-900 border-t border-slate-700' : 'bg-white border-t border-slate-200'}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-violet-500" />
                {t.filtersTitle}
              </h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className={`p-2 rounded-lg ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} aria-label="Закрыть">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 min-h-0">
              <div>
                <label className={`block text-xs font-bold mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.periodLabel}</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className={`flex-1 min-w-[140px] rounded-xl px-3 py-2.5 text-sm border ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`} />
                  <span className="text-slate-500">—</span>
                  <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className={`flex-1 min-w-[140px] rounded-xl px-3 py-2.5 text-sm border ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`} />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.managerLabel}</label>
                <select value={draftManager} onChange={(e) => setDraftManager(e.target.value)} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <option value="all">{t.allManagers}</option>
                  <option value="none">{t.noManager}</option>
                  {managersList.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.sourceLabel}</label>
                <select value={draftSource} onChange={(e) => setDraftSource(e.target.value)} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <option value="all">{t.sourceAll}</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google">Google</option>
                  <option value="Звонок">Звонок</option>
                  <option value="Сайт">Сайт</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.channelLabel}</label>
                <select value={draftChannel} onChange={(e) => setDraftChannel(e.target.value)} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                  <option value="all">{t.channelAll}</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">{t.channelInstagram}</option>
                  <option value="other">{t.channelOther}</option>
                </select>
              </div>
            </div>
            <div className={`p-4 pt-2 border-t space-y-2 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <button type="button" onClick={applyFilterSheet} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-base shadow-lg">{t.applyFilters}</button>
              <button type="button" onClick={resetFilterSheet} className={`w-full py-2.5 rounded-xl text-sm font-semibold border ${dark ? 'border-slate-600 text-slate-300' : 'border-slate-300 text-slate-700'}`}>{t.resetFilters}</button>
            </div>
          </div>
        </div>
      )}

      {loading && !deals.length ? (
        <div className="flex justify-center py-32">
          <LoadingSpinner />
        </div>
      ) : (
        <div
          ref={reportRef}
          className="max-w-[1680px] mx-auto px-3 sm:px-5 py-4 md:py-6 space-y-8 md:space-y-10 pb-24"
        >
          <div className="md:hidden flex flex-wrap gap-2 py-2">
            {filterChips.map((c, i) => (
              <span
                key={`${c.key}-${i}`}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold max-w-full truncate border ${dark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'}`}
              >
                {c.text}
              </span>
            ))}
          </div>
          {/* Директорская панель */}
          <section id="sec-director" className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 justify-between">
              <div>
                <h2
                  className={`text-lg font-black tracking-tight flex items-center gap-2 ${
                    dark ? 'text-violet-300' : 'text-violet-700'
                  }`}
                >
                  <LayoutDashboard className="w-6 h-6" />
                  {t.directorPanel}
                </h2>
                <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t.directorPanelHint}
                </p>
              </div>
            </div>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin pl-1 pr-4 -mx-1 w-full touch-pan-x [scrollbar-width:thin]">
              {[
                {
                  label: t.applicationsToday,
                  value: directorKpi.leadsToday,
                  icon: Users,
                  grad: 'from-cyan-600 to-blue-700'
                },
                {
                  label: t.applicationsMonth,
                  value: kpi.leadsMonth,
                  icon: TrendingUp,
                  grad: 'from-blue-600 to-indigo-700'
                },
                {
                  label: t.applicationsPeriod,
                  value: directorKpi.leadsPeriod,
                  icon: BarChart3,
                  grad: 'from-indigo-600 to-violet-700'
                },
                {
                  label: t.dealsMonth,
                  value: kpi.dealsClosedMonth,
                  icon: Target,
                  grad: 'from-violet-600 to-purple-700'
                },
                {
                  label: t.dealsPeriod,
                  value: directorKpi.dealsClosedPeriod,
                  icon: Zap,
                  grad: 'from-fuchsia-600 to-pink-700'
                },
                {
                  label: t.revenueMonth,
                  value: `${(kpi.revenueMonth / 1000).toFixed(0)}k ₸`,
                  sub: kpi.revenueMonth.toLocaleString('ru-RU') + ' ₸',
                  icon: DollarSign,
                  grad: 'from-emerald-600 to-teal-700'
                },
                {
                  label: t.revenuePeriod,
                  value: `${(directorKpi.revenuePeriod / 1000).toFixed(0)}k ₸`,
                  sub: directorKpi.revenuePeriod.toLocaleString('ru-RU') + ' ₸',
                  icon: DollarSign,
                  grad: 'from-teal-600 to-cyan-700'
                },
                {
                  label: t.conversionLeadDeal,
                  value: `${directorKpi.convPct}%`,
                  icon: Percent,
                  grad: 'from-amber-600 to-orange-700'
                },
                {
                  label: t.avgCheck,
                  value: directorKpi.avgCheck ? directorKpi.avgCheck.toLocaleString('ru-RU') + ' ₸' : '—',
                  icon: Target,
                  grad: 'from-rose-600 to-red-800'
                },
                {
                  label: t.clientsWaiting,
                  value: clientsWaitingReply,
                  icon: Clock,
                  grad: 'from-red-600 to-rose-900'
                },
                {
                  label: t.unreadWhatsapp,
                  value: waKpi.unread,
                  icon: MessageCircle,
                  grad: 'from-green-600 to-emerald-900'
                }
              ].map((c) => (
                <div
                  key={c.label}
                  className={`min-w-[152px] sm:min-w-[168px] md:min-w-[188px] lg:min-w-0 lg:flex-1 snap-start rounded-2xl p-4 sm:p-5 text-white shadow-xl bg-gradient-to-br shrink-0 ${c.grad}`}
                >
                  <c.icon className="w-9 h-9 opacity-95 mb-3" />
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide opacity-90 leading-tight">
                    {c.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-black tabular-nums mt-2 leading-none">{c.value}</p>
                  {'sub' in c && c.sub && (
                    <p className="text-[10px] opacity-85 mt-1 truncate max-w-full">{c.sub}</p>
                  )}
                </div>
              ))}
            </div>
            <section
              className={`rounded-2xl border p-4 ${
                dark ? 'bg-red-950/40 border-red-900' : 'bg-red-50 border-red-200'
              }`}
            >
              <h3 className={`text-sm font-bold mb-3 ${dark ? 'text-red-300' : 'text-red-800'}`}>
                {t.unreadAlertTitle}
              </h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: t.unreadNow, v: unreadAlerts.now, tone: 'bg-red-600 text-white' },
                  { label: t.unread30m, v: unreadAlerts.u30, tone: 'bg-red-700 text-white' },
                  { label: t.unread60m, v: unreadAlerts.u60, tone: 'bg-red-900 text-white' }
                ].map((x) => (
                  <div key={x.label} className={`rounded-xl px-4 py-3 ${x.tone} shadow-lg`}>
                    <p className="text-xs font-semibold opacity-90">{x.label}</p>
                    <p className="text-3xl font-black mt-1 tabular-nums">{x.v}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>

          {/* Операционная аналитика */}
          <section id="sec-ops" className="space-y-3">
            <h2 className={`text-sm font-bold uppercase tracking-widest ${dark ? 'text-cyan-400' : 'text-cyan-700'}`}>
              {t.opsAnalytics}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x pl-1 pr-4 touch-pan-x">
              {[
                { label: t.activeBuilds, value: opsKpi.activeBuilds, icon: Building2, grad: 'from-amber-600 to-orange-700' },
                { label: t.newClients, value: opsKpi.newClients, icon: Users, grad: 'from-cyan-600 to-blue-700' },
                { label: t.incomeShort, value: `${(opsKpi.incomeMonth / 1000).toFixed(0)}k ₸`, sub: opsKpi.incomeMonth.toLocaleString('ru-RU') + ' ₸', icon: Wallet, grad: 'from-emerald-600 to-teal-700' },
                { label: t.materialsOnStock, value: opsKpi.materialsCount, icon: Package, grad: 'from-violet-600 to-indigo-700' }
              ].map((c) => (
                <div key={c.label} className={`min-w-[150px] snap-start rounded-2xl p-4 text-white bg-gradient-to-br shrink-0 ${c.grad}`}>
                  <c.icon className="w-7 h-7 mb-2 opacity-95" />
                  <p className="text-[10px] font-bold uppercase opacity-90">{c.label}</p>
                  <p className="text-2xl font-black mt-1">{c.value}</p>
                  {'sub' in c && c.sub && <p className="text-[10px] opacity-85 mt-0.5">{c.sub}</p>}
                </div>
              ))}
            </div>
          </section>

          {/* Строительство */}
          <section id="sec-construction" className="space-y-6">
            <h2 className={`text-sm font-bold uppercase tracking-widest ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
              {t.navConstruction}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x pl-1 pr-4">
              {[
                { l: t.clientsTotal, v: constructionKpi.total },
                { l: t.buildingNow, v: constructionKpi.building },
                { l: t.builtTotal, v: constructionKpi.built },
                { l: t.depositReceived, v: constructionKpi.depositStatus },
                { l: t.waitingBuild, v: constructionKpi.waiting },
                { l: t.buildingNowCard, v: constructionKpi.building },
                { l: t.completedMonth, v: constructionKpi.completedMonth },
                { l: t.newClientsMonth, v: constructionKpi.newMonth },
                { l: t.clientsWithDeposit, v: constructionKpi.withDeposit },
                { l: t.overdueProjects, v: constructionKpi.overdue }
              ].map((x) => (
                <div key={x.l} className={`min-w-[130px] snap-start rounded-xl border p-3 shrink-0 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <p className={`text-[9px] font-bold uppercase ${dark ? 'text-slate-500' : 'text-slate-500'}`}>{x.l}</p>
                  <p className="text-xl font-black tabular-nums">{x.v}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold mb-2">{t.newClientsByDay}</h3>
              <div className="w-full min-w-0" style={{ minHeight: chartHMain }}>
                <ResponsiveContainer width="100%" height={chartHMain} debounce={80}>
                  <LineChart data={clientsNewByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff' }} />
                    <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} name={t.newClients} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold mb-2">{t.completedHomesByMonth}</h3>
              <div className="w-full min-w-0" style={{ minHeight: chartHMain }}>
                <ResponsiveContainer width="100%" height={chartHMain} debounce={80}>
                  <BarChart data={builtByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name={t.builtTotal} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold p-4 pb-0">{t.activeBuildsTable}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                      {[t.colClient, t.colObject, t.colStatus, t.colProgress, t.colStart, t.colPlanEnd].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeBuildsRows.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t.noData}</td></tr>
                    ) : (
                      activeBuildsRows.map((r) => (
                        <tr key={r.id} className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <td className="py-2 px-3">{r.client}</td>
                          <td className="py-2 px-3">{r.object}</td>
                          <td className="py-2 px-3">{r.status}</td>
                          <td className="py-2 px-3 tabular-nums">{r.progress}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{r.start}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{r.planEnd}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Финансы (транзакции) */}
          <section id="sec-txfinance" className="space-y-6">
            <h2 className={`text-sm font-bold uppercase tracking-widest ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              {t.navTxFinance}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x pl-1 pr-4">
              {[
                { l: t.incomeToday, v: txFinanceKpiFixed.incomeToday.toLocaleString('ru-RU') + ' ₸' },
                { l: t.incomeMonth, v: txFinanceKpiFixed.incomeMonth.toLocaleString('ru-RU') + ' ₸' },
                { l: t.expenseMonth, v: txFinanceKpiFixed.expenseMonth.toLocaleString('ru-RU') + ' ₸' },
                { l: t.netProfit, v: txFinanceKpiFixed.netProfit.toLocaleString('ru-RU') + ' ₸' },
                { l: t.avgPayment, v: txFinanceKpiFixed.avgPayment.toLocaleString('ru-RU') + ' ₸' }
              ].map((x) => (
                <div key={x.l} className={`min-w-[140px] snap-start rounded-xl border p-3 shrink-0 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <p className={`text-[9px] font-bold uppercase ${dark ? 'text-slate-500' : 'text-slate-500'}`}>{x.l}</p>
                  <p className="text-sm font-black tabular-nums leading-tight mt-1">{x.v}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold mb-2">{t.incomeByDay}</h3>
              <div className="w-full min-w-0" style={{ minHeight: chartHMain }}>
                <ResponsiveContainer width="100%" height={chartHMain} debounce={80}>
                  <LineChart data={incomeByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ background: dark ? '#1e293b' : '#fff' }} formatter={(v: number) => [v.toLocaleString('ru-RU') + ' ₸', '']} />
                    <Line type="monotone" dataKey="sum" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold mb-2">{t.incomeByMonth}</h3>
              <div className="w-full min-w-0" style={{ minHeight: chartHMain }}>
                <ResponsiveContainer width="100%" height={chartHMain} debounce={80}>
                  <BarChart data={incomeByMonthChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: dark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip formatter={(v: number) => [v.toLocaleString('ru-RU') + ' ₸', '']} />
                    <Bar dataKey="sum" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold p-4 pb-0">{t.recentTx}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                      {[t.colDate, t.colClient, t.colType, t.colAmount, t.colComment].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxTable.map((r) => (
                      <tr key={r.id} className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <td className="py-2 px-3 whitespace-nowrap text-xs">{r.date}</td>
                        <td className="py-2 px-3 max-w-[120px] truncate">{r.client}</td>
                        <td className="py-2 px-3">{r.type}</td>
                        <td className="py-2 px-3 tabular-nums font-semibold">{r.amount.toLocaleString('ru-RU')} ₸</td>
                        <td className="py-2 px-3 max-w-[200px] truncate text-xs">{r.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Склад */}
          <section id="sec-warehouse" className="space-y-6">
            <h2 className={`text-sm font-bold uppercase tracking-widest ${dark ? 'text-lime-400' : 'text-lime-700'}`}>
              {t.navWarehouse}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x pl-1 pr-4">
              {[
                { l: t.warehouseValue, v: warehouseKpi.totalValue.toLocaleString('ru-RU') + ' ₸' },
                { l: t.materialsCount, v: warehouseKpi.count },
                { l: t.purchasesMonth, v: warehouseKpi.purchasesMonth.toLocaleString('ru-RU') + ' ₸' },
                { l: t.consumptionMonth, v: warehouseKpi.consumptionMonth.toLocaleString('ru-RU') + ' ₸' }
              ].map((x) => (
                <div key={x.l} className={`min-w-[150px] snap-start rounded-xl border p-3 shrink-0 ${dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <p className={`text-[9px] font-bold uppercase ${dark ? 'text-slate-500' : 'text-slate-500'}`}>{x.l}</p>
                  <p className="text-sm font-black mt-1">{x.v}</p>
                </div>
              ))}
            </div>
            <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold p-4 pb-0">{t.topMaterials}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                      {[t.colMaterial, t.colUsedMonth, t.colStock, t.colCost].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseKpi.topMaterials.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center text-slate-500">{t.noData}</td></tr>
                    ) : (
                      warehouseKpi.topMaterials.map((r, i) => (
                        <tr key={i} className={`border-b ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <td className="py-2 px-3 font-medium">{r.name}</td>
                          <td className="py-2 px-3 tabular-nums">{r.used.toLocaleString('ru-RU')}</td>
                          <td className="py-2 px-3 tabular-nums">{r.stock.toLocaleString('ru-RU')}</td>
                          <td className="py-2 px-3 tabular-nums">{r.cost.toLocaleString('ru-RU')} ₸</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {warehouseKpi.lowStock.length > 0 && (
              <div className={`rounded-2xl border p-4 ${dark ? 'bg-amber-950/40 border-amber-900' : 'bg-amber-50 border-amber-200'}`}>
                <h3 className={`font-bold mb-2 ${dark ? 'text-amber-200' : 'text-amber-900'}`}>{t.lowStockAlert}</h3>
                <ul className="text-sm space-y-1">
                  {warehouseKpi.lowStock.slice(0, 25).map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>{p.name}</span>
                      <span className="tabular-nums font-bold">{p.quantity} / мин. {p.minQuantity ?? 5}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* График заявок + воронка */}
          <section id="sec-leads" className="space-y-6">
            <div
              className={`rounded-2xl border p-5 shadow-sm w-full ${
                dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-base font-bold">{t.leadsChart}</h2>
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
                      {d === '1' ? t.today : d === '365' ? t.year : `${d}${t.days}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full min-w-0" style={{ minHeight: chartHMain }}>
                <ResponsiveContainer width="100%" height={chartHMain} debounce={80}>
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
                      name={t.leads}
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div
              className={`rounded-2xl border p-5 shadow-sm w-full ${
                dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h2 className="text-base font-bold mb-1">{t.funnelTitle}</h2>
              <p className={`text-xs mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t.funnelHint}</p>
              <div className="w-full min-w-0 shrink-0" style={{ minHeight: chartHMain }}>
                <ResponsiveContainer width="100%" height={chartHMain} debounce={80}>
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
                        `${v} ${t.dealsCount} · ${p.payload.pctFromPrev}% ${t.fromPrev}`,
                        t.stage
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} name={t.dealsClosed}>
                      {funnelData.map((e, i) => (
                        <Cell key={i} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Аналитика сообщений (WhatsApp) */}
          <section id="sec-messaging" className="space-y-6">
            <h2
              className={`text-xs font-bold uppercase tracking-widest ${
                dark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              {t.messagingTitle}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x mb-2 w-full">
              {[
                { label: t.incomingToday, v: waKpi.incomingToday, icon: MessageCircle },
                { label: t.dialogsToday, v: waKpi.convToday, icon: Users },
                { label: t.managerReplies, v: waKpi.replies, icon: Activity },
                { label: t.unread, v: waKpi.unread, icon: Radio },
                { label: t.avgReplyMin, v: waKpi.avgMin, icon: Zap }
              ].map((x) => (
                <div
                  key={x.label}
                  className={`min-w-[140px] snap-start rounded-2xl border p-4 shrink-0 ${
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
            <div
              className={`rounded-2xl border p-5 w-full ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <h3 className="font-bold mb-4">{t.messageActivity}</h3>
              <div className="w-full min-w-0" style={{ minHeight: chartHMsg }}>
                <ResponsiveContainer width="100%" height={chartHMsg} debounce={80}>
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
              className={`rounded-2xl border p-5 w-full ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <h3 className="font-bold mb-4">{t.dialogs}</h3>
              <div className="grid grid-cols-3 gap-2 text-center min-w-0">
                {[
                  { lbl: t.newToday, v: convMetrics.newConv, c: 'from-cyan-500 to-blue-600' },
                  { lbl: t.active, v: convMetrics.active, c: 'from-violet-500 to-purple-600' },
                  { lbl: t.closed, v: convMetrics.closed, c: 'from-slate-500 to-slate-700' }
                ].map((x) => (
                  <div
                    key={x.lbl}
                    className={`rounded-xl p-4 text-white bg-gradient-to-br ${x.c} shadow-lg`}
                  >
                    <p className="text-2xl font-black">{x.v}</p>
                    <p className="text-[10px] font-semibold mt-1 opacity-90">{x.lbl}</p>
                  </div>
                ))}
              </div>
            </div>
            <div
              className={`rounded-2xl border p-5 w-full ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <h3 className="font-bold mb-3">{t.msgDealConversion}</h3>
              <p className="text-sm">
                {t.incomingInPeriod}: <strong>{msgDealConversion.incoming}</strong>
              </p>
              <p className="text-sm">
                {t.dealsWithWa}: <strong>{msgDealConversion.dealsWa}</strong>
              </p>
              <p className="text-sm text-violet-600 dark:text-violet-400 font-bold mt-2">
                {t.conversionApprox} {msgDealConversion.rate}%
              </p>
            </div>
          </section>

          {/* Эффективность менеджеров */}
          <section id="sec-managers">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 text-indigo-500 dark:text-indigo-400">
              {t.managersPerformance}
            </h2>
            <div
              className={`rounded-2xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                      {[t.manager, t.leads, t.dealsClosed, t.revenue, t.messagesHandled, t.avgResponseMin].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-bold uppercase whitespace-nowrap">
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

          {/* Источники лидов + Финансы */}
          <section id="sec-sources" className="grid lg:grid-cols-2 gap-6 w-full">
            <div
              className={`rounded-2xl border p-5 min-w-0 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <PieIcon className="w-5 h-5 shrink-0" /> {t.leadSources}
              </h3>
              <div className="w-full min-w-0 shrink-0" style={{ minHeight: chartHPie }}>
                <ResponsiveContainer width="100%" height={chartHPie} debounce={80}>
                  <PieChart>
                    <Pie
                      data={sourcePie.length ? sourcePie : [{ name: t.noData, value: 1 }]}
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
            <div id="sec-finance" className={`rounded-2xl border p-5 min-w-0 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 shrink-0" /> {t.financePlanFact}
              </h3>
              <input
                type="number"
                placeholder={t.planPlaceholder}
                className={`w-full rounded-xl border px-4 py-3 text-sm mb-3 ${dark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
                value={salesTarget || ''}
                onChange={(e) => setSalesTarget(Number(e.target.value) || 0)}
              />
              <button
                type="button"
                onClick={saveTarget}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold mb-4"
              >
                {t.savePlan}
              </button>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{t.fact}</p>
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
                    {Math.round((kpi.revenueMonth / salesTarget) * 100)}% {t.planPercent}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* 11 Live */}
          <section id="sec-live">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-rose-500">
              <Radio className="w-4 h-4 animate-pulse" /> {t.liveMonitoring}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { l: t.messages10min, v: liveMetrics.msg10 },
                { l: t.activeDialogs, v: liveMetrics.activeConv },
                { l: t.withUnread, v: liveMetrics.unreadConv },
                { l: t.leadsHour, v: liveMetrics.leadsHour }
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
              className={`rounded-2xl border max-h-[360px] overflow-y-auto overflow-x-auto ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
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
                  {t.noMessages10m}
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
