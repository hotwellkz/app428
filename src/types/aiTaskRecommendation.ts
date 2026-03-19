/**
 * Рекомендация следующего действия (задачи) для менеджера после AI runtime WhatsApp.
 * Хранится в whatsappConversations.aiRuntime.taskRecommendation + taskFromAi.
 */

export type AiTaskRecommendationStatus = 'recommended' | 'manual_review' | 'insufficient_data' | 'skipped';

/** Тип следующего шага (для аналитики и будущего автопилота) */
export type AiRecommendedTaskType =
  | 'send_quote'
  | 'call_back'
  | 'clarify_parameters'
  | 'schedule_meeting'
  | 'prepare_estimate'
  | 'consultation'
  | 'follow_up'
  | 'manual_review';

export type AiRecommendedTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AiRecommendedDueMode =
  | 'asap'
  | 'today'
  | 'tomorrow'
  | 'scheduled_datetime'
  | 'after_client_reply'
  | 'manual';

export interface AiTaskRecommendationSnapshot {
  status: AiTaskRecommendationStatus;
  /** Коротко, почему такой статус */
  reason: string | null;
  recommendedTaskTitle: string;
  recommendedTaskDescription: string;
  recommendedTaskType: AiRecommendedTaskType;
  recommendedPriority: AiRecommendedTaskPriority;
  recommendedDueMode: AiRecommendedDueMode;
  /** ISO 8601, только если уверенность во времени достаточная */
  recommendedDueAt: string | null;
  /** Текст из диалога («завтра вечером»), если дату не фиксируем */
  dueHint: string | null;
  reasons: string[];
  warnings: string[];
  confidence: 'high' | 'medium' | 'low';
  /** Дедуп при создании «задачи» на сделке */
  payloadHash: string;
  /** Сделка, к которой привязываем next step; null — только превью */
  dealId: string | null;
  suggestedResponsibleUserId: string | null;
  suggestedResponsibleNameSnapshot: string | null;
  /** Можно ли вызывать server-side create (есть сделка и данные достаточны) */
  canCreateTask: boolean;
  createdFromBotId: string;
  createdFromConversationId: string;
  createdAt: string;
  /** ID сообщения-триггера последнего прогона (для логов) */
  triggerMessageId: string | null;
}

/** Факт записи следующего шага на сделку по кнопке менеджера */
export interface AiTaskCreatedFromRecommendationSnapshot {
  appliedAt: string;
  createdFromPayloadHash: string;
  dealId: string;
  /** В CRM «задача» = nextAction на сделке; taskId = dealId для совместимости API */
  taskId: string;
  finalResponsibleUserId: string | null;
  finalResponsibleNameSnapshot: string | null;
  finalNextActionAt: string | null;
  dueHintStored: string | null;
  createUsedFallbacks: string[] | null;
  recommendedTaskType: AiRecommendedTaskType | null;
  aiBotId: string | null;
  whatsappConversationId: string | null;
}
