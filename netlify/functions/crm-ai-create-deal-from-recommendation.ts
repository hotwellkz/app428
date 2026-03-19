import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { FieldValue } from 'firebase-admin/firestore';
import { getCrmUserAuthFromRequest } from './lib/crmUserAuth';
import { createDealFromAiRecommendationAdmin } from './lib/createPipelineDealAdmin';
import { getDb } from './lib/firebaseAdmin';

const LOG_PREFIX = '[crm-ai-create-deal-from-recommendation]';
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
  payloadHash?: string;
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
  const payloadHash = typeof body.payloadHash === 'string' ? body.payloadHash.trim() : '';
  if (!conversationId || !payloadHash) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Нужны conversationId и payloadHash' })
    });
  }

  const result = await createDealFromAiRecommendationAdmin({
    companyId: auth.companyId,
    conversationId,
    payloadHash
  });

  const db = getDb();
  const convSnap = await db.collection('whatsappConversations').doc(conversationId).get();
  const conv = convSnap.data() ?? {};
  const aiRt = (conv.aiRuntime ?? {}) as Record<string, unknown>;
  const rec = aiRt.dealRecommendation as Record<string, unknown> | undefined;
  const botId = typeof rec?.createdFromBotId === 'string' ? rec.createdFromBotId : 'unknown';

  const logRun = async (extra: Record<string, unknown>) => {
    try {
      await db.collection(WHATSAPP_AI_BOT_RUNS).add({
        companyId: auth.companyId,
        conversationId,
        botId,
        mode: 'deal_create',
        triggerMessageId: `deal_${payloadHash.slice(0, 12)}`,
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
      no_pipeline: 422,
      forbidden: 403,
      error: 500
    };
    const code = result.code;
    await logRun({
      status: 'skipped',
      reason: result.message,
      dealCreateStatus: code === 'duplicate' ? 'duplicate' : code === 'no_pipeline' ? 'skipped' : 'error',
      dealCreateReason: result.message,
      dealRecommendationStatus: rec?.status ?? null,
      dealRecommendationReason: rec?.reason ?? null,
      dealDraftTitle: rec?.draftTitle ?? null,
      routing: rec?.routing ?? null
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
    dealCreateStatus: 'created',
    dealCreateReason: null,
    createdDealId: result.dealId,
    createdDealTitle: result.dealTitle,
    createdDealAt: new Date().toISOString(),
    dealRecommendationStatus: 'recommended',
    dealDraftTitle: result.dealTitle,
    finalPipelineId: result.pipelineId,
    finalPipelineName: result.pipelineName,
    finalStageId: result.stageId,
    finalStageName: result.stageName,
    finalAssigneeId: result.assigneeId,
    finalAssigneeName: result.assigneeName,
    createUsedFallbacks: result.usedFallbacks
  });

  log('created deal', result.dealId, conversationId);

  return withCors({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      dealId: result.dealId,
      dealTitle: result.dealTitle,
      pipelineName: result.pipelineName,
      stageId: result.stageId,
      stageName: result.stageName,
      pipelineId: result.pipelineId,
      assigneeId: result.assigneeId,
      assigneeName: result.assigneeName,
      usedFallbacks: result.usedFallbacks
    })
  });
};
