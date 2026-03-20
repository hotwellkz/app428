import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
import type { AiRecommendedTaskPriority } from '../../src/types/aiTaskRecommendation';

const DEALS = 'deals';
const DEAL_ACTIVITY = 'deal_activity_log';
const DEAL_HISTORY = 'deal_history';
const CONVERSATIONS = 'whatsappConversations';
const CHAT_MANAGERS = 'chatManagers';

function mapDealPriority(p: AiRecommendedTaskPriority): 'high' | 'medium' | 'low' {
  if (p === 'urgent' || p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

function parseIsoToTimestamp(iso: string | null | undefined): Timestamp | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

function asTaskRecommendation(raw: unknown): {
  payloadHash: string;
  canCreateTask: boolean;
  status: string;
  recommendedTaskTitle: string;
  recommendedTaskDescription: string;
  recommendedTaskType: string;
  recommendedPriority: AiRecommendedTaskPriority;
  recommendedDueAt: string | null;
  dueHint: string | null;
  dealId: string | null;
  suggestedResponsibleUserId: string | null;
  suggestedResponsibleNameSnapshot: string | null;
  createdFromBotId: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ph = typeof r.payloadHash === 'string' ? r.payloadHash.trim() : '';
  if (!ph || ph.length < 6) return null;
  const title = typeof r.recommendedTaskTitle === 'string' ? r.recommendedTaskTitle.trim() : '';
  if (!title) return null;
  const priRaw = r.recommendedPriority;
  const recommendedPriority: AiRecommendedTaskPriority =
    priRaw === 'low' ||
    priRaw === 'normal' ||
    priRaw === 'high' ||
    priRaw === 'urgent'
      ? priRaw
      : 'normal';
  return {
    payloadHash: ph,
    canCreateTask: r.canCreateTask === true,
    status: typeof r.status === 'string' ? r.status : '',
    recommendedTaskTitle: title.slice(0, 500),
    recommendedTaskDescription:
      typeof r.recommendedTaskDescription === 'string' ? r.recommendedTaskDescription.slice(0, 8000) : '',
    recommendedTaskType: typeof r.recommendedTaskType === 'string' ? r.recommendedTaskType : 'follow_up',
    recommendedPriority,
    recommendedDueAt: typeof r.recommendedDueAt === 'string' ? r.recommendedDueAt : null,
    dueHint: typeof r.dueHint === 'string' ? r.dueHint.slice(0, 500) : null,
    dealId: typeof r.dealId === 'string' ? r.dealId.trim() : null,
    suggestedResponsibleUserId:
      typeof r.suggestedResponsibleUserId === 'string' ? r.suggestedResponsibleUserId.trim() : null,
    suggestedResponsibleNameSnapshot:
      typeof r.suggestedResponsibleNameSnapshot === 'string'
        ? r.suggestedResponsibleNameSnapshot.trim()
        : null,
    createdFromBotId: typeof r.createdFromBotId === 'string' ? r.createdFromBotId : ''
  };
}

export type CreateTaskFromRecommendationResult =
  | {
      ok: true;
      dealId: string;
      taskId: string;
      nextActionAt: string | null;
      usedFallbacks: string[];
      finalResponsibleUserId: string | null;
      finalResponsibleNameSnapshot: string | null;
    }
  | { ok: false; code: 'duplicate' | 'invalid' | 'forbidden' | 'error'; message: string };

/**
 * Записывает «задачу» как nextAction / nextActionAt на сделке + аудит.
 * Дедуп по aiRuntime.taskFromAi.createdFromPayloadHash и совпадению payloadHash.
 */
export async function createTaskFromAiRecommendationAdmin(params: {
  companyId: string;
  conversationId: string;
  taskPayloadHash: string;
}): Promise<CreateTaskFromRecommendationResult> {
  const { companyId, conversationId, taskPayloadHash } = params;

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
  const taskRec = asTaskRecommendation(aiRt.taskRecommendation);
  if (!taskRec || taskRec.payloadHash !== taskPayloadHash) {
    return { ok: false, code: 'invalid', message: 'Рекомендация задачи устарела или не совпадает' };
  }
  if (!taskRec.canCreateTask) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Создание задачи по этой рекомендации недоступно (нет сделки или режим ручной проверки)'
    };
  }

  const taskFromAi = aiRt.taskFromAi as Record<string, unknown> | undefined;
  if (taskFromAi?.createdFromPayloadHash === taskPayloadHash) {
    return { ok: false, code: 'duplicate', message: 'Задача по этой рекомендации уже создана' };
  }

  const dealFromAi = aiRt.dealFromAi as { createdDealId?: string } | undefined;
  const dealIdRaw =
    taskRec.dealId ||
    (typeof conv.dealId === 'string' ? conv.dealId.trim() : '') ||
    (typeof dealFromAi?.createdDealId === 'string' ? dealFromAi.createdDealId.trim() : '');
  if (!dealIdRaw) {
    return { ok: false, code: 'invalid', message: 'Нет привязанной сделки' };
  }

  const dealRef = db.collection(DEALS).doc(dealIdRaw);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    return { ok: false, code: 'invalid', message: 'Сделка не найдена' };
  }
  const deal = dealSnap.data()!;
  if ((deal.companyId as string) !== companyId) {
    return { ok: false, code: 'forbidden', message: 'Сделка другой компании' };
  }

  if (deal.aiTaskRecommendationPayloadHash === taskPayloadHash) {
    return { ok: false, code: 'duplicate', message: 'Эта рекомендация уже применена к сделке' };
  }

  const usedFallbacks: string[] = [];
  let finalResponsibleId = (deal.responsibleUserId as string | null) ?? null;
  let finalResponsibleName = (deal.responsibleNameSnapshot as string | null) ?? null;

  if (!finalResponsibleId && taskRec.suggestedResponsibleUserId) {
    const ms = await db.collection(CHAT_MANAGERS).doc(taskRec.suggestedResponsibleUserId).get().catch(() => null);
    const md = ms?.data();
    if (ms?.exists && md && (md.companyId as string) === companyId) {
      finalResponsibleId = ms.id;
      finalResponsibleName = String(md.name ?? taskRec.suggestedResponsibleNameSnapshot ?? '');
    } else {
      usedFallbacks.push('assignee_fallback_no_manager_doc');
    }
  } else if (!finalResponsibleId) {
    usedFallbacks.push('assignee_null_on_deal');
  }

  const nextTs = parseIsoToTimestamp(taskRec.recommendedDueAt);
  const priority = mapDealPriority(taskRec.recommendedPriority);
  const now = FieldValue.serverTimestamp();
  const appliedIso = new Date().toISOString();

  const noteAppend = `\n\n--- WhatsApp • AI (автоворонка) — следующий шаг ---\n${taskRec.recommendedTaskDescription}`.slice(
    0,
    4000
  );
  const prevNote = typeof deal.note === 'string' ? deal.note : '';
  const newNote = (prevNote + noteAppend).slice(0, 12000);

  try {
    await dealRef.update({
      nextAction: taskRec.recommendedTaskTitle,
      nextActionAt: nextTs,
      priority,
      note: newNote,
      ...(finalResponsibleId && !(deal.responsibleUserId as string | null)
        ? {
            responsibleUserId: finalResponsibleId,
            responsibleNameSnapshot: finalResponsibleName
          }
        : {}),
      updatedAt: now,
      aiTaskFromRecommendation: true,
      aiTaskRecommendationPayloadHash: taskPayloadHash,
      aiTaskRecommendationType: taskRec.recommendedTaskType
    });

    await db.collection(DEAL_ACTIVITY).add({
      companyId,
      dealId: dealIdRaw,
      type: 'next_step_set',
      payload: {
        nextAction: taskRec.recommendedTaskTitle,
        nextActionAt: taskRec.recommendedDueAt,
        dueHint: taskRec.dueHint,
        source: 'WhatsApp • AI (автоворонка)',
        aiCreated: true,
        createdByAiRecommendation: true,
        aiBotId: taskRec.createdFromBotId,
        whatsappConversationId: conversationId,
        payloadHash: taskPayloadHash,
        recommendedTaskType: taskRec.recommendedTaskType,
        descriptionPreview: taskRec.recommendedTaskDescription.slice(0, 500)
      },
      createdBy: null,
      createdAt: now
    });

    await db.collection(DEAL_HISTORY).add({
      companyId,
      dealId: dealIdRaw,
      message: `Следующий шаг (AI): ${taskRec.recommendedTaskTitle}${taskRec.recommendedDueAt ? ` к ${taskRec.recommendedDueAt}` : ''}`,
      createdAt: now
    });

    const taskFromAiPayload = {
      appliedAt: appliedIso,
      createdFromPayloadHash: taskPayloadHash,
      dealId: dealIdRaw,
      taskId: dealIdRaw,
      finalResponsibleUserId: finalResponsibleId,
      finalResponsibleNameSnapshot: finalResponsibleName,
      finalNextActionAt: taskRec.recommendedDueAt,
      dueHintStored: taskRec.dueHint,
      createUsedFallbacks: usedFallbacks.length ? usedFallbacks : null,
      recommendedTaskType: taskRec.recommendedTaskType,
      aiBotId: taskRec.createdFromBotId || null,
      whatsappConversationId: conversationId
    };

    await convRef.update({
      'aiRuntime.taskFromAi': taskFromAiPayload,
      'aiRuntime.lastTaskCreateStatus': 'created',
      'aiRuntime.lastTaskCreateReason': null,
      'aiRuntime.lastTaskCreateAt': appliedIso
    });

    return {
      ok: true,
      dealId: dealIdRaw,
      taskId: dealIdRaw,
      nextActionAt: taskRec.recommendedDueAt,
      usedFallbacks,
      finalResponsibleUserId: finalResponsibleId,
      finalResponsibleNameSnapshot: finalResponsibleName
    };
  } catch (e) {
    console.error('[createTaskFromAiRecommendationAdmin]', e);
    return {
      ok: false,
      code: 'error',
      message: e instanceof Error ? e.message : 'Ошибка записи задачи'
    };
  }
}

/**
 * Post-call voice: применить рекомендацию задачи к сделке без whatsappConversations.
 */
export async function applyVoiceTaskRecommendationToDealAdmin(params: {
  companyId: string;
  dealId: string;
  voiceCallId: string;
  taskPayloadHash: string;
  taskSnapshot: Record<string, unknown>;
}): Promise<CreateTaskFromRecommendationResult> {
  const { companyId, dealId: dealIdRaw, voiceCallId, taskPayloadHash } = params;
  const taskRec = asTaskRecommendation(params.taskSnapshot);
  if (!taskRec || taskRec.payloadHash !== taskPayloadHash) {
    return { ok: false, code: 'invalid', message: 'Рекомендация задачи устарела или не совпадает' };
  }
  if (!taskRec.canCreateTask) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Создание задачи по этой рекомендации недоступно'
    };
  }
  if (taskRec.dealId && taskRec.dealId !== dealIdRaw) {
    return { ok: false, code: 'invalid', message: 'Сделка не совпадает с рекомендацией' };
  }

  const db = getDb();
  const dealRef = db.collection(DEALS).doc(dealIdRaw);
  const dealSnap = await dealRef.get();
  if (!dealSnap.exists) {
    return { ok: false, code: 'invalid', message: 'Сделка не найдена' };
  }
  const deal = dealSnap.data()!;
  if ((deal.companyId as string) !== companyId) {
    return { ok: false, code: 'forbidden', message: 'Сделка другой компании' };
  }
  if (deal.aiTaskRecommendationPayloadHash === taskPayloadHash) {
    return { ok: false, code: 'duplicate', message: 'Эта рекомендация уже применена к сделке' };
  }

  const usedFallbacks: string[] = [];
  let finalResponsibleId = (deal.responsibleUserId as string | null) ?? null;
  let finalResponsibleName = (deal.responsibleNameSnapshot as string | null) ?? null;

  if (!finalResponsibleId && taskRec.suggestedResponsibleUserId) {
    const ms = await db.collection(CHAT_MANAGERS).doc(taskRec.suggestedResponsibleUserId).get().catch(() => null);
    const md = ms?.data();
    if (ms?.exists && md && (md.companyId as string) === companyId) {
      finalResponsibleId = ms.id;
      finalResponsibleName = String(md.name ?? taskRec.suggestedResponsibleNameSnapshot ?? '');
    } else {
      usedFallbacks.push('assignee_fallback_no_manager_doc');
    }
  } else if (!finalResponsibleId) {
    usedFallbacks.push('assignee_null_on_deal');
  }

  const nextTs = parseIsoToTimestamp(taskRec.recommendedDueAt);
  const priority = mapDealPriority(taskRec.recommendedPriority);
  const now = FieldValue.serverTimestamp();
  const appliedIso = new Date().toISOString();

  const noteAppend =
    `\n\n--- Голосовой звонок • AI (автоворонка) — следующий шаг ---\n${taskRec.recommendedTaskDescription}`.slice(
      0,
      4000
    );
  const prevNote = typeof deal.note === 'string' ? deal.note : '';
  const newNote = (prevNote + noteAppend).slice(0, 12000);

  try {
    await dealRef.update({
      nextAction: taskRec.recommendedTaskTitle,
      nextActionAt: nextTs,
      priority,
      note: newNote,
      ...(finalResponsibleId && !(deal.responsibleUserId as string | null)
        ? {
            responsibleUserId: finalResponsibleId,
            responsibleNameSnapshot: finalResponsibleName
          }
        : {}),
      updatedAt: now,
      aiTaskFromRecommendation: true,
      aiTaskRecommendationPayloadHash: taskPayloadHash,
      aiTaskRecommendationType: taskRec.recommendedTaskType,
      voiceCallSessionId: voiceCallId
    });

    await db.collection(DEAL_ACTIVITY).add({
      companyId,
      dealId: dealIdRaw,
      type: 'next_step_set',
      payload: {
        nextAction: taskRec.recommendedTaskTitle,
        nextActionAt: taskRec.recommendedDueAt,
        dueHint: taskRec.dueHint,
        source: 'Голосовой звонок · AI (автоворонка)',
        aiCreated: true,
        createdByAiRecommendation: true,
        aiBotId: taskRec.createdFromBotId,
        voiceCallSessionId: voiceCallId,
        payloadHash: taskPayloadHash,
        recommendedTaskType: taskRec.recommendedTaskType,
        descriptionPreview: taskRec.recommendedTaskDescription.slice(0, 500)
      },
      createdBy: null,
      createdAt: now
    });

    await db.collection(DEAL_HISTORY).add({
      companyId,
      dealId: dealIdRaw,
      message: `Следующий шаг (AI, голос): ${taskRec.recommendedTaskTitle}${taskRec.recommendedDueAt ? ` к ${taskRec.recommendedDueAt}` : ''}`,
      createdAt: now
    });

    return {
      ok: true,
      dealId: dealIdRaw,
      taskId: dealIdRaw,
      nextActionAt: taskRec.recommendedDueAt,
      usedFallbacks,
      finalResponsibleUserId: finalResponsibleId,
      finalResponsibleNameSnapshot: finalResponsibleName
    };
  } catch (e) {
    console.error('[applyVoiceTaskRecommendationToDealAdmin]', e);
    return {
      ok: false,
      code: 'error',
      message: e instanceof Error ? e.message : 'Ошибка записи задачи'
    };
  }
}
