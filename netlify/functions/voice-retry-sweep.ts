/**
 * Scheduled sweep: voiceCallSessions с voiceRetryStatus=scheduled и nextRetryAt <= now → dispatchVoiceRetry.
 */
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  adminGetVoiceCallSession,
  adminListVoiceSessionsDueRetry,
  adminUpdateVoiceCallSession
} from './lib/voice/voiceFirestoreAdmin';
import { dispatchVoiceRetryForSession } from './lib/voice/dispatchVoiceRetry';
import { emitVoiceOperationalAlertIfNew } from './lib/voice/voiceRetryAlerts';

function callbackAtMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && v && 'toMillis' in (v as { toMillis?: unknown })) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  return null;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.headers['x-netlify-scheduled'] !== 'true' && event.trigger !== 'schedule') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'not_scheduled' })
    };
  }

  const due = await adminListVoiceSessionsDueRetry(35);
  const results: Array<{ callId: string; companyId: string; result: Awaited<ReturnType<typeof dispatchVoiceRetryForSession>> }> =
    [];

  const now = Date.now();
  for (const row of due) {
    const full = await adminGetVoiceCallSession(row.companyId, row.id);
    if (full) {
      const cb = callbackAtMs(full.voiceRetryCallbackAt);
      const overdue = cb != null && cb < now - 2 * 3600_000;
      const alerted = Boolean(full.voiceRetryCallbackOverdueAlertSent);
      if (overdue && !alerted) {
        const lr = String(full.linkedRunId ?? '').trim();
        if (lr) {
          await emitVoiceOperationalAlertIfNew({
            companyId: row.companyId,
            linkedRunId: lr,
            kind: 'callback_overdue',
            title: 'Voice: просрочен callback',
            message: `run ${lr.slice(0, 10)}… · сессия ${row.id.slice(0, 8)}… · ожидался перезвон`,
            dedupKey: `voice:callback_overdue:${row.id}`
          });
        }
        await adminUpdateVoiceCallSession(row.companyId, row.id, {
          voiceRetryCallbackOverdueAlertSent: true,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    }

    const result = await dispatchVoiceRetryForSession(row.companyId, row.id);
    results.push({ callId: row.id, companyId: row.companyId, result });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, count: results.length, results })
  };
};
