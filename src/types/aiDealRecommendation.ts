/**
 * Рекомендация сделки от AI (автоворонки) в WhatsApp runtime.
 * Хранится в whatsappConversations.aiRuntime.dealRecommendation + dealFromAi.
 */

export type AiDealRecommendationUiStatus = 'recommended' | 'skipped' | 'insufficient_data';

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
}

export interface AiDealCreatedFromRecommendationSnapshot {
  createdDealId: string | null;
  createdDealTitle: string | null;
  createdDealAt: string | null;
  createdFromPayloadHash: string | null;
}
