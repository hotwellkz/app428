/**
 * Плановый sweep: voiceCallSessions с postCallStatus=pending → runVoicePostCallPipeline.
 */
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { adminListVoiceSessionsPendingPostCall } from './lib/voice/voiceFirestoreAdmin';
import { runVoicePostCallPipeline } from './lib/voice/runVoicePostCallPipeline';

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.headers['x-netlify-scheduled'] !== 'true' && event.trigger !== 'schedule') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'not_scheduled' })
    };
  }

  const pending = await adminListVoiceSessionsPendingPostCall(40);
  const results: Array<{ callId: string; companyId: string; result: Awaited<ReturnType<typeof runVoicePostCallPipeline>> }> =
    [];

  for (const row of pending) {
    const result = await runVoicePostCallPipeline({ companyId: row.companyId, callId: row.id });
    results.push({ callId: row.id, companyId: row.companyId, result });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, count: results.length, results })
  };
};
