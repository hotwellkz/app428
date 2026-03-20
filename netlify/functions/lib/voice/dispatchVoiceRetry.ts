/**
 * Идемпотентный dispatch авто-retry: claim сессии → outbound → обновление linked run (тот же linkedRunId).
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';
import {
  adminAppendVoiceCallEvent,
  adminClaimVoiceRetryDispatch,
  adminUpdateVoiceCallSession
} from './voiceFirestoreAdmin';
import { orchestrateVoiceOutbound } from './voiceOutboundOrchestrator';
import { emitVoiceOperationalAlertIfNew } from './voiceRetryAlerts';

const WHATSAPP_AI_BOT_RUNS = 'whatsappAiBotRuns';

function readMeta(session: Record<string, unknown>): Record<string, unknown> {
  const m = session.metadata;
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
}

export async function dispatchVoiceRetryForSession(
  companyId: string,
  callId: string
): Promise<{ ok: boolean; code?: string; message?: string; newCallId?: string }> {
  const nowMs = Date.now();
  const claim = await adminClaimVoiceRetryDispatch(companyId, callId, nowMs);
  if (!claim.claimed || !claim.session) {
    return { ok: true, code: 'not_claimed' };
  }

  const session = claim.session;
  const linkedRunId = String(session.linkedRunId ?? '').trim();
  const botId = String(session.botId ?? '').trim();
  const toE164 = String(session.toE164 ?? '').trim();
  const fromNumberId = session.fromNumberId != null ? String(session.fromNumberId) : null;

  if (!linkedRunId || !botId || !toE164) {
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'exhausted',
      voiceRetryNextAt: null,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: false, code: 'missing_params', message: 'linkedRunId/botId/toE164' };
  }

  const meta = readMeta(session);
  const lineage = (meta.voiceLineage && typeof meta.voiceLineage === 'object' ? meta.voiceLineage : {}) as Record<
    string,
    unknown
  >;
  const rootCallId = String(lineage.rootCallId ?? callId);
  const maxAuto = Number(session.voiceRetryMaxAutoDispatches ?? 3);

  const db = getDb();
  const runRef = db.collection(WHATSAPP_AI_BOT_RUNS).doc(linkedRunId);
  const runSnap = await runRef.get();
  if (!runSnap.exists) {
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'exhausted',
      voiceRetryNextAt: null,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: false, code: 'run_not_found' };
  }
  const run = runSnap.data() ?? {};
  if (String(run.companyId) !== companyId) {
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'scheduled',
      voiceRetryNextAt: Timestamp.fromMillis(nowMs + 600_000),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: false, code: 'company_mismatch' };
  }

  const ex = (run.extras as Record<string, unknown>) ?? {};
  const vr = (ex.voiceRetry as Record<string, unknown>) ?? {};
  const autoDispatchCount = Number(vr.autoDispatchCount ?? 0);

  if (autoDispatchCount >= maxAuto) {
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'exhausted',
      voiceRetryNextAt: null,
      updatedAt: FieldValue.serverTimestamp()
    });
    const nextExtras = {
      ...ex,
      voiceRetry: {
        ...vr,
        retryEligible: false,
        retryStatus: 'exhausted',
        nextRetryAt: null,
        maxAutoDispatches: maxAuto,
        autoDispatchCount
      }
    };
    await runRef.set({ extras: nextExtras, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await emitVoiceOperationalAlertIfNew({
      companyId,
      linkedRunId,
      kind: 'retry_exhausted',
      title: 'Voice: лимит авто-повторов',
      message: `run ${linkedRunId.slice(0, 10)}… · ${autoDispatchCount}/${maxAuto} · ${toE164}`,
      dedupKey: `voice:retry_exhausted:${linkedRunId}`
    });
    return { ok: false, code: 'exhausted_cap' };
  }

  const out = await orchestrateVoiceOutbound(companyId, {
    botId,
    linkedRunId,
    toE164,
    contactId: session.contactId != null ? String(session.contactId) : null,
    clientId: session.clientId != null ? String(session.clientId) : null,
    crmClientId: session.crmClientId != null ? String(session.crmClientId) : null,
    fromNumberId,
    metadata: {
      ...meta,
      voiceLineage: {
        rootCallId,
        parentCallId: callId,
        attemptOrdinal: autoDispatchCount + 1
      },
      voiceRetry: {
        trigger: 'auto_sweep',
        previousSessionId: callId
      }
    }
  });

  if (!out.ok) {
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'scheduled',
      voiceRetryNextAt: Timestamp.fromMillis(nowMs + 10 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: false, code: out.code, message: out.message };
  }

  const newCallId = out.callId;
  await adminUpdateVoiceCallSession(companyId, callId, {
    voiceRetryStatus: 'dispatched',
    voiceRetryNextAt: null,
    voiceRetryLastDispatchedChildId: newCallId,
    updatedAt: FieldValue.serverTimestamp()
  });

  await adminAppendVoiceCallEvent(companyId, callId, {
    type: 'retry.dispatched',
    providerEventType: 'orchestrator.auto_retry',
    providerCallId: null,
    fromStatus: 'scheduled',
    toStatus: 'dispatched',
    at: FieldValue.serverTimestamp(),
    payload: { childCallId: newCallId },
    seq: null
  });

  const newCount = autoDispatchCount + 1;
  const nextExtras = {
    ...ex,
    voiceCallSessionId: newCallId,
    voiceRetry: {
      ...vr,
      autoDispatchCount: newCount,
      retryStatus: 'none',
      nextRetryAt: null,
      rootCallId,
      parentCallId: callId,
      latestSessionId: newCallId,
      lastAutoRetryAt: new Date().toISOString()
    }
  };
  await runRef.set({ extras: nextExtras, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return { ok: true, newCallId };
}
