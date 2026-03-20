import type { CrmAiBotExtractionResult } from '../../../../src/types/crmAiBotExtraction';
import type { VoiceQaSnapshot } from '../../../../src/types/voice';
import { deriveVoiceQaFlags } from './deriveVoiceQaFlags';
import { deriveVoiceQaScore } from './deriveVoiceQaScore';

function safeSummary(flags: string[], score: number, band: string): string {
  const top = flags.slice(0, 3).join(', ');
  if (!top) return `Качество: ${band}, score ${score}/100.`;
  return `Качество: ${band}, score ${score}/100. Ключевые сигналы: ${top}.`;
}

export function buildVoiceQaSnapshot(input: {
  callStatus: string;
  postCallStatus: string | null;
  outcome: string | null;
  summary: string | null;
  extraction: CrmAiBotExtractionResult | null;
  extractionError: string | null;
  crmApplyStatus: string | null;
  followUpStatus: string | null;
  linkedDealId: string | null;
  linkedTaskId: string | null;
  userTurnCount: number;
  retryReason: string | null;
  retryCount: number;
  callbackRequested: boolean;
  callbackAt: string | null;
}): VoiceQaSnapshot {
  const flags = deriveVoiceQaFlags({
    callStatus: input.callStatus,
    postCallStatus: input.postCallStatus,
    outcome: input.outcome,
    summary: input.summary,
    extraction: input.extraction,
    extractionError: input.extractionError,
    crmApplyStatus: input.crmApplyStatus,
    followUpStatus: input.followUpStatus,
    userTurnCount: input.userTurnCount,
    retryReason: input.retryReason,
    retryCount: input.retryCount,
    callbackRequested: input.callbackRequested,
    callbackAt: input.callbackAt
  });

  const nextStepCaptured = Boolean((input.extraction?.nextStep || '').trim());
  const clientIntentClear = !!input.outcome && input.outcome !== 'unknown';
  const scored = deriveVoiceQaScore({
    flags,
    outcome: input.outcome,
    hasLinkedDeal: !!input.linkedDealId,
    hasLinkedTask: !!input.linkedTaskId,
    nextStepCaptured
  });

  const failureReasons = flags.filter((x) =>
    ['post_call_failed', 'unknown_outcome', 'missing_next_step', 'crm_apply_failed', 'repeated_retry_case'].includes(x)
  );
  const warnings = flags.filter((x) => !failureReasons.includes(x));
  return {
    status: 'done',
    score: scored.score,
    band: scored.band,
    needsReview: scored.needsReview,
    summary: safeSummary(flags, scored.score, scored.band),
    flags,
    warnings,
    failureReasons,
    nextStepCaptured,
    clientIntentClear,
    outcomeConfidence: scored.outcomeConfidence,
    reviewedAt: null,
    error: null
  };
}
