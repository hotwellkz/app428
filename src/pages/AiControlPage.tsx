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
  appendWhatsappAiRunWorkflowEvent,
  upsertWhatsappAiRunWorkflow,
  type WhatsAppAiRunWorkflowRecord
} from '../lib/firebase/whatsappAiRunWorkflow';
import type { CrmAiBot } from '../types/crmAiBot';
import {
  DEFAULT_AI_CONTROL_FILTERS,
  type AiControlFiltersState,
  type AiControlPeriodPreset,
  type AiControlVoiceIssuePreset,
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
import { deriveAiRunChannelFromRun } from '../lib/ai-control/deriveAiRunChannel';
import {
  formatVoiceRunStatusLine,
  getVoiceCallSnapshotFromRun,
  getVoicePostCallFromRun,
  getVoiceRetryFromRun,
  getVoiceQaFromRun
} from '../lib/ai-control/voiceRunBridge';
import { auth } from '../lib/firebase/auth';

function voiceIssueMatches(
  run: WhatsAppAiBotRunRecord,
  preset: AiControlVoiceIssuePreset,
  agg: AiControlAggregatedStatus
): boolean {
  if (!preset) return true;
  if (deriveAiRunChannelFromRun(run) !== 'voice') return false;
  const vs = getVoiceCallSnapshotFromRun(run);
  const vp = getVoicePostCallFromRun(run);
  const pr = deriveAiRunListPresentation(run, agg);
  const qa = getVoiceQaFromRun(run);
  const rs = qa?.reviewStatus ?? 'none';
  switch (preset) {
    case 'post_call_failed':
      return vs?.postCallStatus === 'failed';
    case 'no_answer_busy':
      return vs?.callStatus === 'no_answer' || vs?.callStatus === 'busy';
    case 'voice_busy':
      return vs?.callStatus === 'busy';
    case 'voice_no_answer':
      return vs?.callStatus === 'no_answer';
    case 'voice_failed':
      return vs?.callStatus === 'failed';
    case 'voice_telecom_route_uncertain':
      return (
        vs?.voiceFailureReasonCode === 'telecom_route_uncertain' ||
        vs?.voiceFailureReasonMessage?.toLowerCase().includes('маршрут') === true
      );
    case 'outcome_unknown_empty':
      return (
        vs?.callStatus === 'completed' &&
        vs.outcome === 'unknown' &&
        !(run.summarySnapshot || run.extractedSummary || vp?.summary)?.toString().trim()
      );
    case 'follow_up_failed':
      return vs?.followUpStatus === 'error';
    case 'crm_failed':
      return run.extractionApplyStatus === 'error';
    case 'needs_attention_voice':
      return pr.requiresAttention;
    case 'retry_scheduled': {
      const vr = getVoiceRetryFromRun(run);
      return vr?.retryStatus === 'scheduled';
    }
    case 'retry_exhausted': {
      const vr = getVoiceRetryFromRun(run);
      return vr?.retryStatus === 'exhausted';
    }
    case 'callback_due': {
      const vr = getVoiceRetryFromRun(run);
      const raw = vr?.callbackAt || vr?.nextRetryAt;
      if (!raw) return false;
      const t = Date.parse(String(raw));
      return Number.isFinite(t) && t <= Date.now() + 2 * 3600_000;
    }
    case 'qa_low_quality':
      return qa?.status === 'done' && qa.band === 'bad';
    case 'qa_needs_review':
      return qa?.needsReview === true;
    case 'qa_missing_next_step':
      return qa?.flags?.includes('missing_next_step') === true;
    case 'qa_unclear_outcome':
      return qa?.flags?.includes('unknown_outcome') === true;
    case 'qa_operational_issues':
      return (
        qa?.flags?.includes('post_call_failed') === true ||
        qa?.flags?.includes('crm_apply_failed') === true ||
        qa?.flags?.includes('follow_up_failed') === true
      );
    case 'qa_repeated_retry_problem':
      return qa?.flags?.includes('repeated_retry_case') === true;
    case 'qa_failed':
      return qa?.status === 'failed';
    case 'qa_review_pending':
      return rs === 'pending_review';
    case 'qa_reviewed':
      return rs === 'reviewed';
    case 'qa_false_positive':
      return rs === 'false_positive';
    case 'qa_accepted_issue':
      return rs === 'accepted_issue';
    case 'qa_needs_prompt_fix':
      return qa?.needsPromptFix === true;
    case 'qa_needs_ops_fix':
      return qa?.needsOpsFix === true;
    case 'qa_needs_human_followup':
      return qa?.needsHumanFollowup === true;
    default:
      return true;
  }
}

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
      const derived = deriveAiRunChannelFromRun(run, botsById[run.botId]?.channel);
      if (filters.channel === 'whatsapp' && derived !== 'whatsapp') return false;
      if (filters.channel === 'instagram' && derived !== 'instagram') return false;
      if (filters.channel === 'site' && derived !== 'site') return false;
      if (filters.channel === 'voice' && derived !== 'voice') return false;
    }

    const agg = computeAggregatedStatus(run);

    if (filters.voiceIssuePreset) {
      if (!voiceIssueMatches(run, filters.voiceIssuePreset, agg)) return false;
    }
    if (filters.statusBucket && agg !== filters.statusBucket) return false;

    const flags = computeRunResultFlags(run);
    const p = deriveAiRunListPresentation(run, agg);
    const w = deriveAiRunWorkflow(run, p, workflowByRunId[run.id] ?? null);
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
    if (filters.onlyOverdue && !w.isOverdue) return false;
    if (filters.onlyCritical && w.priority !== 'critical') return false;
    if (filters.onlyUnassigned && !w.isUnassigned) return false;
    if (filters.onlyMyOverdue && !(w.isOverdue && currentUserId && workflowByRunId[run.id]?.assigneeId === currentUserId)) return false;
    if (filters.onlyReactionToday && !w.needsReactionToday) return false;
    if (filters.onlyUnalertedCritical && !(w.priority === 'critical' && !w.firstAlertAtMs)) return false;
    if (filters.onlyOverdueNoEscalation && !(w.isOverdue && !w.escalationSent)) return false;
    if (filters.onlySnoozed && !w.isSnoozed) return false;
    if (filters.onlyMuted && !w.isMuted) return false;
    if (filters.onlyNeedReminderNow && !w.needsReminderNow) return false;
    if (filters.onlyEscalatedAlerts && !w.escalationSent) return false;

    if (q) {
      const botName = (botsById[run.botId]?.name ?? '').toLowerCase();
      const rAny = run as unknown as Record<string, unknown>;
      const vs = getVoiceCallSnapshotFromRun(run);
      const vp = getVoicePostCallFromRun(run);
      const vr = getVoiceRetryFromRun(run);
      const qa = getVoiceQaFromRun(run);
      const extrasStr =
        run.extras && typeof run.extras === 'object' ? JSON.stringify(run.extras).toLowerCase() : '';
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
        typeof rAny.clientName === 'string' ? rAny.clientName : '',
        vs?.providerCallId,
        vs?.callStatus,
        vs?.outcome,
        vs?.postCallStatus,
        formatVoiceRunStatusLine(run),
        vp?.summary,
        vr?.retryStatus,
        vr?.retryReason,
        vr?.nextRetryAt,
        vr?.callbackAt,
        qa?.score,
        qa?.band,
        qa?.summary,
        qa?.flags?.join(' '),
        extrasStr
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
  aggregated: Record<string, AiControlAggregatedStatus>,
  workflowByRunId: Record<string, WhatsAppAiRunWorkflowRecord>
): WhatsAppAiBotRunRecord[] {
  const list = [...runs];
  list.sort((a, b) => {
    const ams = runCreatedAtMs(a);
    const bms = runCreatedAtMs(b);
    if (filters.sortBy === 'newest') return bms - ams;

    const ap = deriveAiRunListPresentation(a, aggregated[a.id] ?? 'skipped');
    const bp = deriveAiRunListPresentation(b, aggregated[b.id] ?? 'skipped');
    const aw = deriveAiRunWorkflow(a, ap, workflowByRunId[a.id] ?? null);
    const bw = deriveAiRunWorkflow(b, bp, workflowByRunId[b.id] ?? null);
    if (filters.sortBy === 'overdue_first') {
      if (aw.isOverdue !== bw.isOverdue) return aw.isOverdue ? -1 : 1;
      return bms - ams;
    }
    if (filters.sortBy === 'critical_first') {
      const rank = { critical: 3, high: 2, normal: 1, low: 0 } as const;
      if (rank[aw.priority] !== rank[bw.priority]) return rank[bw.priority] - rank[aw.priority];
      return bms - ams;
    }
    if (filters.sortBy === 'unassigned_first') {
      if (aw.isUnassigned !== bw.isUnassigned) return aw.isUnassigned ? -1 : 1;
      return bms - ams;
    }
    if (filters.sortBy === 'oldest_problem_first') {
      if (aw.isNewProblem !== bw.isNewProblem) return aw.isNewProblem ? -1 : 1;
      return (aw.ageMinutes ?? 0) > (bw.ageMinutes ?? 0) ? -1 : 1;
    }
    if (filters.sortBy === 'workflow_recently_updated') {
      return (bw.updatedAtMs ?? 0) - (aw.updatedAtMs ?? 0);
    }
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
    const wf = deriveAiRunWorkflow(r, p, workflowByRunId[r.id] ?? null);
    if (wf.isNewProblem) newProblem++;
    if (wf.status === 'in_progress') inProgress++;
    if (wf.status === 'escalated') escalated++;
    if (wf.status === 'resolved') {
      const ms = tsToMs(workflowByRunId[r.id]?.resolvedAt);
      if (ms != null && ms >= startMs) resolvedToday++;
    }
  }
  let overdue = 0,
    critical = 0,
    unassigned = 0,
    needAlertNow = 0,
    overdueNoReaction = 0,
    snoozed = 0,
    muted = 0,
    failedAttempts = 0;
  let voiceToday = 0,
    voiceCompleted = 0,
    voiceNoAnswerBusy = 0,
    voiceTelecomRouteUncertain = 0,
    voicePostFailed = 0,
    voiceNeedAttention = 0,
    voiceRetryScheduled = 0,
    voiceRetryExhausted = 0,
    voiceCallbackDue = 0,
    voiceQaLowQuality = 0,
    voiceQaNeedsReview = 0,
    voiceQaMissingNextStep = 0,
    voiceQaUnclearOutcome = 0,
    voiceQaFailed = 0,
    voiceQaReviewPending = 0,
    voiceQaFalsePositive = 0,
    voiceQaAcceptedIssue = 0,
    voiceQaNeedsPromptFix = 0,
    voiceQaNeedsOpsFix = 0;
  const startTodayMs = startOfToday.getTime();
  for (const r of runs) {
    if (deriveAiRunChannelFromRun(r) === 'voice') {
      const rms = runCreatedAtMs(r);
      if (rms >= startTodayMs) voiceToday++;
      const vs = getVoiceCallSnapshotFromRun(r);
      if (vs?.callStatus === 'completed') voiceCompleted++;
      if (vs?.callStatus === 'no_answer' || vs?.callStatus === 'busy') voiceNoAnswerBusy++;
      if (vs?.voiceFailureReasonCode === 'telecom_route_uncertain') voiceTelecomRouteUncertain++;
      if (vs?.postCallStatus === 'failed') voicePostFailed++;
      const pr = deriveAiRunListPresentation(r, agg[r.id] ?? 'skipped');
      if (pr.requiresAttention) voiceNeedAttention++;
      const vr = getVoiceRetryFromRun(r);
      if (vr?.retryStatus === 'scheduled') voiceRetryScheduled++;
      if (vr?.retryStatus === 'exhausted') voiceRetryExhausted++;
      const raw = vr?.callbackAt || vr?.nextRetryAt;
      if (raw) {
        const t = Date.parse(String(raw));
        if (Number.isFinite(t) && t <= Date.now() + 2 * 3600_000) voiceCallbackDue++;
      }
      const qa = getVoiceQaFromRun(r);
      if (qa?.status === 'done' && qa.band === 'bad') voiceQaLowQuality++;
      if (qa?.needsReview) voiceQaNeedsReview++;
      if (qa?.flags?.includes('missing_next_step')) voiceQaMissingNextStep++;
      if (qa?.flags?.includes('unknown_outcome')) voiceQaUnclearOutcome++;
      if (qa?.status === 'failed') voiceQaFailed++;
      if (qa?.reviewStatus === 'pending_review') voiceQaReviewPending++;
      if (qa?.reviewStatus === 'false_positive') voiceQaFalsePositive++;
      if (qa?.reviewStatus === 'accepted_issue') voiceQaAcceptedIssue++;
      if (qa?.needsPromptFix) voiceQaNeedsPromptFix++;
      if (qa?.needsOpsFix) voiceQaNeedsOpsFix++;
    }
  }
  for (const r of runs) {
    const p = deriveAiRunListPresentation(r, agg[r.id] ?? 'skipped');
    const wf = deriveAiRunWorkflow(r, p, workflowByRunId[r.id] ?? null);
    if (wf.isOverdue) overdue++;
    if (wf.priority === 'critical') critical++;
    if (wf.isUnassigned && p.requiresAttention) unassigned++;
    if (wf.needsAlertNow || wf.needsReminderNow || wf.needsEscalationNow) needAlertNow++;
    if (wf.isOverdue && !wf.lastAlertAtMs) overdueNoReaction++;
    if (wf.isSnoozed) snoozed++;
    if (wf.isMuted) muted++;
    if ((wf.notificationHistory ?? []).some((n) => n.status === 'failed')) failedAttempts++;
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
    resolvedToday,
    overdue,
    critical,
    unassigned,
    needAlertNow,
    overdueNoReaction,
    snoozed,
    muted,
    failedAttempts,
    voiceToday,
    voiceCompleted,
    voiceNoAnswerBusy,
    voiceTelecomRouteUncertain,
    voicePostFailed,
    voiceNeedAttention,
    voiceRetryScheduled,
    voiceRetryExhausted,
    voiceCallbackDue,
    voiceQaLowQuality,
    voiceQaNeedsReview,
    voiceQaMissingNextStep,
    voiceQaUnclearOutcome,
    voiceQaFailed,
    voiceQaReviewPending,
    voiceQaFalsePositive,
    voiceQaAcceptedIssue,
    voiceQaNeedsPromptFix,
    voiceQaNeedsOpsFix
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
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
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
  const filtered = useMemo(() => sortRuns(filteredRaw, filters, aggregated, workflowByRunId), [filteredRaw, filters, aggregated, workflowByRunId]);
  const metrics = useMemo(() => metricsFor(filtered, aggregated, workflowByRunId), [filtered, aggregated, workflowByRunId]);

  const updateRunWorkflow = async (
    run: WhatsAppAiBotRunRecord,
    patch: Partial<WhatsAppAiRunWorkflowRecord> & { status?: AiRunWorkflowStatus; resolutionType?: AiRunWorkflowResolutionType }
  ) => {
    if (!companyId) return;
    const runId = run.id;
    const currentName = user?.displayName || user?.email || 'Пользователь';
    setWorkflowBusy((prev) => ({ ...prev, [runId]: true }));
    try {
      const existing = workflowByRunId[runId];
      const p = deriveAiRunListPresentation(run, aggregated[run.id] ?? 'skipped');
      const derived = deriveAiRunWorkflow(run, p, existing ?? null);
      await upsertWhatsappAiRunWorkflow(companyId, runId, {
        ...patch,
        updatedBy: currentName,
        firstAttentionAt:
          existing?.firstAttentionAt ??
          (p.requiresAttention ? new Date() : null),
        dueAt: patch.status === 'resolved' || patch.status === 'ignored' ? null : derived.dueAtMs ? new Date(derived.dueAtMs) : null,
        slaMinutes: derived.slaMinutes,
        priority: derived.priority,
        priorityReason: derived.priorityReasons
      });
      await appendWhatsappAiRunWorkflowEvent(companyId, runId, {
        type:
          patch.status === 'resolved'
            ? 'resolved'
            : patch.status === 'ignored'
              ? 'ignored'
              : patch.status === 'escalated'
                ? 'escalated'
                : patch.status
                  ? 'status_changed'
                  : patch.assigneeId
                    ? 'assigned'
                    : patch.lastComment != null
                      ? 'comment_saved'
                      : 'status_changed',
        by: user?.uid ?? null,
        byName: currentName,
        payload: {
          status: patch.status ?? null,
          resolutionType: patch.resolutionType ?? null
        }
      });
    } finally {
      setWorkflowBusy((prev) => ({ ...prev, [runId]: false }));
    }
  };

  const toggleSelected = (runId: string) => {
    setSelectedRunIds((prev) => (prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]));
  };
  const selectAllFiltered = () =>
    setSelectedRunIds((prev) => {
      const allIds = filtered.map((r) => r.id);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.includes(id));
      return allSelected ? prev.filter((id) => !allIds.includes(id)) : Array.from(new Set([...prev, ...allIds]));
    });
  const clearSelection = () => setSelectedRunIds([]);

  const bulkUpdate = async (
    patchBuilder: (runId: string) => Partial<WhatsAppAiRunWorkflowRecord> & { status?: AiRunWorkflowStatus; resolutionType?: AiRunWorkflowResolutionType }
  ) => {
    if (!selectedRunIds.length || !companyId) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedRunIds.map((id) => {
        const run = runs.find((r) => r.id === id);
        if (!run) return Promise.resolve();
        return updateRunWorkflow(run, patchBuilder(id));
      }));
      setSelectedRunIds([]);
    } finally {
      setBulkBusy(false);
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
      <PageMetadata title="AI-контроль — журнал автоворонок" description="Срабатывания AI: WhatsApp, голос и др." />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI-контроль</h1>
        <p className="text-sm text-gray-600 mt-1">
          Журнал срабатываний AI: чаты, голосовые звонки (Twilio), извлечение, CRM, сделки и задачи.
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 mb-4">
        {[
          { k: 'Voice сегодня', v: metrics.voiceToday },
          { k: 'Voice completed', v: metrics.voiceCompleted },
          { k: 'Voice занят/нет ответа', v: metrics.voiceNoAnswerBusy },
          { k: 'Voice telecom route', v: metrics.voiceTelecomRouteUncertain },
          { k: 'Voice post-call failed', v: metrics.voicePostFailed },
          { k: 'Voice внимание', v: metrics.voiceNeedAttention },
          { k: 'Retry scheduled', v: metrics.voiceRetryScheduled },
          { k: 'Retry exhausted', v: metrics.voiceRetryExhausted },
          { k: 'Callback ≤2ч', v: metrics.voiceCallbackDue },
          { k: 'QA bad', v: metrics.voiceQaLowQuality },
          { k: 'QA review', v: metrics.voiceQaNeedsReview },
          { k: 'QA no-next-step', v: metrics.voiceQaMissingNextStep },
          { k: 'QA unclear outcome', v: metrics.voiceQaUnclearOutcome },
          { k: 'QA failed', v: metrics.voiceQaFailed },
          { k: 'Review pending', v: metrics.voiceQaReviewPending },
          { k: 'False positive', v: metrics.voiceQaFalsePositive },
          { k: 'Accepted issue', v: metrics.voiceQaAcceptedIssue },
          { k: 'Needs prompt fix', v: metrics.voiceQaNeedsPromptFix },
          { k: 'Needs ops fix', v: metrics.voiceQaNeedsOpsFix }
        ].map((c) => (
          <div key={c.k} className="rounded-lg border border-violet-100 bg-violet-50/60 p-2 text-center shadow-sm">
            <div className="text-lg font-semibold text-violet-900">{c.v}</div>
            <div className="text-[10px] text-violet-700 uppercase tracking-wide">{c.k}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-10 gap-2 mb-4">
        {[
          { k: 'Требуют alert сейчас', v: metrics.needAlertNow },
          { k: 'Просроченные без реакции', v: metrics.overdueNoReaction },
          { k: 'Просроченные', v: metrics.overdue },
          { k: 'Критичные', v: metrics.critical },
          { k: 'Snoozed', v: metrics.snoozed },
          { k: 'Muted', v: metrics.muted },
          { k: 'Failed alerts', v: metrics.failedAttempts },
          { k: 'Без ответственного', v: metrics.unassigned },
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
      {selectedRunIds.length > 0 && (
        <div className="sticky top-2 z-20 mt-3 rounded-xl border bg-white p-3 shadow-sm flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Выбрано: {selectedRunIds.length}</span>
          <button type="button" disabled={bulkBusy} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40" onClick={() => void bulkUpdate(() => ({
            assigneeId: user?.uid ?? null,
            assigneeName: user?.displayName || user?.email || null
          }))}>Назначить на меня</button>
          <button type="button" disabled={bulkBusy} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40" onClick={() => void bulkUpdate(() => ({
            status: 'in_progress',
            assigneeId: user?.uid ?? null,
            assigneeName: user?.displayName || user?.email || null
          }))}>Взять в работу</button>
          <button type="button" disabled={bulkBusy} className="px-3 py-1.5 rounded border text-sm text-emerald-800 border-emerald-200 bg-emerald-50 disabled:opacity-40" onClick={() => void bulkUpdate(() => ({
            status: 'resolved',
            assigneeId: user?.uid ?? null,
            assigneeName: user?.displayName || user?.email || null,
            resolvedAt: new Date(),
            resolutionType: 'fixed'
          }))}>Пометить решёнными</button>
          <button type="button" disabled={bulkBusy} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40" onClick={() => void bulkUpdate(() => ({
            status: 'ignored',
            assigneeId: user?.uid ?? null,
            assigneeName: user?.displayName || user?.email || null,
            resolutionType: 'ignored'
          }))}>Игнорировать</button>
          <button type="button" disabled={bulkBusy} className="px-3 py-1.5 rounded border text-sm text-amber-800 border-amber-200 bg-amber-50 disabled:opacity-40" onClick={() => void bulkUpdate(() => ({
            status: 'escalated',
            assigneeId: user?.uid ?? null,
            assigneeName: user?.displayName || user?.email || null,
            resolutionType: 'escalated'
          }))}>Эскалировать</button>
          <button type="button" className="px-3 py-1.5 rounded border text-sm" onClick={clearSelection}>Сбросить</button>
        </div>
      )}

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
              updateRunWorkflow(run, {
                status: 'in_progress',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolutionType: null
              })
            }
            onResolve={(run) =>
              updateRunWorkflow(run, {
                status: 'resolved',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolvedAt: new Date(),
                resolutionType: 'fixed'
              })
            }
            onIgnore={(run) =>
              updateRunWorkflow(run, {
                status: 'ignored',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolutionType: 'ignored'
              })
            }
            onEscalate={(run) =>
              updateRunWorkflow(run, {
                status: 'escalated',
                assigneeId: user?.uid ?? null,
                assigneeName: user?.displayName || user?.email || null,
                resolutionType: 'escalated'
              })
            }
            selectedRunIds={selectedRunIds}
            onToggleSelected={toggleSelected}
            onSelectAllFiltered={selectAllFiltered}
            areAllFilteredSelected={filtered.length > 0 && filtered.every((r) => selectedRunIds.includes(r.id))}
          />
        )}
      </div>
    </div>
  );
};

export default AiControlPage;
