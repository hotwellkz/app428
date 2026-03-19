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
export type AiRunWorkflowEventType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'comment_saved'
  | 'escalated'
  | 'resolved'
  | 'ignored';

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
  sortBy: 'newest' | 'problem_first' | 'deal_task_first' | 'overdue_first' | 'critical_first' | 'unassigned_first' | 'oldest_problem_first' | 'workflow_recently_updated';
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
  sortBy: 'newest'
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
