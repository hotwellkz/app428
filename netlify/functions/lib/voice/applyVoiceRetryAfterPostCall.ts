/**
 * После успешного post-call pipeline: вычислить retry/callback, записать в сессию и linked run.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { CrmAiBotExtractionResult } from '../../../../src/types/crmAiBotExtraction';
import type { VoiceRetryReason } from '../../../../src/types/voice';
import { getDb } from '../firebaseAdmin';
import { adminUpdateVoiceCallSession } from './voiceFirestoreAdmin';
import { deriveVoiceRetryEligibility } from './deriveVoiceRetryEligibility';
import { deriveVoiceRetryPolicy } from './deriveVoiceRetrySchedule';
import { extractVoiceCallbackSignals } from './extractVoiceCallbackSignals';
import { mergeVoiceRetryStateIntoLinkedRun } from './updateVoiceRunResult';
import { emitVoiceOperationalAlertIfNew } from './voiceRetryAlerts';

const WHATSAPP_AI_BOT_RUNS = 'whatsappAiBotRuns';

function readMeta(session: Record<string, unknown>): Record<string, unknown> {
  const m = session.metadata;
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
}

export async function applyVoiceRetryAfterPostCall(params: {
  companyId: string;
  callId: string;
  linkedRunId: string;
  session: Record<string, unknown> & { id?: string };
  extraction: CrmAiBotExtractionResult | null;
  summaryText: string | null;
}): Promise<void> {
  const { companyId, callId, linkedRunId, session, extraction, summaryText } = params;
  if (!linkedRunId.trim()) return;

  const db = getDb();
  const runSnap = await db.collection(WHATSAPP_AI_BOT_RUNS).doc(linkedRunId).get();
  if (!runSnap.exists) {
    return;
  }
  const runRow = runSnap.data() ?? {};
  const prevExtras = (runRow.extras as Record<string, unknown>) ?? {};
  const prevVr = (prevExtras.voiceRetry as Record<string, unknown>) ?? {};
  const autoDispatchCount = Number(prevVr.autoDispatchCount ?? 0);

  const signals = extractVoiceCallbackSignals(extraction, summaryText);
  const outcome = session.outcome != null ? String(session.outcome) : null;

  const eligibility = deriveVoiceRetryEligibility({
    callStatus: String(session.status ?? ''),
    outcome,
    endReason: session.endReason != null ? String(session.endReason) : null,
    callbackRequested: signals.callbackRequested
  });

  const meta = readMeta(session);
  const lineage = (meta.voiceLineage && typeof meta.voiceLineage === 'object' ? meta.voiceLineage : {}) as Record<
    string,
    unknown
  >;
  const rootCallId = String(lineage.rootCallId ?? callId);
  const parentCallId = lineage.parentCallId != null ? String(lineage.parentCallId) : null;

  const prevVoiceRetryMeta = (meta.voiceRetry && typeof meta.voiceRetry === 'object' ? meta.voiceRetry : {}) as Record<
    string,
    unknown
  >;

  if (!eligibility.eligible || !eligibility.reason) {
    const voiceRetryFlat = {
      retryEligible: false,
      retryStatus: 'completed',
      retryReason: null,
      nextRetryAt: null,
      autoDispatchCount,
      maxAutoDispatches: prevVr.maxAutoDispatches ?? null,
      callbackRequested: false,
      callbackAt: null,
      rootCallId,
      parentCallId,
      latestSessionId: callId
    };
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'completed',
      voiceRetryNextAt: null,
      metadata: {
        ...meta,
        voiceRetry: {
          ...prevVoiceRetryMeta,
          ...voiceRetryFlat
        }
      },
      updatedAt: FieldValue.serverTimestamp()
    });
    await mergeVoiceRetryStateIntoLinkedRun({
      companyId,
      linkedRunId,
      voiceRetry: {
        ...voiceRetryFlat,
        retryReason: null
      }
    });
    return;
  }

  const reason = eligibility.reason as VoiceRetryReason;
  const policy = deriveVoiceRetryPolicy(reason, autoDispatchCount);

  if (autoDispatchCount >= policy.maxAutoDispatches) {
    const exhausted = {
      retryEligible: false,
      retryStatus: 'exhausted',
      retryReason: reason,
      nextRetryAt: null,
      autoDispatchCount,
      maxAutoDispatches: policy.maxAutoDispatches,
      callbackRequested: signals.callbackRequested,
      callbackAt: signals.callbackAtMs ? new Date(signals.callbackAtMs).toISOString() : null,
      rootCallId,
      parentCallId,
      latestSessionId: callId
    };
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceRetryStatus: 'exhausted',
      voiceRetryNextAt: null,
      voiceRetryMaxAutoDispatches: policy.maxAutoDispatches,
      voiceRetryCallbackAt: signals.callbackAtMs ? Timestamp.fromMillis(signals.callbackAtMs) : null,
      metadata: {
        ...meta,
        voiceRetry: {
          ...prevVoiceRetryMeta,
          ...exhausted
        }
      },
      updatedAt: FieldValue.serverTimestamp()
    });
    await mergeVoiceRetryStateIntoLinkedRun({ companyId, linkedRunId, voiceRetry: exhausted });
    await emitVoiceOperationalAlertIfNew({
      companyId,
      linkedRunId,
      kind: 'retry_exhausted',
      title: 'Voice: исчерпаны авто-повторы',
      message: `run ${linkedRunId.slice(0, 10)}… · причина ${reason} · попыток ${autoDispatchCount}/${policy.maxAutoDispatches} · тел. ${String(session.toE164 ?? '')}`,
      dedupKey: `voice:retry_exhausted:${linkedRunId}`
    });
    return;
  }

  let nextMs: number;
  if (reason === 'callback_requested' && signals.callbackAtMs != null) {
    nextMs = Math.max(Date.now() + 60_000, signals.callbackAtMs);
  } else {
    nextMs = Date.now() + policy.backoffMinutes * 60_000;
  }

  const scheduled = {
    retryEligible: true,
    retryStatus: 'scheduled',
    retryReason: reason,
    nextRetryAt: new Date(nextMs).toISOString(),
    autoDispatchCount,
    maxAutoDispatches: policy.maxAutoDispatches,
    callbackRequested: signals.callbackRequested,
    callbackAt: signals.callbackAtMs ? new Date(signals.callbackAtMs).toISOString() : null,
    callbackNote: signals.callbackNote,
    rootCallId,
    parentCallId,
    latestSessionId: callId
  };

  await adminUpdateVoiceCallSession(companyId, callId, {
    voiceRetryStatus: 'scheduled',
    voiceRetryNextAt: Timestamp.fromMillis(nextMs),
    voiceRetryMaxAutoDispatches: policy.maxAutoDispatches,
    voiceRetryCallbackAt: signals.callbackAtMs ? Timestamp.fromMillis(signals.callbackAtMs) : null,
    metadata: {
      ...meta,
      voiceRetry: {
        ...prevVoiceRetryMeta,
        ...scheduled
      }
    },
    updatedAt: FieldValue.serverTimestamp()
  });

  await mergeVoiceRetryStateIntoLinkedRun({ companyId, linkedRunId, voiceRetry: scheduled });
}
