/**
 * Ручной / внутренний запуск post-call pipeline (не из Twilio).
 * POST JSON: { companyId, callId, force?: boolean }
 * Заголовок X-Voice-Post-Call-Secret — если задан VOICE_POST_CALL_DISPATCH_SECRET в env.
 */
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { runVoicePostCallPipeline } from './lib/voice/runVoicePostCallPipeline';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...JSON_HEADERS, 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const expected = process.env.VOICE_POST_CALL_DISPATCH_SECRET?.trim();
  if (expected) {
    const h =
      event.headers['x-voice-post-call-secret'] ??
      event.headers['X-Voice-Post-Call-Secret'] ??
      '';
    if (h !== expected) {
      return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  let body: { companyId?: string; callId?: string; force?: boolean };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as object) ?? {};
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  const callId = typeof body.callId === 'string' ? body.callId.trim() : '';
  if (!companyId || !callId) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'companyId and callId are required' })
    };
  }

  const result = await runVoicePostCallPipeline({
    companyId,
    callId,
    force: body.force === true
  });

  return {
    statusCode: result.ok ? 200 : 500,
    headers: JSON_HEADERS,
    body: JSON.stringify(result)
  };
};
