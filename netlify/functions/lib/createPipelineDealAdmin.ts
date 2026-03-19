import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
import { resolveCrmClientIdForWhatsappConversation } from './resolveCrmClientIdFromWhatsapp';
const PIPELINES = 'pipelines';
const STAGES = 'pipeline_stages';
const DEALS = 'deals';
const DEAL_ACTIVITY = 'deal_activity_log';
const DEAL_HISTORY = 'deal_history';
const CRM_CLIENTS = 'clients';
const CONVERSATIONS = 'whatsappConversations';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

export async function resolveDefaultPipelineFirstStage(companyId: string): Promise<{
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  stageColor: string | null;
} | null> {
  const db = getDb();
  const pipes = await db
    .collection(PIPELINES)
    .where('companyId', '==', companyId)
    .orderBy('sortOrder', 'asc')
    .limit(1)
    .get();
  if (pipes.empty) return null;
  const p = pipes.docs[0];
  const stages = await db
    .collection(STAGES)
    .where('companyId', '==', companyId)
    .where('pipelineId', '==', p.id)
    .orderBy('sortOrder', 'asc')
    .limit(1)
    .get();
  if (stages.empty) return null;
  const s = stages.docs[0];
  const sd = s.data();
  return {
    pipelineId: p.id,
    pipelineName: String((p.data().name as string) ?? 'Воронка'),
    stageId: s.id,
    stageName: String(sd.name ?? 'Новый'),
    stageColor: sd.color != null ? String(sd.color) : null
  };
}

export type CreateDealFromRecommendationResult =
  | {
      ok: true;
      dealId: string;
      dealTitle: string;
      pipelineId: string;
      pipelineName: string;
      stageId: string;
      stageName: string;
      assigneeId: string | null;
      assigneeName: string | null;
      usedFallbacks: string[];
    }
  | { ok: false; code: 'duplicate' | 'invalid' | 'no_pipeline' | 'forbidden' | 'error'; message: string };

function asRecommendation(raw: unknown): {
  status: string;
  payloadHash: string;
  draftTitle: string | null;
  draftNote: string | null;
  clientId: string | null;
  summary: string | null;
  createdFromBotId: string;
  routing: {
    recommendedPipelineId: string | null;
    recommendedPipelineName: string | null;
    recommendedStageId: string | null;
    recommendedStageName: string | null;
    recommendedAssigneeId: string | null;
    recommendedAssigneeName: string | null;
    routingReason: string[];
    routingConfidence: 'high' | 'medium' | 'low';
    routingWarnings: string[];
  } | null;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.status !== 'recommended') return null;
  const ph = typeof r.payloadHash === 'string' ? r.payloadHash : '';
  if (!ph) return null;
  return {
    status: 'recommended',
    payloadHash: ph,
    draftTitle: typeof r.draftTitle === 'string' ? r.draftTitle : null,
    draftNote: typeof r.draftNote === 'string' ? r.draftNote : null,
    clientId: typeof r.clientId === 'string' ? r.clientId : null,
    summary: typeof r.summary === 'string' ? r.summary : null,
    createdFromBotId: typeof r.createdFromBotId === 'string' ? r.createdFromBotId : '',
    routing:
      r.routing && typeof r.routing === 'object'
        ? {
            recommendedPipelineId:
              typeof (r.routing as Record<string, unknown>).recommendedPipelineId === 'string'
                ? ((r.routing as Record<string, unknown>).recommendedPipelineId as string)
                : null,
            recommendedPipelineName:
              typeof (r.routing as Record<string, unknown>).recommendedPipelineName === 'string'
                ? ((r.routing as Record<string, unknown>).recommendedPipelineName as string)
                : null,
            recommendedStageId:
              typeof (r.routing as Record<string, unknown>).recommendedStageId === 'string'
                ? ((r.routing as Record<string, unknown>).recommendedStageId as string)
                : null,
            recommendedStageName:
              typeof (r.routing as Record<string, unknown>).recommendedStageName === 'string'
                ? ((r.routing as Record<string, unknown>).recommendedStageName as string)
                : null,
            recommendedAssigneeId:
              typeof (r.routing as Record<string, unknown>).recommendedAssigneeId === 'string'
                ? ((r.routing as Record<string, unknown>).recommendedAssigneeId as string)
                : null,
            recommendedAssigneeName:
              typeof (r.routing as Record<string, unknown>).recommendedAssigneeName === 'string'
                ? ((r.routing as Record<string, unknown>).recommendedAssigneeName as string)
                : null,
            routingReason: Array.isArray((r.routing as Record<string, unknown>).routingReason)
              ? ((r.routing as Record<string, unknown>).routingReason as unknown[])
                  .map((x) => String(x).trim())
                  .filter(Boolean)
              : [],
            routingConfidence:
              (r.routing as Record<string, unknown>).routingConfidence === 'high' ||
              (r.routing as Record<string, unknown>).routingConfidence === 'medium' ||
              (r.routing as Record<string, unknown>).routingConfidence === 'low'
                ? ((r.routing as Record<string, unknown>).routingConfidence as 'high' | 'medium' | 'low')
                : 'low',
            routingWarnings: Array.isArray((r.routing as Record<string, unknown>).routingWarnings)
              ? ((r.routing as Record<string, unknown>).routingWarnings as unknown[])
                  .map((x) => String(x).trim())
                  .filter(Boolean)
              : []
          }
        : null
  };
}

/**
 * Создание сделки по сохранённой в чате рекомендации + привязка к WhatsApp-чату.
 */
export async function createDealFromAiRecommendationAdmin(params: {
  companyId: string;
  conversationId: string;
  payloadHash: string;
}): Promise<CreateDealFromRecommendationResult> {
  const { companyId, conversationId, payloadHash } = params;

  const db = getDb();
  const convRef = db.collection(CONVERSATIONS).doc(conversationId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    return { ok: false, code: 'invalid', message: 'Чат не найден' };
  }
  const conv = convSnap.data()!;
  if ((conv.companyId as string) !== companyId) {
    return { ok: false, code: 'forbidden', message: 'Чат другой компании' };
  }

  const aiRt = (conv.aiRuntime ?? {}) as Record<string, unknown>;
  const recommendation = asRecommendation(aiRt.dealRecommendation);
  if (!recommendation || recommendation.payloadHash !== payloadHash) {
    return { ok: false, code: 'invalid', message: 'Рекомендация устарела или не совпадает с сохранённой' };
  }
  if (!recommendation.draftTitle?.trim() || !recommendation.clientId) {
    return { ok: false, code: 'invalid', message: 'Неполные данные черновика сделки' };
  }

  const dealFromAi = aiRt.dealFromAi as { createdDealId?: string | null } | undefined;
  if (dealFromAi?.createdDealId) {
    return {
      ok: false,
      code: 'duplicate',
      message: 'Сделка по этой рекомендации уже создана'
    };
  }

  const existingDealId = conv.dealId as string | undefined;
  if (existingDealId && String(existingDealId).trim()) {
    return {
      ok: false,
      code: 'duplicate',
      message: 'У чата уже есть привязанная сделка'
    };
  }

  const effectiveClientId = await resolveCrmClientIdForWhatsappConversation(
    db,
    companyId,
    conv as Record<string, unknown>,
    recommendation.clientId
  );
  if (!effectiveClientId) {
    return {
      ok: false,
      code: 'invalid',
      message:
        'Карточка клиента CRM не найдена. В чате указан контакт WhatsApp; создайте или привяжите карточку в разделе «Клиенты» с тем же номером телефона.'
    };
  }

  const clientRef = db.collection(CRM_CLIENTS).doc(effectiveClientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    return { ok: false, code: 'invalid', message: 'Карточка клиента не найдена' };
  }
  const client = clientSnap.data()!;
  if ((client.companyId as string) !== companyId) {
    return { ok: false, code: 'forbidden', message: 'Клиент другой компании' };
  }

  const stageInfoDefault = await resolveDefaultPipelineFirstStage(companyId);
  if (!stageInfoDefault) {
    return { ok: false, code: 'no_pipeline', message: 'Нет воронки или этапов. Создайте воронку в CRM.' };
  }
  const usedFallbacks: string[] = [];

  let finalPipelineId = stageInfoDefault.pipelineId;
  let finalPipelineName = stageInfoDefault.pipelineName;
  let finalStageId = stageInfoDefault.stageId;
  let finalStageName = stageInfoDefault.stageName;

  if (recommendation.routing?.recommendedPipelineId) {
    const pSnap = await db.collection(PIPELINES).doc(recommendation.routing.recommendedPipelineId).get().catch(() => null);
    const pd = pSnap?.data();
    if (pSnap?.exists && pd && (pd.companyId as string) === companyId && pd.isActive !== false) {
      finalPipelineId = pSnap.id;
      finalPipelineName = String(pd.name ?? recommendation.routing.recommendedPipelineName ?? 'Воронка');
    } else {
      usedFallbacks.push('pipeline_fallback_first_active');
    }
  } else {
    usedFallbacks.push('pipeline_fallback_first_active');
  }

  const stagesSnap = await db
    .collection(STAGES)
    .where('companyId', '==', companyId)
    .where('pipelineId', '==', finalPipelineId)
    .where('isActive', '==', true)
    .orderBy('sortOrder', 'asc')
    .limit(200)
    .get()
    .catch(() => null);
  const stages = stagesSnap?.docs ?? [];
  if (!stages.length) {
    usedFallbacks.push('stage_fallback_to_default_pipeline');
    finalPipelineId = stageInfoDefault.pipelineId;
    finalPipelineName = stageInfoDefault.pipelineName;
    finalStageId = stageInfoDefault.stageId;
    finalStageName = stageInfoDefault.stageName;
  }
  const preferredStageId = recommendation.routing?.recommendedStageId ?? null;
  const preferredStageDoc = preferredStageId ? stages.find((d) => d.id === preferredStageId) ?? null : null;
  const finalStageDoc = stages.length ? preferredStageDoc ?? stages[0] : null;
  if (stages.length && !preferredStageDoc) usedFallbacks.push('stage_fallback_first_in_pipeline');
  if (finalStageDoc) {
    finalStageId = finalStageDoc.id;
    const finalStageData = finalStageDoc.data();
    finalStageName = String(finalStageData.name ?? 'Этап');
  }
  const finalStageColor = finalStageDoc?.data().color != null ? String(finalStageDoc?.data().color) : stageInfoDefault.stageColor;

  let finalAssigneeId: string | null = null;
  let finalAssigneeName: string | null = null;
  if (recommendation.routing?.recommendedAssigneeId) {
    const ms = await db.collection('chatManagers').doc(recommendation.routing.recommendedAssigneeId).get().catch(() => null);
    const md = ms?.data();
    if (ms?.exists && md && (md.companyId as string) === companyId) {
      finalAssigneeId = ms.id;
      finalAssigneeName = String(md.name ?? recommendation.routing.recommendedAssigneeName ?? '');
    } else {
      usedFallbacks.push('assignee_fallback_missing_or_inactive');
    }
  } else {
    usedFallbacks.push('assignee_fallback_null');
  }

  const phoneRaw =
    (client.phone as string) || (conv.phone as string) || '';
  const clientPhoneSnapshot = normalizePhone(phoneRaw);
  const clientNameSnapshot =
    (client.name as string)?.trim() || recommendation.draftTitle.slice(0, 120);

  const now = FieldValue.serverTimestamp();
  const note = (recommendation.draftNote ?? '').trim() || recommendation.summary?.trim() || '';

  try {
    const dealRef = await db.collection(DEALS).add({
      companyId,
      pipelineId: finalPipelineId,
      stageId: finalStageId,
      title: recommendation.draftTitle!.trim().slice(0, 500),
      clientId: effectiveClientId,
      clientNameSnapshot,
      clientPhoneSnapshot: clientPhoneSnapshot || null,
      amount: null,
      currency: 'KZT',
      responsibleUserId: finalAssigneeId,
      responsibleNameSnapshot: finalAssigneeName,
      status: null,
      priority: null,
      note,
      source: 'WhatsApp · AI (автоворонка)',
      tags: ['Автоворонка AI'],
      sortOrder: Date.now(),
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      stageChangedAt: now,
      nextAction: null,
      nextActionAt: null,
      isArchived: false,
      deletedAt: null,
      whatsappConversationId: conversationId,
      createdByAiRecommendation: true,
      aiRecommendationBotId: recommendation.createdFromBotId,
      aiRecommendationPayloadHash: payloadHash
    });

    const dealId = dealRef.id;

    await db.collection(DEAL_ACTIVITY).add({
      companyId,
      dealId,
      type: 'created',
      payload: { pipelineId: finalPipelineId, stageId: finalStageId, source: 'ai_recommendation' },
      createdBy: null,
      createdAt: now
    });

    await db.collection(DEAL_HISTORY).add({
      companyId,
      dealId,
      message: 'Сделка создана из рекомендации AI (автоворонка)',
      createdAt: now
    });

    const dealTitle = recommendation.draftTitle!.trim();
    const createdAtIso = new Date().toISOString();

    await convRef.update({
      dealId,
      dealStageId: finalStageId,
      dealStageName: finalStageName,
      dealStageColor: finalStageColor,
      dealTitle,
      dealResponsibleName: finalAssigneeName,
      'aiRuntime.dealFromAi': {
        createdDealId: dealId,
        createdDealTitle: dealTitle,
        createdDealAt: createdAtIso,
        createdFromPayloadHash: payloadHash,
        finalPipelineId,
        finalPipelineName,
        finalStageId,
        finalStageName,
        finalAssigneeId,
        finalAssigneeName,
        createUsedFallbacks: usedFallbacks
      }
    });

    return {
      ok: true,
      dealId,
      dealTitle,
      pipelineId: finalPipelineId,
      pipelineName: finalPipelineName,
      stageId: finalStageId,
      stageName: finalStageName,
      assigneeId: finalAssigneeId,
      assigneeName: finalAssigneeName,
      usedFallbacks
    };
  } catch (e) {
    console.error('[createDealFromAiRecommendationAdmin]', e);
    return {
      ok: false,
      code: 'error',
      message: e instanceof Error ? e.message : 'Ошибка создания сделки'
    };
  }
}
