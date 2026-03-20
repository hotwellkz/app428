/**
 * Минимальная запись результатов voice post-call в документ whatsappAiBotRuns (linkedRunId).
 * Merge, без обязательных полей WhatsApp-чата — channel/voiceCallSessionId/extras.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';
import type { VoicePostCallResultMetadata } from '../../../../src/types/voice';

const WHATSAPP_AI_BOT_RUNS = 'whatsappAiBotRuns';

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
          voiceConversationId: params.conversationIdSynthetic
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
