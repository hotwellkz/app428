import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyIdToken, getCompanyIdForUser } from './lib/firebaseAdmin';
import { orchestrateVoiceOutbound, type VoiceOutboundRequestBody } from './lib/voice/voiceOutboundOrchestrator';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const uid = await verifyIdToken(token);
    const companyId = await getCompanyIdForUser(uid);
    if (!companyId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No company access' }) };
    }

    let body: Partial<VoiceOutboundRequestBody> = {};
    try {
      body = event.body ? (JSON.parse(event.body) as Partial<VoiceOutboundRequestBody>) : {};
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const out = await orchestrateVoiceOutbound(companyId, body as VoiceOutboundRequestBody);
    if (!out.ok) {
      return {
        statusCode: out.httpStatus,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: out.code,
          error: out.message,
          callId: out.callId ?? null,
          friendlyCode: out.friendlyCode ?? null,
          hint: out.hint ?? null,
          twilioCode: out.twilioCode ?? null
        })
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        callId: out.callId,
        providerCallId: out.providerCallId
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Внутренняя ошибка сервера',
        code: 'internal_error',
        callId: null,
        friendlyCode: null,
        hint: null,
        twilioCode: null
      })
    };
  }
};
