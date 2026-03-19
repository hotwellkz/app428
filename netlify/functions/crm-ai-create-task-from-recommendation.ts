import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { FieldValue } from 'firebase-admin/firestore';
import { getCrmUserAuthFromRequest } from './lib/crmUserAuth';
import { createTaskFromAiRecommendationAdmin } from './lib/createAiTaskOnDealAdmin';
import { getDb } from './lib/firebaseAdmin';

const LOG_PREFIX = '[crm-ai-create-task-from-recommendation]';
const WHATSAPP_AI_BOT_RUNS = 'whatsappAiBotRuns';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

interface Body {
  conversationId?: string;
  taskPayloadHash?: string;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }
  if (event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  }

  const auth = await getCrmUserAuthFromRequest(event);
  if (!auth.ok) {
    return withCors({
      statusCode: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error })
    });
  }

  let body: Body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as Body) ?? {};
  } catch {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  const taskPayloadHash = typeof body.taskPayloadHash === 'string' ? body.taskPayloadHash.trim() : '';
  if (!conversationId || !taskPayloadHash) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Нужны conversationId и taskPayloadHash' })
    });
  }

  const result = await createTaskFromAiRecommendationAdmin({
    companyId: auth.companyId,
    conversationId,
    taskPayloadHash
  });

  const db = getDb();
  const convSnap = await db.collection('whatsappConversations').doc(conversationId).get();
  const conv = convSnap.data() ?? {};
  const aiRt = (conv.aiRuntime ?? {}) as Record<string, unknown>;
  const tr = aiRt.taskRecommendation as Record<string, unknown> | undefined;
  const botId = typeof tr?.createdFromBotId === 'string' ? tr.createdFromBotId : 'unknown';

  const logRun = async (extra: Record<string, unknown>) => {
    try {
      await db.collection(WHATSAPP_AI_BOT_RUNS).add({
        companyId: auth.companyId,
        conversationId,
        botId,
        mode: 'task_create',
        triggerMessageId: `task_${taskPayloadHash.slice(0, 16)}`,
        startedAt: FieldValue.serverTimestamp(),
        finishedAt: FieldValue.serverTimestamp(),
        status: 'success',
        createdAt: FieldValue.serverTimestamp(),
        ...extra
      });
    } catch (e) {
      log('log run failed', e);
    }
  };

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      duplicate: 409,
      invalid: 400,
      forbidden: 403,
      error: 500
    };
    const code = result.code;
    await logRun({
      status: code === 'duplicate' ? 'skipped' : 'error',
      reason: result.message,
      taskCreateStatus: code === 'duplicate' ? 'duplicate' : 'error',
      taskCreateReason: result.message,
      taskRecommendationStatus: tr?.status ?? null,
      taskRecommendationTitle: tr?.recommendedTaskTitle ?? null,
      taskPayloadHash
    });
    return withCors({
      statusCode: statusMap[code] ?? 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: result.code,
        error: result.message
      })
    });
  }

  await logRun({
    status: 'success',
    reason: null,
    taskCreateStatus: 'created',
    taskCreateReason: null,
    taskId: result.taskId,
    dealId: result.dealId,
    finalNextActionAt: result.nextActionAt,
    createUsedFallbacks: result.usedFallbacks,
    taskRecommendationStatus: tr?.status ?? null,
    taskRecommendationTitle: tr?.recommendedTaskTitle ?? null,
    taskPayloadHash
  });

  log('created task/next step', result.taskId, conversationId);

  return withCors({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      taskId: result.taskId,
      dealId: result.dealId,
      nextActionAt: result.nextActionAt,
      usedFallbacks: result.usedFallbacks,
      finalResponsibleUserId: result.finalResponsibleUserId,
      finalResponsibleNameSnapshot: result.finalResponsibleNameSnapshot
    })
  });
};
