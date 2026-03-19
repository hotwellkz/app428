/**
 * Рекомендация сделки от AI (автоворонки) в WhatsApp runtime.
 * Хранится в whatsappConversations.aiRuntime.dealRecommendation + dealFromAi.
 */

export type AiDealRecommendationUiStatus = 'recommended' | 'skipped' | 'insufficient_data';

export interface AiDealRoutingSnapshot {
  recommendedPipelineId: string | null;
  recommendedPipelineName: string | null;
  recommendedStageId: string | null;
  recommendedStageName: string | null;
  recommendedAssigneeId: string | null;
  recommendedAssigneeName: string | null;
  routingReason: string[];
  routingConfidence: 'high' | 'medium' | 'low';
  routingWarnings: string[];
}

export interface AiDealRecommendationSnapshot {
  status: AiDealRecommendationUiStatus;
  reason: string | null;
  /** Кратко для менеджера */
  summary: string | null;
  draftTitle: string | null;
  /** Полный текст для поля note сделки */
  draftNote: string | null;
  clientId: string | null;
  preferredStageId: string | null;
  signals: string[];
  confidence: 'high' | 'medium' | 'low';
  createdFromBotId: string;
  createdFromConversationId: string;
  createdAt: string;
  /** Проверка при создании сделки на сервере */
  payloadHash: string;
  dealRecommendationForLog: string | null;
  routing: AiDealRoutingSnapshot;
}

export interface AiDealCreatedFromRecommendationSnapshot {
  createdDealId: string | null;
  createdDealTitle: string | null;
  createdDealAt: string | null;
  createdFromPayloadHash: string | null;
  finalPipelineId?: string | null;
  finalPipelineName?: string | null;
  finalStageId?: string | null;
  finalStageName?: string | null;
  finalAssigneeId?: string | null;
  finalAssigneeName?: string | null;
  createUsedFallbacks?: string[] | null;
}
