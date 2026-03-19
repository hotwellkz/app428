import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
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
      stageId: string;
      stageName: string;
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
    createdFromBotId: typeof r.createdFromBotId === 'string' ? r.createdFromBotId : ''
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

  const clientRef = db.collection(CRM_CLIENTS).doc(recommendation.clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) {
    return { ok: false, code: 'invalid', message: 'Карточка клиента не найдена' };
  }
  const client = clientSnap.data()!;
  if ((client.companyId as string) !== companyId) {
    return { ok: false, code: 'forbidden', message: 'Клиент другой компании' };
  }

  const stageInfo = await resolveDefaultPipelineFirstStage(companyId);
  if (!stageInfo) {
    return { ok: false, code: 'no_pipeline', message: 'Нет воронки или этапов. Создайте воронку в CRM.' };
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
      pipelineId: stageInfo.pipelineId,
      stageId: stageInfo.stageId,
      title: recommendation.draftTitle!.trim().slice(0, 500),
      clientId: recommendation.clientId,
      clientNameSnapshot,
      clientPhoneSnapshot: clientPhoneSnapshot || null,
      amount: null,
      currency: 'KZT',
      responsibleUserId: null,
      responsibleNameSnapshot: null,
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
      payload: { pipelineId: stageInfo.pipelineId, stageId: stageInfo.stageId, source: 'ai_recommendation' },
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
      dealStageId: stageInfo.stageId,
      dealStageName: stageInfo.stageName,
      dealStageColor: stageInfo.stageColor,
      dealTitle,
      dealResponsibleName: null,
      'aiRuntime.dealFromAi': {
        createdDealId: dealId,
        createdDealTitle: dealTitle,
        createdDealAt: createdAtIso,
        createdFromPayloadHash: payloadHash
      }
    });

    return {
      ok: true,
      dealId,
      dealTitle,
      pipelineId: stageInfo.pipelineId,
      stageId: stageInfo.stageId,
      stageName: stageInfo.stageName
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
