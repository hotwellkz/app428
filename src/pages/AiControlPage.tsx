import React, { useEffect, useMemo, useState } from 'react';
import { PageMetadata } from '../components/PageMetadata';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { subscribeCrmAiBots } from '../lib/firebase/crmAiBots';
import {
  subscribeWhatsappAiBotRuns,
  type WhatsAppAiBotRunRecord
} from '../lib/firebase/whatsappAiBotRuns';
import {
  subscribeWhatsappAiRunWorkflow,
  upsertWhatsappAiRunWorkflow,
  type WhatsAppAiRunWorkflowRecord
} from '../lib/firebase/whatsappAiRunWorkflow';
import type { CrmAiBot } from '../types/crmAiBot';
import {
  DEFAULT_AI_CONTROL_FILTERS,
  type AiControlFiltersState,
  type AiControlPeriodPreset,
  type AiRunWorkflowResolutionType,
  type AiRunWorkflowStatus
} from '../types/aiControl';
import { AiControlFilters } from '../components/ai-control/AiControlFilters';
import { AiRunList } from '../components/ai-control/AiRunList';
import {
  computeAggregatedStatus,
  computeRunResultFlags,
  runCreatedAtMs
} from '../lib/aiControl/aggregateAiRun';
import type { AiControlAggregatedStatus } from '../types/aiControl';
import { deriveAiRunListPresentation } from '../lib/ai-control/deriveAiRunListPresentation';
import { deriveAiRunWorkflow } from '../lib/ai-control/deriveAiRunWorkflow';
import { auth } from '../lib/firebase/auth';

function periodBounds(
  period: AiControlPeriodPreset,
  customFrom: string,
  customTo: string
): { from: number; to: number } {
  const now = new Date();
  const end = now.getTime();
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  switch (period) {
    case 'today':
      return { from: startOfToday(), to: end + 1 };
    case 'yesterday': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      const from = d.getTime();
      const e = new Date(d);
      e.setHours(23, 59, 59, 999);
      return { from, to: e.getTime() };
    }
    case '7d':
      return { from: end - 7 * 86400000, to: end + 1 };
    case '30d':
      return { from: end - 30 * 86400000, to: end + 1 };
    case 'custom': {
      const f = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : end - 30 * 86400000;
      const t = customTo
        ? new Date(customTo + 'T23:59:59').getTime()
        : end;
      return { from: f, to: t };
    }
    default:
      return { from: 0, to: end + 1 };
  }
}

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && v && 'toMillis' in (v as { toMillis?: unknown })) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  return null;
}

function applyFilters(
  runs: WhatsAppAiBotRunRecord[],
  filters: AiControlFiltersState,
  botsById: Record<string, CrmAiBot>,
  workflowByRunId: Record<string, WhatsAppAiRunWorkflowRecord>,
  currentUserId: string | null
): WhatsAppAiBotRunRecord[] {
  const { from, to } = periodBounds(filters.period, filters.customFrom, filters.customTo);
  const q = filters.search.trim().toLowerCase();

  return runs.filter((run) => {
    const ms = runCreatedAtMs(run);
    if (ms && (ms < from || ms > to)) return false;

    if (filters.botId && run.botId !== filters.botId) return false;

    if (filters.channel) {
      const botCh = botsById[run.botId]?.channel;
      const rCh = run.channel || botCh || '';
      if (filters.channel === 'whatsapp' && rCh !== 'whatsapp') return false;
      if (filters.channel === 'instagram' && rCh !== 'instagram') return false;
      if (filters.channel === 'site' && rCh !== 'site') return false;
    }

    const agg = computeAggregatedStatus(run);
    if (filters.statusBucket && agg !== filters.statusBucket) return false;

    const flags = computeRunResultFlags(run);
    const p = deriveAiRunListPresentation(run, agg);
    const w = deriveAiRunWorkflow(p.requiresAttention, workflowByRunId[run.id] ?? null);
    switch (filters.result) {
      case 'deal_created':
        if (!flags.hasDealCreate) return false;
        break;
      case 'task_created':
        if (!flags.hasTaskCreate) return false;
        break;
      case 'crm_updated':
        if (!flags.hasCrmApply) return false;
        break;
      case 'reply_only':
        if (!flags.hasAiReply || flags.hasCrmApply || flags.hasDealCreate || flags.hasTaskCreate) return false;
        break;
      case 'no_changes':
        if (flags.hasCrmApply || flags.hasDealCreate || flags.hasTaskCreate) return false;
        break;
      default:
        break;
    }

    if (filters.runtimeMode) {
      const m = (run.runtimeMode || run.mode || '').toLowerCase();
      if (filters.runtimeMode === 'off' && m !== 'off') return false;
      if (filters.runtimeMode === 'draft' && m !== 'draft') return false;
      if (filters.runtimeMode === 'auto' && m !== 'auto') return false;
      if (filters.runtimeMode === 'deal_create' && m !== 'deal_create') return false;
      if (filters.runtimeMode === 'task_create' && m !== 'task_create') return false;
    }

    if (filters.presetView === 'errors' && p.runStatus !== 'error') return false;
    if (filters.presetView === 'attention' && !p.requiresAttention) return false;
    if (filters.presetView === 'deals' && !p.hasDeal) return false;
    if (filters.presetView === 'tasks' && !p.hasTask) return false;

    if (filters.onlyErrors && p.runStatus !== 'error') return false;
    if (filters.onlySkipped && p.runStatus !== 'skipped') return false;
    if (filters.onlySnapshot && !p.hasSnapshot) return false;
    if (filters.onlyFallback && !p.isFallback) return false;
    if (filters.onlyCrmApply && !p.hasApply) return false;
    if (filters.onlyWithDeal && !p.hasDeal) return false;
    if (filters.onlyWithTask && !p.hasTask) return false;
    if (filters.workflowFilter !== 'all' && w.status !== filters.workflowFilter) return false;
    if (filters.onlyMine && (!currentUserId || workflowByRunId[run.id]?.assigneeId !== currentUserId)) return false;
    if (filters.onlyNewProblem && !w.isNewProblem) return false;

    if (q) {
      const botName = (botsById[run.botId]?.name ?? '').toLowerCase();
      const rAny = run as unknown as Record<string, unknown>;
      const hay = [
        run.id,
        run.conversationId,
        run.botId,
        run.dealId,
        run.createdDealId,
        run.taskId,
        run.appliedClientId,
        run.clientIdSnapshot,
        run.phoneSnapshot,
        botName,
        run.answerSnapshot,
        run.generatedReply,
        run.summarySnapshot,
        run.extractedSummary,
        run.extractedSnapshotJson,
        run.reason,
        run.createdDealTitle,
        run.taskRecommendationTitle,
        run.dealDraftTitle,
        run.dealCreateReason,
        run.taskCreateReason,
        Array.isArray(run.dealRoutingWarnings) ? run.dealRoutingWarnings.join(' ') : '',
        typeof rAny.clientNameSnapshot === 'string' ? rAny.clientNameSnapshot : '',
        typeof rAny.clientName === 'string' ? rAny.clientName : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function sortRuns(
  runs: WhatsAppAiBotRunRecord[],
  filters: AiControlFiltersState,
  aggregated: Record<string, AiControlAggregatedStatus>
): WhatsAppAiBotRunRecord[] {
  const list = [...runs];
  list.sort((a, b) => {
    const ams = runCreatedAtMs(a);
    const bms = runCreatedAtMs(b);
    if (filters.sortBy === 'newest') return bms - ams;

    const ap = deriveAiRunListPresentation(a, aggregated[a.id] ?? 'skipped');
    const bp = deriveAiRunListPresentation(b, aggregated[b.id] ?? 'skipped');
    if (filters.sortBy === 'problem_first') {
      if (ap.requiresAttention !== bp.requiresAttention) return ap.requiresAttention ? -1 : 1;
      return bms - ams;
    }
    const aDealTask = (ap.hasDeal ? 1 : 0) + (ap.hasTask ? 1 : 0);
    const bDealTask = (bp.hasDeal ? 1 : 0) + (bp.hasTask ? 1 : 0);
    if (aDealTask !== bDealTask) return bDealTask - aDealTask;
    return bms - ams;
  });
  return list;
}

function metricsFor(
  runs: WhatsAppAiBotRunRecord[],
  agg: Record<string, AiControlAggregatedStatus>,
  workflowByRunId: Record<string, WhatsAppAiRunWorkflowRecord>
) {
  let success = 0,
    warning = 0,
    error = 0,
    crm = 0,
    deals = 0,
    tasks = 0,
    draft = 0,
    auto = 0;
  for (const r of runs) {
    const a = agg[r.id] ?? 'skipped';
    if (a === 'success' || a === 'partial') success++;
    if (a === 'warning') warning++;
    if (a === 'error') error++;
    const f = computeRunResultFlags(r);
    if (f.hasCrmApply) crm++;
    if (f.hasDealCreate) deals++;
    if (f.hasTaskCreate) tasks++;
    if (f.isDraftMode) draft++;
    if (f.isAutoMode) auto++;
  }
  let newProblem = 0,
    inProgress = 0,
    escalated = 0,
    resolvedToday = 0;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();
  for (const r of runs) {
    const p = deriveAiRunListPresentation(r, agg[r.id] ?? 'skipped');
    const wf = deriveAiRunWorkflow(p.requiresAttention, workflowByRunId[r.id] ?? null);
    if (wf.isNewProblem) newProblem++;
    if (wf.status === 'in_progress') inProgress++;
    if (wf.status === 'escalated') escalated++;
    if (wf.status === 'resolved') {
      const ms = tsToMs(workflowByRunId[r.id]?.resolvedAt);
      if (ms != null && ms >= startMs) resolvedToday++;
    }
  }
  return {
    total: runs.length,
    success,
    warning,
    error,
    crm,
    deals,
    tasks,
    draft,
    auto,
    newProblem,
    inProgress,
    escalated,
    resolvedToday
  };
}

export const AiControlPage: React.FC = () => {
  const companyId = useCompanyId();
  const { canAccess } = useCurrentCompanyUser();
  const user = auth.currentUser;
  const can = canAccess('autovoronki');
  const [runs, setRuns] = useState<WhatsAppAiBotRunRecord[]>([]);
  const [workflow, setWorkflow] = useState<WhatsAppAiRunWorkflowRecord[]>([]);
  const [bots, setBots] = useState<CrmAiBot[]>([]);
  const [workflowBusy, setWorkflowBusy] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<AiControlFiltersState>(DEFAULT_AI_CONTROL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !can) {
      setRuns([]);
      setBots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const unsubRuns = subscribeWhatsappAiBotRuns(
      companyId,
      (list) => {
        setRuns(list);
        setLoading(false);
      },
      (e) => {
        setErr(e instanceof Error ? e.message : 'Ошибка загрузки журнала');
        setLoading(false);
      }
    );
    const unsubBots = subscribeCrmAiBots(companyId, setBots);
    const unsubWorkflow = subscribeWhatsappAiRunWorkflow(companyId, setWorkflow);
    return () => {
      unsubRuns();
      unsubBots();
      unsubWorkflow();
    };
  }, [companyId, can]);

  const botsById = useMemo(() => Object.fromEntries(bots.map((b) => [b.id, b])), [bots]);
  const botNames = useMemo(() => Object.fromEntries(bots.map((b) => [b.id, b.name])), [bots]);
  const workflowByRunId = useMemo(() => Object.fromEntries(workflow.map((w) => [w.runId, w])), [workflow]);

  const aggregated = useMemo(() => {
    const m: Record<string, AiControlAggregatedStatus> = {};
    for (const r of runs) m[r.id] = computeAggregatedStatus(r);
    return m;
  }, [runs]);

  const filteredRaw = useMemo(
    () => applyFilters(runs, filters, botsById, workflowByRunId, user?.uid ?? null),
    [runs, filters, botsById, workflowByRunId, user?.uid]
  );
  const filtered = useMemo(() => sortRuns(filteredRaw, filters, aggregated), [filteredRaw, filters, aggregated]);
  const metrics = useMemo(() => metricsFor(filtered, aggregated, workflowByRunId), [filtered, aggregated, workflowByRunId]);

  const updateRunWorkflow = async (
    runId: string,
    patch: Partial<WhatsAppAiRunWorkflowRecord> & { status?: AiRunWorkflowStatus; resolutionType?: AiRunWorkflowResolutionType }
  ) => {
    if (!companyId) return;
    const currentName = user?.displayName || user?.email || 'Пользователь';
    setWorkflowBusy((prev) => ({ ...prev, [runId]: true }));
    try {
      await upsertWhatsappAiRunWorkflow(companyId, runId, {
        ...patch,
        updatedBy: currentName
      });
    } finally {
      setWorkflowBusy((prev) => ({ ...prev, [runId]: false }));
    }
  };

  if (!can) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Нет доступа к разделу.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50/80 p-4 sm:p-6 max-w-7xl mx-auto">
      <PageMetadata title="AI-контроль — журнал автоворонок" description="Срабатывания AI в WhatsApp" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI-контроль</h1>
        <p className="text-sm text-gray-600 mt-1">
          Журнал срабатываний AI в чатах: ответы, извлечение данных, CRM, сделки и задачи.
        </p>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-100">
          {err}
          <p className="text-xs mt-1 text-red-600">
            Нужен составной индекс Firestore: companyId + createdAt (desc). Выполните deploy индексов.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        {[
          { k: 'Всего', v: metrics.total },
          { k: 'Успех', v: metrics.success },
          { k: 'Внимание', v: metrics.warning },
          { k: 'Ошибки', v: metrics.error },
          { k: 'CRM apply', v: metrics.crm },
          { k: 'Сделки', v: metrics.deals },
          { k: 'Задачи', v: metrics.tasks },
          { k: 'Draft/Auto', v: `${metrics.draft}/${metrics.auto}` }
        ].map((c) => (
          <div key={c.k} className="rounded-lg border bg-white p-2 text-center shadow-sm">
            <div className="text-lg font-semibold text-gray-900">{c.v}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{c.k}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { k: 'Новые проблемные', v: metrics.newProblem },
          { k: 'В работе', v: metrics.inProgress },
          { k: 'Эскалированные', v: metrics.escalated },
          { k: 'Решённые сегодня', v: metrics.resolvedToday }
        ].map((c) => (
          <div key={c.k} className="rounded-lg border bg-white p-2 text-center shadow-sm">
            <div className="text-lg font-semibold text-gray-900">{c.v}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{c.k}</div>
          </div>
        ))}
      </div>

      <AiControlFilters filters={filters} onChange={setFilters} bots={bots} />

      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : (
          <AiRunList
            runs={filtered}
            botNames={botNames}
            aggregated={aggregated}
            workflowByRunId={workflowByRunId}
            workflowBusyByRunId={workflowBusy}
            onTakeInWork={(run) =>
              updateRunWorkflow(run.id, {
                status: 'in_progress',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolutionType: null
              })
            }
            onResolve={(run) =>
              updateRunWorkflow(run.id, {
                status: 'resolved',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolvedAt: new Date(),
                resolutionType: 'fixed'
              })
            }
            onIgnore={(run) =>
              updateRunWorkflow(run.id, {
                status: 'ignored',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolutionType: 'ignored'
              })
            }
            onEscalate={(run) =>
              updateRunWorkflow(run.id, {
                status: 'escalated',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolutionType: 'escalated'
              })
            }
          />
        )}
      </div>
    </div>
  );
};

export default AiControlPage;
