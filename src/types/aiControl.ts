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
  sortBy: 'newest' | 'problem_first' | 'deal_task_first';
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
