import type { Timestamp } from 'firebase/firestore';
import type {
  AiDealCreatedFromRecommendationSnapshot,
  AiDealRecommendationSnapshot
} from './aiDealRecommendation';

/** Режим ответа AI из модуля «Автоворонки» в WhatsApp-чате */
export type WhatsAppAiRuntimeMode = 'off' | 'draft' | 'auto';

export type WhatsAppAiRuntimeLastStatus = 'idle' | 'success' | 'error' | 'skipped';

/** Результат серверного apply extraction в карточку clients */
export type WhatsAppExtractionApplyStatus = 'applied' | 'skipped' | 'error';

/**
 * Состояние runtime AI в документе whatsappConversations (поле aiRuntime).
 * Старые документы без aiRuntime нормализуются через parseWhatsAppAiRuntime.
 */
export interface WhatsAppAiRuntime {
  enabled: boolean;
  botId: string | null;
  mode: WhatsAppAiRuntimeMode;
  lastRunAt: Date | Timestamp | null;
  lastStatus: WhatsAppAiRuntimeLastStatus | null;
  lastReason: string | null;
  lastGeneratedReply: string | null;
  /** Дедуп: id входящего сообщения, по которому уже отработали */
  lastProcessedIncomingMessageId: string | null;
  /** JSON последнего extraction (отладка / будущий apply) */
  lastExtractionJson: string | null;
  /** Последний auto-apply extraction → CRM */
  lastExtractionApplyStatus: WhatsAppExtractionApplyStatus | null;
  lastExtractionApplyReason: string | null;
  /** Ключи полей Firestore */
  lastExtractionAppliedFields: string[] | null;
  /** Подписи для UI («Город», …) */
  lastExtractionAppliedLabels: string[] | null;
  lastExtractionAppliedFieldCount: number | null;
  lastExtractionAppliedClientId: string | null;
  /** ISO-время с сервера при apply */
  lastExtractionAppliedAt: string | null;
  /** Рекомендация сделки (последний проход AI runtime) */
  dealRecommendation: AiDealRecommendationSnapshot | null;
  /** Факт создания сделки по кнопке менеджера */
  dealFromAi: AiDealCreatedFromRecommendationSnapshot | null;
}

export function defaultWhatsAppAiRuntime(): WhatsAppAiRuntime {
  return {
    enabled: false,
    botId: null,
    mode: 'off',
    lastRunAt: null,
    lastStatus: null,
    lastReason: null,
    lastGeneratedReply: null,
    lastProcessedIncomingMessageId: null,
    lastExtractionJson: null,
    lastExtractionApplyStatus: null,
    lastExtractionApplyReason: null,
    lastExtractionAppliedFields: null,
    lastExtractionAppliedLabels: null,
    lastExtractionAppliedFieldCount: null,
    lastExtractionAppliedClientId: null,
    lastExtractionAppliedAt: null,
    dealRecommendation: null,
    dealFromAi: null
  };
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Разбор поля aiRuntime из документа Firestore (или пустой объект). */
export function parseWhatsAppAiRuntime(data: Record<string, unknown>): WhatsAppAiRuntime {
  const base = defaultWhatsAppAiRuntime();
  const raw = data.aiRuntime;
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const mode =
    o.mode === 'draft' || o.mode === 'auto' || o.mode === 'off' ? o.mode : base.mode;
  let lastStatus: WhatsAppAiRuntimeLastStatus | null = base.lastStatus;
  if (
    o.lastStatus === 'idle' ||
    o.lastStatus === 'success' ||
    o.lastStatus === 'error' ||
    o.lastStatus === 'skipped'
  ) {
    lastStatus = o.lastStatus;
  } else if (o.lastStatus != null && String(o.lastStatus).length > 0) {
    lastStatus = null;
  }

  let lastExtractionApplyStatus: WhatsAppExtractionApplyStatus | null = null;
  if (o.lastExtractionApplyStatus === 'applied' || o.lastExtractionApplyStatus === 'skipped' || o.lastExtractionApplyStatus === 'error') {
    lastExtractionApplyStatus = o.lastExtractionApplyStatus;
  }

  const strArr = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null;
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : null;
  };

  const numOrNull = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return null;
  };

  const parseDealRec = (v: unknown): AiDealRecommendationSnapshot | null => {
    if (!v || typeof v !== 'object') return null;
    const r = v as Record<string, unknown>;
    const status =
      r.status === 'recommended' || r.status === 'skipped' || r.status === 'insufficient_data'
        ? r.status
        : null;
    if (!status) return null;
    const signals = Array.isArray(r.signals)
      ? r.signals.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const conf =
      r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low'
        ? r.confidence
        : 'low';
    const routingRaw =
      r.routing && typeof r.routing === 'object' ? (r.routing as Record<string, unknown>) : null;
    const routing = routingRaw
      ? {
          recommendedPipelineId: strOrNull(routingRaw.recommendedPipelineId),
          recommendedPipelineName: strOrNull(routingRaw.recommendedPipelineName),
          recommendedStageId: strOrNull(routingRaw.recommendedStageId),
          recommendedStageName: strOrNull(routingRaw.recommendedStageName),
          recommendedAssigneeId: strOrNull(routingRaw.recommendedAssigneeId),
          recommendedAssigneeName: strOrNull(routingRaw.recommendedAssigneeName),
          routingReason: Array.isArray(routingRaw.routingReason)
            ? routingRaw.routingReason.map((x) => String(x).trim()).filter(Boolean)
            : [],
          routingConfidence:
            routingRaw.routingConfidence === 'high' ||
            routingRaw.routingConfidence === 'medium' ||
            routingRaw.routingConfidence === 'low'
              ? routingRaw.routingConfidence
              : 'low',
          routingWarnings: Array.isArray(routingRaw.routingWarnings)
            ? routingRaw.routingWarnings.map((x) => String(x).trim()).filter(Boolean)
            : []
        }
      : {
          recommendedPipelineId: null,
          recommendedPipelineName: null,
          recommendedStageId: null,
          recommendedStageName: null,
          recommendedAssigneeId: null,
          recommendedAssigneeName: null,
          routingReason: [],
          routingConfidence: 'low' as const,
          routingWarnings: []
        };

    return {
      status,
      reason: strOrNull(r.reason),
      summary: strOrNull(r.summary),
      draftTitle: strOrNull(r.draftTitle),
      draftNote: typeof r.draftNote === 'string' ? r.draftNote : null,
      clientId: strOrNull(r.clientId),
      preferredStageId: strOrNull(r.preferredStageId),
      signals,
      confidence: conf,
      createdFromBotId: strOrNull(r.createdFromBotId) ?? '',
      createdFromConversationId: strOrNull(r.createdFromConversationId) ?? '',
      createdAt: strOrNull(r.createdAt) ?? '',
      payloadHash: strOrNull(r.payloadHash) ?? '',
      dealRecommendationForLog: strOrNull(r.dealRecommendationForLog),
      routing
    };
  };

  const parseDealFromAi = (v: unknown): AiDealCreatedFromRecommendationSnapshot | null => {
    if (!v || typeof v !== 'object') return null;
    const r = v as Record<string, unknown>;
    return {
      createdDealId: strOrNull(r.createdDealId),
      createdDealTitle: strOrNull(r.createdDealTitle),
      createdDealAt: strOrNull(r.createdDealAt),
      createdFromPayloadHash: strOrNull(r.createdFromPayloadHash),
      finalPipelineId: strOrNull(r.finalPipelineId),
      finalPipelineName: strOrNull(r.finalPipelineName),
      finalStageId: strOrNull(r.finalStageId),
      finalStageName: strOrNull(r.finalStageName),
      finalAssigneeId: strOrNull(r.finalAssigneeId),
      finalAssigneeName: strOrNull(r.finalAssigneeName),
      createUsedFallbacks: Array.isArray(r.createUsedFallbacks)
        ? r.createUsedFallbacks.map((x) => String(x).trim()).filter(Boolean)
        : null
    };
  };

  return {
    enabled: o.enabled === true,
    botId: strOrNull(o.botId),
    mode,
    lastRunAt: (o.lastRunAt as WhatsAppAiRuntime['lastRunAt']) ?? null,
    lastStatus,
    lastReason: strOrNull(o.lastReason),
    lastGeneratedReply: strOrNull(o.lastGeneratedReply),
    lastProcessedIncomingMessageId: strOrNull(o.lastProcessedIncomingMessageId),
    lastExtractionJson: strOrNull(o.lastExtractionJson),
    lastExtractionApplyStatus,
    lastExtractionApplyReason: strOrNull(o.lastExtractionApplyReason),
    lastExtractionAppliedFields: strArr(o.lastExtractionAppliedFields),
    lastExtractionAppliedLabels: strArr(o.lastExtractionAppliedLabels),
    lastExtractionAppliedFieldCount: numOrNull(o.lastExtractionAppliedFieldCount),
    lastExtractionAppliedClientId: strOrNull(o.lastExtractionAppliedClientId),
    lastExtractionAppliedAt: strOrNull(o.lastExtractionAppliedAt),
    dealRecommendation: parseDealRec(o.dealRecommendation) ?? null,
    dealFromAi: parseDealFromAi(o.dealFromAi) ?? null
  };
}
