import { FieldValue } from 'firebase-admin/firestore';
import type { CrmAiBotExtractionResult } from '../../../../src/types/crmAiBotExtraction';
import type { VoiceQaResultMetadata } from '../../../../src/types/voice';
import { mergeVoiceQaStateIntoLinkedRun } from './updateVoiceRunResult';
import { buildVoiceQaSnapshot } from './buildVoiceQaSnapshot';
import { emitVoiceOperationalAlertIfNew } from './voiceRetryAlerts';
import { adminGetVoiceCallSession, adminUpdateVoiceCallSession } from './voiceFirestoreAdmin';

function metaOf(session: Record<string, unknown>): Record<string, unknown> {
  const m = session.metadata;
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
}

function deriveInitialReviewStatus(
  prevRaw: Record<string, unknown>,
  qaNeedsReview: boolean,
  qaBand: string | null,
  qaStatus: string
): string {
  const prev = String(prevRaw.status ?? 'none');
  if (['reviewed', 'false_positive', 'accepted_issue', 'ignored'].includes(prev)) return prev;
  const shouldPending = qaNeedsReview || qaBand === 'bad' || qaStatus === 'failed';
  return shouldPending ? 'pending_review' : prev || 'none';
}

export async function runVoiceQaPipeline(params: {
  companyId: string;
  callId: string;
  linkedRunId: string;
  extraction: CrmAiBotExtractionResult | null;
  userTurnCount: number;
  force?: boolean;
}): Promise<{ ok: boolean; skippedReason?: string; error?: string }> {
  const { companyId, callId, linkedRunId, extraction, userTurnCount, force } = params;
  const session = await adminGetVoiceCallSession(companyId, callId);
  if (!session) return { ok: false, error: 'session_not_found' };

  const meta = metaOf(session);
  const qaPrev = (meta.voiceQa && typeof meta.voiceQa === 'object' ? meta.voiceQa : {}) as Record<string, unknown>;
  const prevStatus = String(qaPrev.status ?? session.voiceQaStatus ?? '');
  if (prevStatus === 'done' && !force) {
    return { ok: true, skippedReason: 'already_done' };
  }

  await adminUpdateVoiceCallSession(companyId, callId, {
    voiceQaStatus: 'processing',
    metadata: {
      ...meta,
      voiceQa: {
        ...qaPrev,
        status: 'processing',
        analyzedAt: new Date().toISOString(),
        error: null
      }
    },
    updatedAt: FieldValue.serverTimestamp()
  });

  try {
    const updated = await adminGetVoiceCallSession(companyId, callId);
    if (!updated) return { ok: false, error: 'session_disappeared' };
    const updMeta = metaOf(updated);
    const vr = (updMeta.voiceRetry && typeof updMeta.voiceRetry === 'object' ? updMeta.voiceRetry : {}) as Record<
      string,
      unknown
    >;
    const qa = buildVoiceQaSnapshot({
      callStatus: String(updated.status ?? ''),
      postCallStatus: updated.postCallStatus != null ? String(updated.postCallStatus) : null,
      outcome: updated.outcome != null ? String(updated.outcome) : null,
      summary: updated.postCallSummary != null ? String(updated.postCallSummary) : null,
      extraction,
      extractionError: updated.extractionError != null ? String(updated.extractionError) : null,
      crmApplyStatus: updated.crmApplyStatus != null ? String(updated.crmApplyStatus) : null,
      followUpStatus: updated.followUpStatus != null ? String(updated.followUpStatus) : null,
      linkedDealId: updated.linkedDealId != null ? String(updated.linkedDealId) : null,
      linkedTaskId: updated.linkedTaskId != null ? String(updated.linkedTaskId) : null,
      userTurnCount,
      retryReason: vr.retryReason != null ? String(vr.retryReason) : null,
      retryCount: Number(vr.autoDispatchCount ?? 0),
      callbackRequested: vr.callbackRequested === true,
      callbackAt: vr.callbackAt != null ? String(vr.callbackAt) : null
    });

    const qaMeta: VoiceQaResultMetadata = {
      ...qa,
      pipelineVersion: 'voice_qa_v1',
      analyzedAt: new Date()
    };
    const qaReviewRaw = (updMeta.voiceQa &&
      typeof (updMeta.voiceQa as Record<string, unknown>).review === 'object'
      ? (updMeta.voiceQa as Record<string, unknown>).review
      : {}) as Record<string, unknown>;
    const reviewStatus = deriveInitialReviewStatus(qaReviewRaw, qa.needsReview, qa.band, qa.status);
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceQaStatus: qa.status,
      voiceQaScore: qa.score,
      voiceQaBand: qa.band,
      voiceQaNeedsReview: qa.needsReview,
      voiceQaSummary: qa.summary,
      voiceQaOutcomeConfidence: qa.outcomeConfidence,
      voiceQaReviewStatus: reviewStatus as
        | 'none'
        | 'pending_review'
        | 'reviewed'
        | 'false_positive'
        | 'accepted_issue'
        | 'ignored',
      metadata: {
        ...updMeta,
        voiceQa: {
          ...qaMeta,
          review: {
            ...(qaReviewRaw ?? {}),
            status: reviewStatus
          }
        }
      },
      updatedAt: FieldValue.serverTimestamp()
    });
    await mergeVoiceQaStateIntoLinkedRun({
      companyId,
      linkedRunId,
      voiceQa: {
        ...qa,
        reviewStatus
      }
    });

    if (qa.score != null && (qa.score <= 35 || qa.needsReview)) {
      await emitVoiceOperationalAlertIfNew({
        companyId,
        linkedRunId,
        kind: 'voice_qa_review',
        title: 'Voice QA: требуется ручной разбор',
        message: `run ${linkedRunId.slice(0, 10)}… · score ${qa.score}/100 · band ${qa.band} · flags: ${qa.flags.slice(0, 4).join(', ')}`,
        dedupKey: `voice:qa_review:${linkedRunId}`
      });
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const latest = await adminGetVoiceCallSession(companyId, callId);
    const latestMeta = latest ? metaOf(latest) : meta;
    const latestQa = (latestMeta.voiceQa && typeof latestMeta.voiceQa === 'object'
      ? latestMeta.voiceQa
      : {}) as Record<string, unknown>;
    await adminUpdateVoiceCallSession(companyId, callId, {
      voiceQaStatus: 'failed',
      metadata: {
        ...latestMeta,
        voiceQa: {
          ...latestQa,
          status: 'failed',
          error: msg,
          analyzedAt: new Date().toISOString()
        }
      }
    });
    await mergeVoiceQaStateIntoLinkedRun({
      companyId,
      linkedRunId,
      voiceQa: {
        status: 'failed',
        score: null,
        band: null,
        needsReview: true,
        summary: 'QA pipeline failed',
        flags: ['manager_review_required'],
        warnings: [],
        failureReasons: ['qa_pipeline_failed'],
        nextStepCaptured: false,
        clientIntentClear: false,
        outcomeConfidence: 'low',
        reviewStatus: 'pending_review',
        error: msg
      }
    });
    return { ok: false, error: msg };
  }
}
