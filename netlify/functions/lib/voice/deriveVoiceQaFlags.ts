import type { CrmAiBotExtractionResult } from '../../../../src/types/crmAiBotExtraction';
import type { VoiceRetryReason } from '../../../../src/types/voice';

export type VoiceQaFlag =
  | 'no_meaningful_client_response'
  | 'too_short_conversation'
  | 'unknown_outcome'
  | 'missing_next_step'
  | 'callback_without_time'
  | 'post_call_failed'
  | 'crm_apply_failed'
  | 'follow_up_failed'
  | 'repeated_retry_case'
  | 'weak_summary'
  | 'weak_extraction'
  | 'empty_turns_or_low_signal'
  | 'manager_review_required';

export function deriveVoiceQaFlags(input: {
  callStatus: string;
  postCallStatus: string | null;
  outcome: string | null;
  summary: string | null;
  extraction: CrmAiBotExtractionResult | null;
  extractionError: string | null;
  crmApplyStatus: string | null;
  followUpStatus: string | null;
  userTurnCount: number;
  retryReason: VoiceRetryReason | string | null;
  retryCount: number;
  callbackRequested: boolean;
  callbackAt: string | null;
}): VoiceQaFlag[] {
  const flags: VoiceQaFlag[] = [];
  const summary = (input.summary || '').trim();
  const nextStep = (input.extraction?.nextStep || '').trim();

  if (input.postCallStatus === 'failed') flags.push('post_call_failed');
  if (input.crmApplyStatus === 'error') flags.push('crm_apply_failed');
  if (input.followUpStatus === 'error') flags.push('follow_up_failed');
  if (input.callStatus === 'completed' && (!input.outcome || input.outcome === 'unknown')) flags.push('unknown_outcome');
  if (input.userTurnCount <= 0) flags.push('empty_turns_or_low_signal');
  if (input.userTurnCount <= 1) flags.push('too_short_conversation');
  if (input.userTurnCount <= 1 || input.callStatus !== 'completed') flags.push('no_meaningful_client_response');
  if (!nextStep) flags.push('missing_next_step');
  if (!summary || summary.length < 24) flags.push('weak_summary');
  if (input.extractionError || !input.extraction) flags.push('weak_extraction');
  if (input.callbackRequested && !input.callbackAt) flags.push('callback_without_time');
  if (input.retryCount >= 2 || input.retryReason === 'outcome_unknown') flags.push('repeated_retry_case');

  if (
    flags.includes('post_call_failed') ||
    flags.includes('crm_apply_failed') ||
    flags.includes('unknown_outcome') ||
    flags.includes('missing_next_step') ||
    flags.includes('repeated_retry_case')
  ) {
    flags.push('manager_review_required');
  }
  return Array.from(new Set(flags));
}
