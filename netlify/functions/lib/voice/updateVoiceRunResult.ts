/**
 * Минимальная запись результатов voice post-call в документ whatsappAiBotRuns (linkedRunId).
 * Merge, без обязательных полей WhatsApp-чата — channel/voiceCallSessionId/extras.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';
import type { VoicePostCallResultMetadata } from '../../../../src/types/voice';

const WHATSAPP_AI_BOT_RUNS = 'whatsappAiBotRuns';

/** Денормализация для AI-control (фильтры/список без N+1 к voiceCallSessions). */
export type VoiceCallSnapshotForRunMerge = {
  callStatus: string;
  outcome: string | null;
  postCallStatus: string | null;
  providerCallId: string | null;
  provider: string | null;
  fromE164: string | null;
  toE164: string | null;
  followUpStatus: string | null;
  followUpError: string | null;
  twilioFinalStatus?: string | null;
  twilioSipResponseCode?: number | null;
  twilioErrorCode?: number | null;
  twilioErrorMessage?: string | null;
  twilioWarningCode?: number | null;
  twilioWarningMessage?: string | null;
  twilioProviderReason?: string | null;
  voiceFailureReasonCode?: string | null;
  voiceFailureReasonMessage?: string | null;
  providerFailureCode?: string | null;
  providerFailureReason?: string | null;
  durationSec?: number | null;
  hadInProgress?: boolean | null;
  callbackTimeline?: Array<Record<string, unknown>> | null;
  lifecycle?: Record<string, unknown> | null;
};

export async function mergeVoicePostCallIntoLinkedRun(params: {
  companyId: string;
  linkedRunId: string;
  callId: string;
  botId: string;
  conversationIdSynthetic: string;
  summary: string | null;
  extractionJson: string | null;
  extractionApplySnapshotJson: string | null;
  dealRecommendationSnapshotJson: string | null;
  taskRecommendationSnapshotJson: string | null;
  postCall: VoicePostCallResultMetadata;
  extractionApplied: boolean;
  extractionApplyStatus: string | null;
  crmClientId: string | null;
  phoneE164: string | null;
  linkedDealId: string | null;
  linkedTaskId: string | null;
  voiceCallSnapshot?: VoiceCallSnapshotForRunMerge | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { companyId, linkedRunId } = params;
  if (!linkedRunId.trim()) {
    return { ok: false, error: 'missing_linked_run' };
  }
  const db = getDb();
  const ref = db.collection(WHATSAPP_AI_BOT_RUNS).doc(linkedRunId);
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: false, error: 'run_not_found' };
    }
    const row = snap.data() ?? {};
    if (String(row.companyId ?? '') !== companyId) {
      return { ok: false, error: 'run_company_mismatch' };
    }

    await ref.set(
      {
        channel: row.channel ?? 'voice',
        conversationId: typeof row.conversationId === 'string' && row.conversationId.trim() ? row.conversationId : params.conversationIdSynthetic,
        botId: params.botId,
        finishedAt: FieldValue.serverTimestamp(),
        extractedSummary: params.summary,
        summarySnapshot: params.summary,
        extractedSnapshotJson: params.extractionJson,
        extractionApplySnapshotJson: params.extractionApplySnapshotJson,
        dealRecommendationSnapshotJson: params.dealRecommendationSnapshotJson,
        taskRecommendationSnapshotJson: params.taskRecommendationSnapshotJson,
        extractionApplied: params.extractionApplied,
        extractionApplyStatus: params.extractionApplyStatus,
        clientIdSnapshot: params.crmClientId,
        phoneSnapshot: params.phoneE164,
        createdDealId: params.linkedDealId ?? (row.createdDealId as string | null) ?? null,
        taskId: params.linkedTaskId ?? (row.taskId as string | null) ?? null,
        dealId: params.linkedDealId ?? (row.dealId as string | null) ?? null,
        extras: {
          ...((row.extras as Record<string, unknown>) ?? {}),
          voiceCallSessionId: params.callId,
          voicePostCall: params.postCall,
          voiceConversationId: params.conversationIdSynthetic,
          ...(params.voiceCallSnapshot ? { voiceCallSnapshot: params.voiceCallSnapshot } : {})
        },
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true };
  } catch (e) {
    console.error('[mergeVoicePostCallIntoLinkedRun]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'merge_failed' };
  }
}

/** Merge retry/callback state в linked run (extras.voiceRetry), без затрагивания post-call полей. */
export async function mergeVoiceRetryStateIntoLinkedRun(params: {
  companyId: string;
  linkedRunId: string;
  voiceRetry: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { companyId, linkedRunId, voiceRetry } = params;
  if (!linkedRunId.trim()) return { ok: false, error: 'missing_linked_run' };
  const db = getDb();
  const ref = db.collection(WHATSAPP_AI_BOT_RUNS).doc(linkedRunId);
  try {
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'run_not_found' };
    const row = snap.data() ?? {};
    if (String(row.companyId ?? '') !== companyId) {
      return { ok: false, error: 'run_company_mismatch' };
    }
    const prevExtras = (row.extras as Record<string, unknown>) ?? {};
    const prevVr = (prevExtras.voiceRetry as Record<string, unknown>) ?? {};
    await ref.set(
      {
        channel: row.channel ?? 'voice',
        extras: {
          ...prevExtras,
          voiceRetry: { ...prevVr, ...voiceRetry }
        },
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true };
  } catch (e) {
    console.error('[mergeVoiceRetryStateIntoLinkedRun]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'merge_failed' };
  }
}

/** Merge voice QA snapshot в linked run (extras.voiceQa) */
export async function mergeVoiceQaStateIntoLinkedRun(params: {
  companyId: string;
  linkedRunId: string;
  voiceQa: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { companyId, linkedRunId, voiceQa } = params;
  if (!linkedRunId.trim()) return { ok: false, error: 'missing_linked_run' };
  const db = getDb();
  const ref = db.collection(WHATSAPP_AI_BOT_RUNS).doc(linkedRunId);
  try {
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'run_not_found' };
    const row = snap.data() ?? {};
    if (String(row.companyId ?? '') !== companyId) {
      return { ok: false, error: 'run_company_mismatch' };
    }
    const prevExtras = (row.extras as Record<string, unknown>) ?? {};
    const prevQa = (prevExtras.voiceQa as Record<string, unknown>) ?? {};
    await ref.set(
      {
        channel: row.channel ?? 'voice',
        extras: {
          ...prevExtras,
          voiceQa: { ...prevQa, ...voiceQa }
        },
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true };
  } catch (e) {
    console.error('[mergeVoiceQaStateIntoLinkedRun]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'merge_failed' };
  }
}

/** Быстрое обновление lifecycle-диагностики в linked run по webhook-событию. */
export async function mergeVoiceLifecycleIntoLinkedRun(params: {
  companyId: string;
  linkedRunId: string;
  voiceCallSnapshot: VoiceCallSnapshotForRunMerge;
}): Promise<{ ok: boolean; error?: string }> {
  const { companyId, linkedRunId, voiceCallSnapshot } = params;
  if (!linkedRunId.trim()) return { ok: false, error: 'missing_linked_run' };
  const db = getDb();
  const ref = db.collection(WHATSAPP_AI_BOT_RUNS).doc(linkedRunId);
  try {
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'run_not_found' };
    const row = snap.data() ?? {};
    if (String(row.companyId ?? '') !== companyId) {
      return { ok: false, error: 'run_company_mismatch' };
    }
    const prevExtras = (row.extras as Record<string, unknown>) ?? {};
    const prev = (prevExtras.voiceCallSnapshot as Record<string, unknown>) ?? {};
    await ref.set(
      {
        channel: row.channel ?? 'voice',
        extras: {
          ...prevExtras,
          voiceCallSnapshot: { ...prev, ...voiceCallSnapshot }
        },
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return { ok: true };
  } catch (e) {
    console.error('[mergeVoiceLifecycleIntoLinkedRun]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'merge_failed' };
  }
}
