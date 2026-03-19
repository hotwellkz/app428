import type { AiRunWorkflowPriority, AiRunWorkflowStatus } from '../../types/aiControl';
import type { WhatsAppAiRunWorkflowRecord } from '../firebase/whatsappAiRunWorkflow';
import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import type { AiRunListPresentation } from './deriveAiRunListPresentation';

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
  isUnassigned: boolean;
  isNewProblem: boolean;
  history: WhatsAppAiRunWorkflowRecord['history'];
}

function toMs(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === 'object' && v && 'toMillis' in (v as { toMillis?: unknown })) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  if (v instanceof Date) return v.getTime();
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
  const critical = [
    presentation.runStatus === 'error',
    run.extractionApplyStatus === 'error',
    run.dealRecommendationStatus === 'recommended' && run.dealCreateStatus !== 'created' && !run.createdDealId,
    run.taskRecommendationStatus === 'recommended' && run.taskCreateStatus !== 'created',
    presentation.requiresAttention && status === 'new' && !hasAssignee
  ];
  if (critical.some(Boolean)) {
    if (presentation.runStatus === 'error') reasons.push('runtime/API error');
    if (run.extractionApplyStatus === 'error') reasons.push('CRM apply error');
    if (run.dealRecommendationStatus === 'recommended' && run.dealCreateStatus !== 'created' && !run.createdDealId) reasons.push('сделка рекомендована, но не создана');
    if (run.taskRecommendationStatus === 'recommended' && run.taskCreateStatus !== 'created') reasons.push('задача рекомендована, но не создана');
    if (presentation.requiresAttention && status === 'new' && !hasAssignee) reasons.push('новый проблемный кейс без ответственного');
    return { priority: 'critical', reasons };
  }

  const reason = (run.reason ?? '').toLowerCase();
  const high = [
    (run.createUsedFallbacks?.length ?? 0) > 0 || presentation.isFallback,
    !presentation.badges.includes('Extraction'),
    presentation.runStatus === 'duplicate' && !(status === 'resolved' || status === 'ignored'),
    (presentation.runStatus === 'skipped' || reason.includes('paused') || reason.includes('пауз')) && presentation.requiresAttention
  ];
  if (high.some(Boolean)) {
    if ((run.createUsedFallbacks?.length ?? 0) > 0 || presentation.isFallback) reasons.push('есть fallback');
    if (!presentation.badges.includes('Extraction')) reasons.push('нет extraction');
    if (presentation.runStatus === 'duplicate' && !(status === 'resolved' || status === 'ignored')) reasons.push('duplicate без закрытия');
    if ((presentation.runStatus === 'skipped' || reason.includes('paused') || reason.includes('пауз')) && presentation.requiresAttention) reasons.push('paused/skipped с риском');
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
    isUnassigned: !workflow?.assigneeId,
    isNewProblem: presentation.requiresAttention && status === 'new',
    history: workflow?.history ?? null
  };
}
