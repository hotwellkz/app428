import type { CrmAiBotExtractionResult } from '../../types/crmAiBotExtraction';
import type { CrmAiBotConfig } from '../../types/crmAiBotConfig';
import type {
  AiDealRecommendationSnapshot,
  AiDealRoutingSnapshot
} from '../../types/aiDealRecommendation';
import { mapExtractionToCrmDraft } from './extractionCrmMapper';
import { buildAppendNextStepSegment, buildAppendSegmentWithoutNextStep } from './extractionCrmMapper';

const AI_BLOCK = '\n\n--- AI (автоворонка) ---\n';

function isWarmOrHot(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.toLowerCase();
  return /горяч|hot|высок|warm|тёпл|тепл|сильн|заинтересован/i.test(t);
}

function parseAreaM2(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null;
  const n = parseFloat(raw.replace(',', '.').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Практичный заголовок сделки */
export function buildAiDealTitle(
  extraction: CrmAiBotExtractionResult,
  clientDisplayName?: string | null
): string {
  const city = extraction.city?.trim() || null;
  const area = parseAreaM2(extraction.areaM2);
  const name = clientDisplayName?.trim() || extraction.clientName?.trim() || null;

  if (area && city) {
    return `Заявка на дом ${Math.round(area)} м², ${city}`;
  }
  if (area) {
    return `Заявка на дом ${Math.round(area)} м²`;
  }
  if (city) {
    return `Заявка на строительство дома — ${city}`;
  }
  if (name) {
    return `Заявка на строительство дома — ${name}`;
  }
  return 'Заявка на строительство дома';
}

export function buildAiDealNote(params: {
  extraction: CrmAiBotExtractionResult;
  botName: string;
  conversationId: string;
  botId: string;
  summaryOneLine?: string | null;
  /** voice — подпись «Голосовой звонок» вместо WhatsApp */
  channel?: string | null;
}): string {
  const { extraction, botName, conversationId, botId, summaryOneLine, channel } = params;
  const lines: string[] = [];
  const source =
    channel === 'voice' ? `Голосовой звонок (Twilio) · AI-бот «${botName}»` : `WhatsApp · AI-бот «${botName}»`;
  lines.push(`Источник: ${source}`);
  lines.push(`Чат/сессия: ${conversationId} · botId: ${botId}`);
  if (summaryOneLine?.trim()) lines.push(`Сводка: ${summaryOneLine.trim()}`);

  const draft = mapExtractionToCrmDraft(extraction);
  const parts: string[] = [];
  if (draft.city) parts.push(`Город: ${draft.city}`);
  if (draft.areaSqm != null) parts.push(`Площадь: ${draft.areaSqm} м²`);
  if (draft.floors) parts.push(`Этажность: ${draft.floors}`);
  if (draft.houseType) parts.push(`Параметры: ${draft.houseType}`);
  if (draft.leadTemperature) parts.push(`Температура лида: ${draft.leadTemperature}`);
  if (draft.clientIntent) parts.push(`Интерес: ${draft.clientIntent}`);
  const sumSeg = buildAppendSegmentWithoutNextStep(extraction);
  if (sumSeg) parts.push(sumSeg);
  const ns = buildAppendNextStepSegment(extraction);
  if (ns) parts.push(ns);

  if (parts.length) {
    lines.push('');
    lines.push('Извлечённые параметры:');
    lines.push(parts.join('\n'));
  }

  const body = lines.join('\n');
  return `${AI_BLOCK.trim()}\n${body}`.slice(0, 12000);
}

/** Детерминированный короткий хэш (без Node crypto — одинаково в браузере и на Netlify). */
export function computeDealRecommendationPayloadHash(parts: {
  draftTitle: string;
  clientId: string;
  conversationId: string;
  botId: string;
}): string {
  const raw = `${parts.draftTitle}|${parts.clientId}|${parts.conversationId}|${parts.botId}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 0).toString(16).padStart(8, '0');
  let h2 = 5381;
  for (let i = 0; i < raw.length; i++) h2 = (h2 * 33) ^ raw.charCodeAt(i);
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${a}${b}`.slice(0, 32);
}

/**
 * Оценка: нужно ли рекомендовать сделку (без автосоздания).
 */
export function buildAiDealRecommendationSnapshot(params: {
  extraction: CrmAiBotExtractionResult;
  crmActions: CrmAiBotConfig['crmActions'];
  channel: string | undefined;
  clientId: string | null | undefined;
  conversationId: string;
  botId: string;
  botName: string;
  dealRecommendationForLog: string | null;
  routing?: AiDealRoutingSnapshot;
}): AiDealRecommendationSnapshot {
  const {
    extraction,
    crmActions,
    channel,
    clientId,
    conversationId,
    botId,
    botName,
    dealRecommendationForLog
  } = params;

  const base = (status: AiDealRecommendationSnapshot['status'], reason: string | null): AiDealRecommendationSnapshot => ({
    status,
    reason,
    summary: null,
    draftTitle: null,
    draftNote: null,
    clientId: clientId && String(clientId).trim() ? String(clientId).trim() : null,
    preferredStageId: null,
    signals: [],
    confidence: 'low',
    createdFromBotId: botId,
    createdFromConversationId: conversationId,
    createdAt: new Date().toISOString(),
    payloadHash: '',
    dealRecommendationForLog,
    routing: params.routing ?? {
      recommendedPipelineId: null,
      recommendedPipelineName: null,
      recommendedStageId: null,
      recommendedStageName: null,
      recommendedAssigneeId: null,
      recommendedAssigneeName: null,
      routingReason: [],
      routingConfidence: 'low',
      routingWarnings: ['Routing пока не рассчитан']
    }
  });

  if (!crmActions.suggestCreateDeal) {
    return {
      ...base('skipped', 'В настройках бота выключена рекомендация сделки'),
      payloadHash: computeDealRecommendationPayloadHash({
        draftTitle: '__skipped__',
        clientId: clientId ?? '',
        conversationId,
        botId
      })
    };
  }

  if (channel === 'instagram') {
    return {
      ...base('skipped', 'Рекомендация сделки только для WhatsApp'),
      payloadHash: computeDealRecommendationPayloadHash({
        draftTitle: '__ig__',
        clientId: clientId ?? '',
        conversationId,
        botId
      })
    };
  }

  if (!clientId || !String(clientId).trim()) {
    return {
      ...base('insufficient_data', 'Нет привязки к карточке клиента (clientId)'),
      payloadHash: computeDealRecommendationPayloadHash({
        draftTitle: '__noclient__',
        clientId: '',
        conversationId,
        botId
      })
    };
  }

  const signals: string[] = [];
  let score = 0;

  if (extraction.wantsCommercialOffer === true) {
    signals.push('Запрос КП');
    score += 4;
  }
  if (extraction.wantsConsultation === true) {
    signals.push('Нужна консультация');
    score += 2;
  }
  if (isWarmOrHot(extraction.leadTemperature) || isWarmOrHot(extraction.interestLevel)) {
    signals.push('Тёплый/горячий интерес');
    score += 2;
  }
  if (extraction.city?.trim()) {
    signals.push('Город');
    score += 1;
  }
  if (parseAreaM2(extraction.areaM2) != null) {
    signals.push('Площадь');
    score += 1;
  }
  if (extraction.floors?.trim()) {
    signals.push('Этажность');
    score += 1;
  }
  if (
    extraction.projectType?.trim() ||
    extraction.houseFormat?.trim() ||
    extraction.wallType?.trim()
  ) {
    signals.push('Тип проекта');
    score += 1;
  }
  const ns = buildAppendNextStepSegment(extraction);
  if (ns) {
    signals.push('Следующий шаг');
    score += 1;
  }
  if ((extraction.summaryComment?.trim().length ?? 0) >= 25) {
    signals.push('Сводка разговора');
    score += 1;
  }

  const minScore = 3;
  if (score < minScore && extraction.wantsCommercialOffer !== true) {
    return {
      ...base(
        'insufficient_data',
        `Недостаточно признаков квалификации (балл ${score}, нужно от ${minScore} или явный запрос КП)`
      ),
      signals,
      payloadHash: computeDealRecommendationPayloadHash({
        draftTitle: '__low__',
        clientId: String(clientId).trim(),
        conversationId,
        botId
      })
    };
  }

  const draftTitle = buildAiDealTitle(extraction, extraction.clientName);
  const summary =
    signals.length > 0
      ? `Рекомендуем создать сделку: ${signals.slice(0, 4).join(', ')}`
      : 'Рекомендуем создать сделку по результатам диалога';

  const draftNote = buildAiDealNote({
    extraction,
    botName,
    conversationId,
    botId,
    summaryOneLine: extraction.summaryComment?.trim() ?? null,
    channel
  });

  const confidence: AiDealRecommendationSnapshot['confidence'] =
    score >= 6 || extraction.wantsCommercialOffer === true ? 'high' : score >= 4 ? 'medium' : 'low';

  const payloadHash = computeDealRecommendationPayloadHash({
    draftTitle,
    clientId: String(clientId).trim(),
    conversationId,
    botId
  });

  return {
    status: 'recommended',
    reason: null,
    summary,
    draftTitle,
    draftNote,
    clientId: String(clientId).trim(),
    preferredStageId: null,
    signals,
    confidence,
    createdFromBotId: botId,
    createdFromConversationId: conversationId,
    createdAt: new Date().toISOString(),
    payloadHash,
    dealRecommendationForLog,
    routing:
      params.routing ?? {
        recommendedPipelineId: null,
        recommendedPipelineName: null,
        recommendedStageId: null,
        recommendedStageName: null,
        recommendedAssigneeId: null,
        recommendedAssigneeName: null,
        routingReason: [],
        routingConfidence: 'low',
        routingWarnings: []
      }
  };
}
