/**
 * Центр контроля AI-автоворонок: агрегированный статус и фильтры (вычисляются на клиенте).
 */

export type AiControlAggregatedStatus =
  | 'success'
  | 'partial'
  | 'warning'
  | 'error'
  | 'skipped'
  | 'duplicate'
  | 'paused'
  | 'off';

export type AiControlPeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export type AiControlResultFilter =
  | 'all'
  | 'deal_created'
  | 'task_created'
  | 'crm_updated'
  | 'reply_only'
  | 'no_changes';

export type AiRunWorkflowStatus = 'new' | 'in_progress' | 'resolved' | 'ignored' | 'escalated';
export type AiRunWorkflowResolutionType =
  | 'fixed'
  | 'manual_apply'
  | 'manual_deal'
  | 'manual_task'
  | 'ignored'
  | 'escalated';
export type AiControlWorkflowFilter = 'all' | 'new' | 'in_progress' | 'escalated' | 'resolved' | 'ignored';
export type AiRunWorkflowPriority = 'critical' | 'high' | 'normal' | 'low';

/** Фильтры по типичным voice-проблемам (только для channel=voice или при сочетании с выдачей). */
export type AiControlVoiceIssuePreset =
  | ''
  | 'post_call_failed'
  | 'no_answer_busy'
  | 'voice_busy'
  | 'voice_no_answer'
  | 'voice_failed'
  | 'voice_telecom_route_uncertain'
  | 'outcome_unknown_empty'
  | 'follow_up_failed'
  | 'crm_failed'
  | 'needs_attention_voice'
  | 'retry_scheduled'
  | 'retry_exhausted'
  | 'callback_due'
  | 'qa_low_quality'
  | 'qa_needs_review'
  | 'qa_missing_next_step'
  | 'qa_unclear_outcome'
  | 'qa_operational_issues'
  | 'qa_repeated_retry_problem'
  | 'qa_failed'
  | 'qa_review_pending'
  | 'qa_reviewed'
  | 'qa_false_positive'
  | 'qa_accepted_issue'
  | 'qa_needs_prompt_fix'
  | 'qa_needs_ops_fix'
  | 'qa_needs_human_followup';
export type AiRunWorkflowEventType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'comment_saved'
  | 'escalated'
  | 'resolved'
  | 'ignored';

export type AiRunAlertEventType =
  | 'new_critical_unassigned'
  | 'new_overdue'
  | 'still_overdue_reminder'
  | 'escalation_required'
  | 'assigned_to_me'
  | 'manual_resend';

export interface AiControlFiltersState {
  period: AiControlPeriodPreset;
  customFrom: string;
  customTo: string;
  botId: string;
  channel: string;
  /** success | partial | warning | error | skipped | duplicate | paused */
  statusBucket: string;
  result: AiControlResultFilter;
  runtimeMode: string;
  search: string;
  presetView: 'all' | 'errors' | 'attention' | 'deals' | 'tasks';
  onlyErrors: boolean;
  onlySkipped: boolean;
  onlySnapshot: boolean;
  onlyFallback: boolean;
  onlyCrmApply: boolean;
  onlyWithDeal: boolean;
  onlyWithTask: boolean;
  workflowFilter: AiControlWorkflowFilter;
  onlyMine: boolean;
  onlyNewProblem: boolean;
  onlyOverdue: boolean;
  onlyCritical: boolean;
  onlyUnassigned: boolean;
  onlyMyOverdue: boolean;
  onlyReactionToday: boolean;
  onlyUnalertedCritical: boolean;
  onlyOverdueNoEscalation: boolean;
  onlySnoozed: boolean;
  onlyMuted: boolean;
  onlyNeedReminderNow: boolean;
  onlyEscalatedAlerts: boolean;
  sortBy: 'newest' | 'problem_first' | 'deal_task_first' | 'overdue_first' | 'critical_first' | 'unassigned_first' | 'oldest_problem_first' | 'workflow_recently_updated';
  /** Voice: узкий фильтр по сценарию (см. applyFilters в AiControlPage) */
  voiceIssuePreset: AiControlVoiceIssuePreset;
}

export const DEFAULT_AI_CONTROL_FILTERS: AiControlFiltersState = {
  period: '7d',
  customFrom: '',
  customTo: '',
  botId: '',
  channel: '',
  statusBucket: '',
  result: 'all',
  runtimeMode: '',
  search: '',
  presetView: 'all',
  onlyErrors: false,
  onlySkipped: false,
  onlySnapshot: false,
  onlyFallback: false,
  onlyCrmApply: false,
  onlyWithDeal: false,
  onlyWithTask: false,
  workflowFilter: 'all',
  onlyMine: false,
  onlyNewProblem: false,
  onlyOverdue: false,
  onlyCritical: false,
  onlyUnassigned: false,
  onlyMyOverdue: false,
  onlyReactionToday: false,
  onlyUnalertedCritical: false,
  onlyOverdueNoEscalation: false,
  onlySnoozed: false,
  onlyMuted: false,
  onlyNeedReminderNow: false,
  onlyEscalatedAlerts: false,
  sortBy: 'newest',
  voiceIssuePreset: ''
};

/** Флаги результата run (для фильтров и метрик) */
export interface AiRunResultFlags {
  hasCrmApply: boolean;
  hasDealCreate: boolean;
  hasTaskCreate: boolean;
  hasAiReply: boolean;
  isDraftMode: boolean;
  isAutoMode: boolean;
  hasWarningSignals: boolean;
  isDuplicate: boolean;
}
