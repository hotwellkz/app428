import { FieldValue } from 'firebase-admin/firestore';
import type { VoiceQaReviewDisposition, VoiceQaReviewStatus } from '../../../../src/types/voice';
import { adminGetVoiceCallSession, adminUpdateVoiceCallSession } from './voiceFirestoreAdmin';
import { mergeVoiceQaStateIntoLinkedRun } from './updateVoiceRunResult';

type ReviewPatch = {
  reviewStatus?: VoiceQaReviewStatus;
  reviewNote?: string | null;
  reviewDisposition?: VoiceQaReviewDisposition | null;
  needsPromptFix?: boolean;
  needsOpsFix?: boolean;
  needsRetryTuning?: boolean;
  needsHumanFollowup?: boolean;
};

function getMeta(session: Record<string, unknown>): Record<string, unknown> {
  const m = session.metadata;
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
}

export async function updateVoiceQaReview(params: {
  companyId: string;
  callId: string;
  reviewerUid: string;
  reviewerName: string;
  patch: ReviewPatch;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const session = await adminGetVoiceCallSession(params.companyId, params.callId);
  if (!session) return { ok: false, error: 'session_not_found' };
  const linkedRunId = String(session.linkedRunId ?? '').trim();
  if (!linkedRunId) return { ok: false, error: 'missing_linked_run_id' };

  const meta = getMeta(session);
  const qaRaw = (meta.voiceQa && typeof meta.voiceQa === 'object' ? meta.voiceQa : {}) as Record<string, unknown>;
  const reviewRaw = (qaRaw.review && typeof qaRaw.review === 'object' ? qaRaw.review : {}) as Record<string, unknown>;

  const nextStatus = params.patch.reviewStatus ?? (reviewRaw.status as VoiceQaReviewStatus) ?? 'none';
  const nextNote = params.patch.reviewNote ?? (reviewRaw.note != null ? String(reviewRaw.note) : null);
  const nextDisposition =
    params.patch.reviewDisposition ?? (reviewRaw.disposition != null ? String(reviewRaw.disposition) : null);
  const nextNeedsPromptFix =
    params.patch.needsPromptFix ?? (typeof reviewRaw.needsPromptFix === 'boolean' ? reviewRaw.needsPromptFix : false);
  const nextNeedsOpsFix =
    params.patch.needsOpsFix ?? (typeof reviewRaw.needsOpsFix === 'boolean' ? reviewRaw.needsOpsFix : false);
  const nextNeedsRetryTuning =
    params.patch.needsRetryTuning ??
    (typeof reviewRaw.needsRetryTuning === 'boolean' ? reviewRaw.needsRetryTuning : false);
  const nextNeedsHumanFollowup =
    params.patch.needsHumanFollowup ??
    (typeof reviewRaw.needsHumanFollowup === 'boolean' ? reviewRaw.needsHumanFollowup : false);

  const prevSignature = JSON.stringify({
    s: reviewRaw.status ?? 'none',
    n: reviewRaw.note ?? null,
    d: reviewRaw.disposition ?? null,
    p: reviewRaw.needsPromptFix ?? false,
    o: reviewRaw.needsOpsFix ?? false,
    r: reviewRaw.needsRetryTuning ?? false,
    h: reviewRaw.needsHumanFollowup ?? false
  });
  const nextSignature = JSON.stringify({
    s: nextStatus,
    n: nextNote,
    d: nextDisposition,
    p: nextNeedsPromptFix,
    o: nextNeedsOpsFix,
    r: nextNeedsRetryTuning,
    h: nextNeedsHumanFollowup
  });
  if (prevSignature === nextSignature) return { ok: true, skipped: true };

  const reviewedAt = new Date();
  const nextReview = {
    status: nextStatus,
    by: params.reviewerName || params.reviewerUid,
    byUid: params.reviewerUid,
    at: reviewedAt.toISOString(),
    note: nextNote,
    disposition: nextDisposition,
    needsPromptFix: nextNeedsPromptFix,
    needsOpsFix: nextNeedsOpsFix,
    needsRetryTuning: nextNeedsRetryTuning,
    needsHumanFollowup: nextNeedsHumanFollowup
  };

  await adminUpdateVoiceCallSession(params.companyId, params.callId, {
    voiceQaReviewStatus: nextStatus,
    voiceQaReviewedBy: nextReview.by,
    voiceQaReviewedAt: reviewedAt,
    voiceQaReviewDisposition: nextDisposition,
    voiceQaNeedsPromptFix: nextNeedsPromptFix,
    voiceQaNeedsOpsFix: nextNeedsOpsFix,
    voiceQaNeedsRetryTuning: nextNeedsRetryTuning,
    voiceQaNeedsHumanFollowup: nextNeedsHumanFollowup,
    metadata: {
      ...meta,
      voiceQa: {
        ...qaRaw,
        review: nextReview
      }
    },
    updatedAt: FieldValue.serverTimestamp()
  });

  await mergeVoiceQaStateIntoLinkedRun({
    companyId: params.companyId,
    linkedRunId,
    voiceQa: {
      reviewStatus: nextStatus,
      reviewedBy: nextReview.by,
      reviewedAt: nextReview.at,
      reviewDisposition: nextDisposition,
      reviewNote: nextNote ? String(nextNote).slice(0, 300) : null,
      needsPromptFix: nextNeedsPromptFix,
      needsOpsFix: nextNeedsOpsFix,
      needsRetryTuning: nextNeedsRetryTuning,
      needsHumanFollowup: nextNeedsHumanFollowup
    }
  });

  return { ok: true };
}
