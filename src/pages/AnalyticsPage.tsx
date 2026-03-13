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
  type DealRow,
  type MessageRow,
  type ConversationRow
} from '../lib/firebase/analyticsDashboard';
import { useCompanyId } from '../contexts/CompanyContext';
import { listPipelines, listStages } from '../lib/firebase/deals';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MS_DAY = 86400000;
const COLORS_PIE = ['#ec4899', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#94a3b8'];
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

export const AnalyticsPage: React.FC = () => {
  const companyId = useCompanyId();
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [stageNames, setStageNames] = useState<{ id: string; name: string }[]>([]);
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

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [d, c, pipelines] = await Promise.all([
        fetchDealsForCompany(companyId),
        fetchConversationsForCompany(companyId),
        listPipelines(companyId)
      ]);
      setDeals(d);
      setConversations(c);
      const pid = pipelines[0]?.id;
      if (pid) {
        const stages = await listStages(companyId, pid);
        setStageNames(stages.map((s) => ({ id: s.id, name: s.name })));
      } else setStageNames([]);
      const since = Date.now() - 400 * MS_DAY;
      const msg = await fetchMessagesSince(companyId, since);
      setMessages(msg);
      if (msg.length === 0 && d.length > 0) {
        toast('Сообщения WhatsApp за период не загружены (нужен индекс Firestore: whatsappMessages companyId + createdAt)', {
          duration: 6000
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const fromMs = useMemo(() => new Date(dateFrom).getTime(), [dateFrom]);
  const toMs = useMemo(() => new Date(dateTo).getTime() + MS_DAY - 1, [dateTo]);

  const dealsActive = useMemo(
    () => deals.filter((x) => !x.deletedAt),
    [deals]
  );

  const dealsFiltered = useMemo(() => {
    return dealsActive.filter((d) => {
      if (managerId !== 'all') {
        if (managerId === 'none' && d.responsibleUserId) return false;
        if (managerId !== 'none' && d.responsibleUserId !== managerId) return false;
      }
      if (sourceFilter !== 'all' && (d.source || 'Ручной') !== sourceFilter) return false;
      if (channelFilter === 'whatsapp' && !d.whatsappConversationId) return false;
      if (channelFilter === 'other' && d.whatsappConversationId) return false;
      return true;
    });
  }, [dealsActive, managerId, sourceFilter, channelFilter]);

  const managers = useMemo(() => {
    const m = new Map<string, number>();
    dealsActive.forEach((d) => {
      if (d.responsibleUserId) m.set(d.responsibleUserId, (m.get(d.responsibleUserId) || 0) + 1);
    });
    return Array.from(m.keys());
  }, [dealsActive]);

  const now = Date.now();
  const todayStart = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const kpi = useMemo(() => {
    const leadsToday = dealsFiltered.filter(
      (d) => d.createdAt >= todayStart && d.createdAt <= now
    ).length;
    const leadsMonth = dealsFiltered.filter(
      (d) => d.createdAt >= monthStart && d.createdAt <= monthEnd
    ).length;
    const dealsMonth = dealsFiltered.filter(
      (d) => d.createdAt >= monthStart && d.createdAt <= monthEnd
    ).length;
    const revenueMonth = dealsFiltered
      .filter((d) => d.createdAt >= monthStart && d.createdAt <= monthEnd)
      .reduce((s, d) => s + d.amount, 0);
    const wonStages = stageNames.length;
    const firstStageId = stageNames[0]?.id;
    const wonApprox =
      dealsFiltered.filter((d) => stageNames.some((s, i) => i >= stageNames.length - 2 && d.stageId === s.id))
        .length || dealsFiltered.filter((d) => d.amount > 0).length;
    const created = dealsFiltered.length;
    const conversion = created ? Math.min(100, Math.round((wonApprox / Math.max(1, created)) * 100)) : 0;
    const avgDeal =
      dealsFiltered.length > 0
        ? Math.round(
            dealsFiltered.reduce((s, d) => s + d.amount, 0) / dealsFiltered.length
          )
        : 0;
    return {
      leadsToday,
      leadsMonth,
      dealsMonth,
      revenueMonth,
      conversion,
      avgDeal,
      firstStageId
    };
  }, [dealsFiltered, stageNames, todayStart, monthStart, monthEnd]);

  const funnelData = useMemo(() => {
    if (!stageNames.length) {
      return [
        { name: 'Новый лид', value: 0, rate: 100 },
        { name: 'Контакт', value: 0, rate: 0 },
        { name: 'Замер', value: 0, rate: 0 },
        { name: 'Смета', value: 0, rate: 0 },
        { name: 'Договор', value: 0, rate: 0 },
        { name: 'Оплата', value: 0, rate: 0 }
      ];
    }
    const base = dealsFiltered.filter((d) => d.createdAt >= fromMs && d.createdAt <= toMs).length;
    let prev = Math.max(1, base);
    return stageNames.slice(0, 8).map((s, i) => {
      const count = dealsFiltered.filter((d) => d.stageId === s.id).length;
      const rate = i === 0 ? 100 : Math.round((count / prev) * 100);
      prev = Math.max(1, count);
      return { name: s.name, value: count, rate };
    });
  }, [stageNames, dealsFiltered, fromMs, toMs]);

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
      const t = start + i * MS_DAY;
      map.set(startOfDay(new Date(t)).toString(), 0);
    }
    dealsFiltered.forEach((d) => {
      if (d.createdAt < start || d.createdAt > now) return;
      const key = startOfDay(new Date(d.createdAt)).toString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => ({ date: fmtDate(Number(k)), leads: v }));
  }, [dealsFiltered, leadsRange, now]);

  const messagesInRange = useMemo(
    () => messages.filter((m) => !m.system && m.createdAt >= fromMs && m.createdAt <= toMs),
    [messages, fromMs, toMs]
  );

  const waKpi = useMemo(() => {
    const incomingToday = messages.filter(
      (m) => m.direction === 'incoming' && !m.system && m.createdAt >= todayStart
    ).length;
    const convToday = new Set(
      messages
        .filter((m) => m.createdAt >= todayStart)
        .map((m) => m.conversationId)
    ).size;
    const replies = messages.filter((m) => m.direction === 'outgoing' && !m.system && m.createdAt >= todayStart)
      .length;
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
    const avgMs =
      pairs.length > 0 ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 0;
    const avgMin = Math.round(avgMs / 60000);
    return {
      incomingToday,
      convToday,
      replies,
      unread,
      avgMin
    };
  }, [messages, conversations, todayStart]);

  const messagesPerDay = useMemo(() => {
    const days = 30;
    const start = Date.now() - days * MS_DAY;
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      map.set(startOfDay(new Date(start + i * MS_DAY)).toString(), 0);
    }
    messages.forEach((m) => {
      if (m.system || m.direction !== 'incoming') return;
      if (m.createdAt < start) return;
      const key = startOfDay(new Date(m.createdAt)).toString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => ({ date: fmtDate(Number(k)), incoming: v }));
  }, [messages]);

  const convMetrics = useMemo(() => {
    const newConv = conversations.filter((c) => c.createdAt >= todayStart).length;
    const active = conversations.filter((c) => c.status === 'active').length;
    const closed = conversations.filter((c) => c.status === 'closed' || c.status === 'archived').length;
    return { newConv, active, closed };
  }, [conversations, todayStart]);

  const managerTable = useMemo(() => {
    const rows: Record<
      string,
      { handled: number; replies: number; times: number[] }
    > = {};
    messagesInRange.forEach((m) => {
      const key = m.conversationId;
      if (!rows[key]) rows[key] = { handled: 0, replies: 0, times: [] };
      if (m.direction === 'incoming') rows[key].handled++;
      if (m.direction === 'outgoing') rows[key].replies++;
    });
    const byMgr = new Map<string, { messages: number; replies: number; times: number[] }>();
    dealsFiltered.forEach((d) => {
      const id = d.responsibleUserId || '—';
      if (!byMgr.has(id)) byMgr.set(id, { messages: 0, replies: 0, times: [] });
    });
    messagesInRange.forEach((m) => {
      const conv = conversations.find((c) => c.id === m.conversationId);
      const deal = dealsFiltered.find((d) => d.whatsappConversationId === m.conversationId);
      const mgr = deal?.responsibleUserId || '—';
      const row = byMgr.get(mgr) || { messages: 0, replies: 0, times: [] };
      if (m.direction === 'incoming') row.messages++;
      if (m.direction === 'outgoing') row.replies++;
      byMgr.set(mgr, row);
    });
    const arr = Array.from(byMgr.entries()).map(([id, v]) => ({
      manager: id === '—' ? 'Не назначен' : id.slice(0, 8) + '…',
      handled: v.messages,
      replies: v.replies,
      avgMin:
        v.times.length > 0
          ? Math.round(v.times.reduce((a, b) => a + b, 0) / v.times.length / 60000)
          : waKpi.avgMin
    }));
    return arr.length ? arr : [{ manager: '—', handled: 0, replies: 0, avgMin: waKpi.avgMin }];
  }, [messagesInRange, dealsFiltered, conversations, waKpi.avgMin]);

  const msgDealConversion = useMemo(() => {
    const incoming = messagesInRange.filter((m) => m.direction === 'incoming').length;
    const withDeal = new Set(
      dealsFiltered.filter((d) => d.whatsappConversationId).map((d) => d.whatsappConversationId)
    ).size;
    const dealsFromWa = dealsFiltered.filter((d) => d.whatsappConversationId).length;
    const rate = incoming > 0 ? Math.round((dealsFromWa / Math.max(1, conversations.length)) * 100) : 0;
    return { incoming, dealsFromWa, rate, withDeal };
  }, [messagesInRange, dealsFiltered, conversations.length]);

  const unreadAlerts = useMemo(() => {
    const nowT = Date.now();
    let u30 = 0;
    let u60 = 0;
    conversations.forEach((c) => {
      if (c.unreadCount <= 0) return;
      const lastIn = c.lastIncomingAt || c.createdAt;
      const ageMin = (nowT - lastIn) / 60000;
      if (ageMin > 30) u30 += c.unreadCount;
      if (ageMin > 60) u60 += c.unreadCount;
    });
    return {
      now: conversations.reduce((s, c) => s + c.unreadCount, 0),
      u30,
      u60
    };
  }, [conversations]);

  const sourcePie = useMemo(() => {
    const map = new Map<string, number>();
    const labels = ['Instagram', 'Google', 'WhatsApp', 'Referral', 'Kaspi', 'Другое'];
    dealsFiltered.forEach((d) => {
      const s = (d.source || 'Другое').toLowerCase();
      let key = 'Другое';
      if (s.includes('whatsapp') || s.includes('wa')) key = 'WhatsApp';
      else if (s.includes('google')) key = 'Google';
      else if (s.includes('insta')) key = 'Instagram';
      else if (s.includes('refer') || s.includes('рекоменд')) key = 'Referral';
      else if (s.includes('kaspi')) key = 'Kaspi';
      else if (d.source && labels.includes(d.source)) key = d.source;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [dealsFiltered]);

  const saveTarget = () => {
    localStorage.setItem(STORAGE_TARGET, String(salesTarget));
    toast.success('План сохранён');
  };

  const exportCsv = () => {
    const lines = [
      ['Метрика', 'Значение'],
      ['Лиды сегодня', String(kpi.leadsToday)],
      ['Лиды месяц', String(kpi.leadsMonth)],
      ['Выручка месяц', String(kpi.revenueMonth)],
      ['Входящие WA сегодня', String(waKpi.incomingToday)],
      ['Непрочитано', String(waKpi.unread)]
    ];
    const blob = new Blob([lines.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-${companyId}-${dateFrom}.csv`;
    a.click();
    toast.success('CSV скачан');
  };

  const exportPdf = async () => {
    if (!reportRef.current) return;
    toast.loading('PDF…', { id: 'pdf' });
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 1.2, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      let y = 0;
      let left = 0;
      if (h > pdf.internal.pageSize.getHeight()) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      } else {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      }
      pdf.save(`analytics-${dateFrom}.pdf`);
      toast.success('PDF готов', { id: 'pdf' });
    } catch {
      toast.error('PDF ошибка', { id: 'pdf' });
    }
  };

  if (!companyId) {
    return <div className="p-4 text-slate-500">Компания не выбрана</div>;
  }

  return (
    <div className="min-h-full bg-slate-100 pb-8">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2">
          <BarChart3 className="w-6 h-6 text-emerald-600 shrink-0" />
          <h1 className="text-lg font-bold text-slate-900">Аналитика CRM</h1>
          <button
            type="button"
            onClick={load}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            aria-label="Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex flex-wrap gap-2 ml-auto items-center">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            />
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm max-w-[140px]"
            >
              <option value="all">Все менеджеры</option>
              <option value="none">Без менеджера</option>
              {managers.map((id) => (
                <option key={id} value={id}>
                  {id.slice(0, 10)}…
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">Все источники</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Звонок">Звонок</option>
              <option value="Сайт">Сайт</option>
              <option value="Ручной">Ручной</option>
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="all">Все каналы</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="other">Без WA</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {loading && !deals.length ? (
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      ) : (
        <div ref={reportRef} className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 space-y-8">
          {/* KPI */}
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              Обзор KPI
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin -mx-1 px-1">
              {[
                { label: 'Лиды сегодня', value: kpi.leadsToday, tone: 'bg-emerald-50 border-emerald-200' },
                { label: 'Лиды за месяц', value: kpi.leadsMonth, tone: 'bg-white border-slate-200' },
                { label: 'Сделок за месяц', value: kpi.dealsMonth, tone: 'bg-white border-slate-200' },
                {
                  label: 'Выручка за месяц',
                  value: `${kpi.revenueMonth.toLocaleString('ru-RU')} ₸`,
                  tone: 'bg-amber-50 border-amber-200'
                },
                { label: 'Конверсия %', value: kpi.conversion, tone: 'bg-violet-50 border-violet-200' },
                {
                  label: 'Средний чек',
                  value: `${kpi.avgDeal.toLocaleString('ru-RU')} ₸`,
                  tone: 'bg-white border-slate-200'
                }
              ].map((c) => (
                <div
                  key={c.label}
                  className={`min-w-[140px] sm:min-w-[160px] snap-start rounded-xl border p-4 shadow-sm ${c.tone}`}
                >
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">{c.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{c.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Funnel + Leads chart */}
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Воронка продаж</h2>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, n: string, p: { payload: { rate: number } }) => [`${v} (${p.payload.rate}%)`, 'Сделок']} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} name="Сделок" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-sm font-bold text-slate-800">Лиды по дням</h2>
                <div className="flex gap-1 flex-wrap">
                  {(['1', '7', '30', '90', '365'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLeadsRange(d)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        leadsRange === d ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d === '1' ? 'Сегодня' : d === '365' ? 'Год' : `${d} дн.`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={leadsDays}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" stroke="#059669" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* WhatsApp KPI */}
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              WhatsApp
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x -mx-1 px-1">
              {[
                { label: 'Входящие сегодня', value: waKpi.incomingToday },
                { label: 'Диалогов сегодня', value: waKpi.convToday },
                { label: 'Ответов менеджеров', value: waKpi.replies },
                { label: 'Непрочитано', value: waKpi.unread },
                { label: 'Ср. время ответа (мин)', value: waKpi.avgMin }
              ].map((c) => (
                <div
                  key={c.label}
                  className="min-w-[130px] snap-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[10px] font-semibold text-slate-500 uppercase leading-tight">{c.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{c.value}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Входящие сообщения / день</h2>
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={messagesPerDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="incoming" stroke="#25D366" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Диалоги</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-800">{convMetrics.newConv}</p>
                  <p className="text-xs text-emerald-700 font-medium">Новые сегодня</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-4 border border-sky-100">
                  <p className="text-2xl font-bold text-sky-800">{convMetrics.active}</p>
                  <p className="text-xs text-sky-700 font-medium">Активные</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-4 border border-slate-200">
                  <p className="text-2xl font-bold text-slate-700">{convMetrics.closed}</p>
                  <p className="text-xs text-slate-600 font-medium">Закрытые</p>
                </div>
              </div>
            </section>
          </div>

          {/* Manager table */}
          <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm overflow-hidden">
            <h2 className="text-sm font-bold text-slate-800 mb-4">Ответы менеджеров</h2>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 text-xs uppercase">
                    <th className="py-2 pr-4">Менеджер</th>
                    <th className="py-2 pr-4">Входящих (оценка)</th>
                    <th className="py-2 pr-4">Исходящих</th>
                    <th className="py-2">Ср. ответ (мин)</th>
                  </tr>
                </thead>
                <tbody>
                  {managerTable.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium">{r.manager}</td>
                      <td className="py-2 pr-4 tabular-nums">{r.handled}</td>
                      <td className="py-2 pr-4 tabular-nums">{r.replies}</td>
                      <td className="py-2 tabular-nums">{r.avgMin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Сообщения → сделки</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-600">Входящих в периоде</span>
                  <span className="font-bold">{msgDealConversion.incoming}</span>
                </li>
                <li className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-600">Сделок с WhatsApp</span>
                  <span className="font-bold">{msgDealConversion.dealsFromWa}</span>
                </li>
                <li className="flex justify-between py-2">
                  <span className="text-slate-600">Оценка конверсии</span>
                  <span className="font-bold text-emerald-700">{msgDealConversion.rate}%</span>
                </li>
              </ul>
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Непрочитанные</h2>
              <ul className="space-y-3">
                <li className="flex justify-between items-center rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <span className="font-medium text-red-900">Сейчас непрочитано</span>
                  <span className="text-xl font-bold text-red-700">{unreadAlerts.now}</span>
                </li>
                <li className="flex justify-between items-center rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <span className="font-medium text-amber-900">&gt; 30 мин с входящего</span>
                  <span className="text-xl font-bold text-amber-800">{unreadAlerts.u30}</span>
                </li>
                <li className="flex justify-between items-center rounded-xl bg-slate-100 border border-slate-200 px-4 py-3">
                  <span className="font-medium text-slate-800">&gt; 1 час</span>
                  <span className="text-xl font-bold text-slate-700">{unreadAlerts.u60}</span>
                </li>
              </ul>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4">Источники лидов</h2>
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourcePie.length ? sourcePie : [{ name: 'Нет данных', value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Target className="w-4 h-4" /> План vs факт (месяц)
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">План выручки (₸)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      value={salesTarget || ''}
                      onChange={(e) => setSalesTarget(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={saveTarget}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">Факт за текущий месяц</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {kpi.revenueMonth.toLocaleString('ru-RU')} ₸
                  </p>
                  {salesTarget > 0 && (
                    <>
                      <div className="mt-3 h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round((kpi.revenueMonth / salesTarget) * 100))}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Выполнение:{' '}
                        {Math.round((kpi.revenueMonth / salesTarget) * 100)}% от плана
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
