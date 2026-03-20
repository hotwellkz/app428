import type { VoiceQaBand, VoiceQaOutcomeConfidence } from '../../../../src/types/voice';
import type { VoiceQaFlag } from './deriveVoiceQaFlags';

export function deriveVoiceQaScore(input: {
  flags: VoiceQaFlag[];
  outcome: string | null;
  hasLinkedDeal: boolean;
  hasLinkedTask: boolean;
  nextStepCaptured: boolean;
}): { score: number; band: VoiceQaBand; outcomeConfidence: VoiceQaOutcomeConfidence; needsReview: boolean } {
  let score = 100;
  const f = new Set(input.flags);

  if (f.has('post_call_failed')) score -= 45;
  if (f.has('crm_apply_failed')) score -= 18;
  if (f.has('follow_up_failed')) score -= 10;
  if (f.has('unknown_outcome')) score -= 20;
  if (f.has('missing_next_step')) score -= 14;
  if (f.has('too_short_conversation')) score -= 10;
  if (f.has('no_meaningful_client_response')) score -= 12;
  if (f.has('weak_summary')) score -= 8;
  if (f.has('weak_extraction')) score -= 8;
  if (f.has('callback_without_time')) score -= 6;
  if (f.has('repeated_retry_case')) score -= 12;

  if (input.outcome === 'meeting_booked') score += 8;
  if (input.hasLinkedDeal) score += 6;
  if (input.hasLinkedTask) score += 4;
  if (input.nextStepCaptured) score += 4;

  score = Math.max(0, Math.min(100, score));
  const band: VoiceQaBand = score >= 75 ? 'good' : score >= 45 ? 'warning' : 'bad';
  const outcomeConfidence: VoiceQaOutcomeConfidence =
    f.has('unknown_outcome') || f.has('empty_turns_or_low_signal') ? 'low' : f.has('weak_summary') ? 'medium' : 'high';
  const needsReview = band !== 'good' || f.has('manager_review_required');
  return { score, band, outcomeConfidence, needsReview };
}
