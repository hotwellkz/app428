/**
 * Создание сделки из snapshot рекомендации после голосового звонка (без whatsappConversations).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';
import { resolveDefaultPipelineFirstStage } from '../createPipelineDealAdmin';
import type { AiDealRecommendationSnapshot } from '../../../../src/types/aiDealRecommendation';

const PIPELINES = 'pipelines';
const STAGES = 'pipeline_stages';
const DEALS = 'deals';
const DEAL_ACTIVITY = 'deal_activity_log';
const DEAL_HISTORY = 'deal_history';
const CRM_CLIENTS = 'clients';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

export type VoiceDealCreateResult =
  | { ok: true; dealId: string; dealTitle: string; usedFallbacks: string[] }
  | { ok: false; code: string; message: string };

export async function createVoiceDealFromRecommendationSnapshot(params: {
  companyId: string;
  voiceCallId: string;
  snapshot: AiDealRecommendationSnapshot;
}): Promise<VoiceDealCreateResult> {
  const { companyId, voiceCallId, snapshot } = params;
  if (snapshot.status !== 'recommended') {
    return { ok: false, code: 'not_recommended', message: snapshot.reason ?? 'Сделка не рекомендована' };
  }
  if (!snapshot.draftTitle?.trim() || !snapshot.clientId?.trim()) {
    return { ok: false, code: 'invalid', message: 'Неполные данные черновика сделки' };
  }

  const db = getDb();
  const recommendation = {
    draftTitle: snapshot.draftTitle.trim(),
    draftNote: snapshot.draftNote?.trim() ?? '',
    clientId: snapshot.clientId.trim(),
    summary: snapshot.summary?.trim() ?? null,
    createdFromBotId: snapshot.createdFromBotId,
    payloadHash: snapshot.payloadHash,
    routing: snapshot.routing
  };

  const clientRef = db.collection(CRM_CLIENTS).doc(recommendation.clientId);
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
    return { ok: false, code: 'no_pipeline', message: 'Нет воронки или этапов' };
  }
  const usedFallbacks: string[] = [];

  let finalPipelineId = stageInfoDefault.pipelineId;
  let finalPipelineName = stageInfoDefault.pipelineName;
  let finalStageId = stageInfoDefault.stageId;
  let finalStageName = stageInfoDefault.stageName;

  const r = recommendation.routing;
  if (r?.recommendedPipelineId) {
    const pSnap = await db.collection(PIPELINES).doc(r.recommendedPipelineId).get().catch(() => null);
    const pd = pSnap?.data();
    if (pSnap?.exists && pd && (pd.companyId as string) === companyId && pd.isActive !== false) {
      finalPipelineId = pSnap.id;
      finalPipelineName = String(pd.name ?? r.recommendedPipelineName ?? 'Воронка');
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
  const preferredStageId = r?.recommendedStageId ?? null;
  const preferredStageDoc = preferredStageId ? stages.find((d) => d.id === preferredStageId) ?? null : null;
  const finalStageDoc = stages.length ? preferredStageDoc ?? stages[0] : null;
  if (stages.length && !preferredStageDoc) usedFallbacks.push('stage_fallback_first_in_pipeline');
  if (finalStageDoc) {
    finalStageId = finalStageDoc.id;
    finalStageName = String(finalStageDoc.data().name ?? 'Этап');
  }
  const finalStageColor =
    finalStageDoc?.data().color != null ? String(finalStageDoc?.data().color) : stageInfoDefault.stageColor;

  let finalAssigneeId: string | null = null;
  let finalAssigneeName: string | null = null;
  if (r?.recommendedAssigneeId) {
    const ms = await db.collection('chatManagers').doc(r.recommendedAssigneeId).get().catch(() => null);
    const md = ms?.data();
    if (ms?.exists && md && (md.companyId as string) === companyId) {
      finalAssigneeId = ms.id;
      finalAssigneeName = String(md.name ?? r.recommendedAssigneeName ?? '');
    } else {
      usedFallbacks.push('assignee_fallback_missing_or_inactive');
    }
  } else {
    usedFallbacks.push('assignee_fallback_null');
  }

  const phoneRaw = (client.phone as string) || '';
  const clientPhoneSnapshot = normalizePhone(phoneRaw);
  const clientNameSnapshot = (client.name as string)?.trim() || recommendation.draftTitle.slice(0, 120);

  const now = FieldValue.serverTimestamp();
  const note = (recommendation.draftNote ?? '').trim() || recommendation.summary?.trim() || '';

  try {
    const dealRef = await db.collection(DEALS).add({
      companyId,
      pipelineId: finalPipelineId,
      stageId: finalStageId,
      title: recommendation.draftTitle.slice(0, 500),
      clientId: recommendation.clientId,
      clientNameSnapshot,
      clientPhoneSnapshot: clientPhoneSnapshot || null,
      amount: null,
      currency: 'KZT',
      responsibleUserId: finalAssigneeId,
      responsibleNameSnapshot: finalAssigneeName,
      status: null,
      priority: null,
      note,
      source: 'Голосовой звонок · AI (автоворонка)',
      tags: ['Автоворонка AI', 'Voice'],
      sortOrder: Date.now(),
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      stageChangedAt: now,
      nextAction: null,
      nextActionAt: null,
      isArchived: false,
      deletedAt: null,
      whatsappConversationId: null,
      voiceCallSessionId: voiceCallId,
      createdByAiRecommendation: true,
      aiRecommendationBotId: recommendation.createdFromBotId,
      aiRecommendationPayloadHash: recommendation.payloadHash
    });

    const dealId = dealRef.id;
    const dealTitle = recommendation.draftTitle;

    await db.collection(DEAL_ACTIVITY).add({
      companyId,
      dealId,
      type: 'created',
      payload: { pipelineId: finalPipelineId, stageId: finalStageId, source: 'ai_voice_recommendation' },
      createdBy: null,
      createdAt: now
    });

    await db.collection(DEAL_HISTORY).add({
      companyId,
      dealId,
      message: 'Сделка создана из рекомендации AI (голосовой звонок)',
      createdAt: now
    });

    return {
      ok: true,
      dealId,
      dealTitle,
      usedFallbacks
    };
  } catch (e) {
    console.error('[createVoiceDealFromRecommendationSnapshot]', e);
    return {
      ok: false,
      code: 'error',
      message: e instanceof Error ? e.message : 'Ошибка создания сделки'
    };
  }
}
