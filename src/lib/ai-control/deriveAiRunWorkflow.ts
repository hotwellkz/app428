import type { AiRunWorkflowPriority, AiRunWorkflowStatus } from '../../types/aiControl';
import type { WhatsAppAiRunWorkflowRecord } from '../firebase/whatsappAiRunWorkflow';
import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import type { AiRunListPresentation } from './deriveAiRunListPresentation';
import { deriveAiRunChannelFromRun } from './deriveAiRunChannel';
import { getVoiceCallSnapshotFromRun, getVoicePostCallFromRun, getVoiceQaFromRun, getVoiceRetryFromRun } from './voiceRunBridge';

export interface DerivedAiRunWorkflow {
  status: AiRunWorkflowStatus | null;
  statusLabel: string;
  priority: AiRunWorkflowPriority;
  priorityLabel: string;
  priorityReasons: string[];
  assigneeName: string | null;
  assigneeId: string | null;
  lastComment: string | null;
  updatedBy: string | null;
  updatedAtMs: number | null;
  firstAttentionAtMs: number | null;
  dueAtMs: number | null;
  ageMinutes: number | null;
  slaMinutes: number | null;
  isOverdue: boolean;
  needsReactionToday: boolean;
  isMuted: boolean;
  isSnoozed: boolean;
  needsAlertNow: boolean;
  needsReminderNow: boolean;
  needsEscalationNow: boolean;
  escalationSent: boolean;
  firstAlertAtMs: number | null;
  lastAlertAtMs: number | null;
  lastReminderAtMs: number | null;
  lastEscalationAtMs: number | null;
  isUnassigned: boolean;
  isNewProblem: boolean;
  history: WhatsAppAiRunWorkflowRecord['history'];
  notificationHistory: WhatsAppAiRunWorkflowRecord['notificationHistory'];
}

function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    // Сырой Firestore Timestamp / сериализация: { seconds, nanoseconds }
    const sec = o.seconds;
    const nano = o.nanoseconds;
    if (typeof sec === 'number' && Number.isFinite(sec)) {
      const n = typeof nano === 'number' && Number.isFinite(nano) ? nano : 0;
      return sec * 1000 + Math.floor(n / 1e6);
    }
    // Экземпляр Timestamp с методом toMillis (может падать при битых данных — ловим)
    const toMillis = o.toMillis;
    if (typeof toMillis === 'function') {
      try {
        const ms = (toMillis as () => number).call(v);
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    if (typeof o.toDate === 'function') {
      try {
        const d = (o.toDate as () => Date).call(v);
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function statusLabel(status: AiRunWorkflowStatus | null): string {
  if (status === 'new') return 'Новый';
  if (status === 'in_progress') return 'В работе';
  if (status === 'resolved') return 'Решён';
  if (status === 'ignored') return 'Игнор';
  if (status === 'escalated') return 'Эскалация';
  return '—';
}

function priorityLabel(priority: AiRunWorkflowPriority): string {
  if (priority === 'critical') return 'Критично';
  if (priority === 'high') return 'Высокий';
  if (priority === 'normal') return 'Нормальный';
  return 'Низкий';
}

function derivePriority(
  run: WhatsAppAiBotRunRecord,
  presentation: AiRunListPresentation,
  status: AiRunWorkflowStatus | null,
  hasAssignee: boolean
): { priority: AiRunWorkflowPriority; reasons: string[] } {
  const reasons: string[] = [];
  const isVoice = deriveAiRunChannelFromRun(run) === 'voice';
  const voiceSnap = isVoice ? getVoiceCallSnapshotFromRun(run) : null;
  const voicePost = isVoice ? getVoicePostCallFromRun(run) : null;
  const voiceRetry = isVoice ? getVoiceRetryFromRun(run) : null;
  const voiceQa = isVoice ? getVoiceQaFromRun(run) : null;
  const qaReviewed =
    voiceQa?.reviewStatus === 'reviewed' ||
    voiceQa?.reviewStatus === 'false_positive' ||
    voiceQa?.reviewStatus === 'ignored';
  const retryNextMs = voiceRetry?.nextRetryAt ? Date.parse(String(voiceRetry.nextRetryAt)) : NaN;
  const retryOverdue = Number.isFinite(retryNextMs) && retryNextMs < Date.now();

  const critical = [
    presentation.runStatus === 'error',
    run.extractionApplyStatus === 'error',
    run.dealRecommendationStatus === 'recommended' && run.dealCreateStatus !== 'created' && !run.createdDealId,
    run.taskRecommendationStatus === 'recommended' && run.taskCreateStatus !== 'created',
    presentation.requiresAttention && status === 'new' && !hasAssignee,
    isVoice && voiceSnap?.postCallStatus === 'failed',
    isVoice && voiceSnap?.voiceFailureReasonCode === 'telecom_route_uncertain',
    isVoice && voiceRetry?.retryStatus === 'exhausted',
    isVoice && voiceQa?.status === 'failed',
    isVoice && voiceQa?.status === 'done' && !qaReviewed && (voiceQa.band === 'bad' || voiceQa.needsReview)
  ];
  if (critical.some(Boolean)) {
    if (presentation.runStatus === 'error') reasons.push('runtime/API error');
    if (run.extractionApplyStatus === 'error') reasons.push('CRM apply error');
    if (run.dealRecommendationStatus === 'recommended' && run.dealCreateStatus !== 'created' && !run.createdDealId) reasons.push('сделка рекомендована, но не создана');
    if (run.taskRecommendationStatus === 'recommended' && run.taskCreateStatus !== 'created') reasons.push('задача рекомендована, но не создана');
    if (presentation.requiresAttention && status === 'new' && !hasAssignee) reasons.push('новый проблемный кейс без ответственного');
    if (isVoice && voiceSnap?.postCallStatus === 'failed') reasons.push('Голос: post-call failed');
    if (isVoice && voiceSnap?.voiceFailureReasonCode === 'telecom_route_uncertain') {
      reasons.push('Голос: telecom route uncertain');
    }
    if (isVoice && voiceRetry?.retryStatus === 'exhausted') reasons.push('Голос: retry exhausted');
    if (isVoice && voiceQa?.status === 'failed') reasons.push('Голос: QA pipeline failed');
    if (isVoice && voiceQa?.status === 'done' && !qaReviewed && voiceQa.band === 'bad') {
      reasons.push('Голос: QA low quality');
    }
    if (isVoice && voiceQa?.status === 'done' && !qaReviewed && voiceQa.needsReview) {
      reasons.push('Голос: QA needs review');
    }
    return { priority: 'critical', reasons };
  }

  const reason = (run.reason ?? '').toLowerCase();
  const high = [
    (run.createUsedFallbacks?.length ?? 0) > 0 || presentation.isFallback,
    !presentation.badges.includes('Extraction') && !(isVoice && voicePost?.lightweight),
    presentation.runStatus === 'duplicate' && !(status === 'resolved' || status === 'ignored'),
    (presentation.runStatus === 'skipped' || reason.includes('paused') || reason.includes('пауз')) && presentation.requiresAttention,
    isVoice && !!(voicePost?.extractionError || voicePost?.summaryError || voiceSnap?.followUpStatus === 'error'),
    isVoice && voiceRetry?.retryStatus === 'scheduled' && retryOverdue
  ];
  if (high.some(Boolean)) {
    if ((run.createUsedFallbacks?.length ?? 0) > 0 || presentation.isFallback) reasons.push('есть fallback');
    if (!presentation.badges.includes('Extraction') && !(isVoice && voicePost?.lightweight)) reasons.push('нет extraction');
    if (presentation.runStatus === 'duplicate' && !(status === 'resolved' || status === 'ignored')) reasons.push('duplicate без закрытия');
    if ((presentation.runStatus === 'skipped' || reason.includes('paused') || reason.includes('пауз')) && presentation.requiresAttention) reasons.push('paused/skipped с риском');
    if (isVoice && (voicePost?.extractionError || voicePost?.summaryError)) reasons.push('Голос: ошибка summary/extraction');
    if (isVoice && voiceSnap?.followUpStatus === 'error') reasons.push('Голос: ошибка WhatsApp follow-up');
    if (isVoice && voiceRetry?.retryStatus === 'scheduled' && retryOverdue) reasons.push('Голос: просроченный retry/callback');
    return { priority: 'high', reasons };
  }

  if (status === 'resolved' || status === 'ignored') return { priority: 'low', reasons: ['кейс закрыт'] };
  return { priority: 'normal', reasons: presentation.requiresAttention ? ['требует проверки'] : ['некритичный'] };
}

function calcSla(priority: AiRunWorkflowPriority): number | null {
  if (priority === 'critical') return 15;
  if (priority === 'high') return 60;
  if (priority === 'normal') return 240;
  return null;
}

function reminderCooldownMinutes(priority: AiRunWorkflowPriority): number | null {
  if (priority === 'critical') return 15;
  if (priority === 'high') return 60;
  if (priority === 'normal') return 240;
  return null;
}

function escalationThresholdMinutes(priority: AiRunWorkflowPriority): number | null {
  if (priority === 'critical') return 30;
  if (priority === 'high') return 240;
  if (priority === 'normal') return 1440;
  return null;
}

export function deriveAiRunWorkflow(
  run: WhatsAppAiBotRunRecord,
  presentation: AiRunListPresentation,
  workflow: WhatsAppAiRunWorkflowRecord | null | undefined,
  nowMs = Date.now()
): DerivedAiRunWorkflow {
  const status = workflow?.status ?? (presentation.requiresAttention ? 'new' : null);
  const hasAssignee = !!workflow?.assigneeId;
  const priorityFromStored = workflow?.priority ?? null;
  const derived = derivePriority(run, presentation, status, hasAssignee);
  const priority = priorityFromStored ?? derived.priority;
  const priorityReasons = workflow?.priorityReason?.length ? workflow.priorityReason : derived.reasons;
  const firstAttentionAtMs = toMs(workflow?.firstAttentionAt) ?? toMs(run.createdAt);
  const slaMinutes = workflow?.slaMinutes ?? calcSla(priority);
  const dueAtMs = toMs(workflow?.dueAt) ?? (firstAttentionAtMs && slaMinutes ? firstAttentionAtMs + slaMinutes * 60_000 : null);
  const isOverdue = !!(dueAtMs && dueAtMs < nowMs && status !== 'resolved' && status !== 'ignored');
  const ageMinutes = firstAttentionAtMs ? Math.max(0, Math.floor((nowMs - firstAttentionAtMs) / 60000)) : null;
  const firstAlertAtMs = toMs(workflow?.alertState?.firstAlertAt);
  const lastAlertAtMs = toMs(workflow?.alertState?.lastAlertAt);
  const lastReminderAtMs = toMs(workflow?.alertState?.lastReminderAt);
  const lastEscalationAtMs = toMs(workflow?.alertState?.lastEscalationAt);
  const mutedUntilMs = toMs(workflow?.alertState?.mutedUntil);
  const snoozedUntilMs = toMs(workflow?.alertState?.snoozedUntil);
  const isMuted = !!(mutedUntilMs && mutedUntilMs > nowMs);
  const isSnoozed = !!(snoozedUntilMs && snoozedUntilMs > nowMs);
  const reminderCooldown = reminderCooldownMinutes(priority);
  const escalationThreshold = escalationThresholdMinutes(priority);
  const overdueMinutes = dueAtMs ? Math.floor((nowMs - dueAtMs) / 60000) : null;
  const needsAlertNow =
    !isMuted &&
    !isSnoozed &&
    status !== 'resolved' &&
    status !== 'ignored' &&
    ((priority === 'critical' && status === 'new' && !hasAssignee && !firstAlertAtMs) || (isOverdue && !firstAlertAtMs));
  const needsReminderNow =
    !isMuted &&
    !isSnoozed &&
    status !== 'resolved' &&
    status !== 'ignored' &&
    isOverdue &&
    !!reminderCooldown &&
    (lastReminderAtMs == null || nowMs - lastReminderAtMs >= reminderCooldown * 60000);
  const needsEscalationNow =
    !isMuted &&
    status !== 'resolved' &&
    status !== 'ignored' &&
    isOverdue &&
    !!escalationThreshold &&
    !!overdueMinutes &&
    overdueMinutes > escalationThreshold &&
    !lastEscalationAtMs;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const needsReactionToday = !!(dueAtMs && dueAtMs >= startOfToday.getTime() && dueAtMs < startOfToday.getTime() + 86400000);
  return {
    status,
    statusLabel: statusLabel(status),
    priority,
    priorityLabel: priorityLabel(priority),
    priorityReasons,
    assigneeName: workflow?.assigneeName ?? null,
    assigneeId: workflow?.assigneeId ?? null,
    lastComment: workflow?.lastComment ?? null,
    updatedBy: workflow?.updatedBy ?? null,
    updatedAtMs: toMs(workflow?.updatedAt ?? null),
    firstAttentionAtMs,
    dueAtMs,
    ageMinutes,
    slaMinutes,
    isOverdue,
    needsReactionToday,
    isMuted,
    isSnoozed,
    needsAlertNow,
    needsReminderNow,
    needsEscalationNow,
    escalationSent: !!lastEscalationAtMs,
    firstAlertAtMs,
    lastAlertAtMs,
    lastReminderAtMs,
    lastEscalationAtMs,
    isUnassigned: !workflow?.assigneeId,
    isNewProblem: presentation.requiresAttention && status === 'new',
    history: workflow?.history ?? null
    ,
    notificationHistory: workflow?.notificationHistory ?? null
  };
}
