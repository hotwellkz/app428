/**
 * Централизованные правила: нужен ли авто-retry / callback по итогам звонка.
 * Не дублировать в UI — клиент может зеркалить для фильтров из extras.voiceRetry.
 */
import type { VoiceRetryReason } from '../../../../src/types/voice';

export type VoiceRetryEligibility = {
  eligible: boolean;
  reason: VoiceRetryReason | null;
};

export function deriveVoiceRetryEligibility(input: {
  callStatus: string;
  outcome: string | null | undefined;
  endReason?: string | null;
  /** Явный сигнал из extraction / эвристик */
  callbackRequested?: boolean;
}): VoiceRetryEligibility {
  const status = String(input.callStatus ?? '').trim();
  const outcome = input.outcome != null ? String(input.outcome).trim() : '';

  if (outcome === 'no_interest' || outcome === 'meeting_booked') {
    return { eligible: false, reason: null };
  }

  if (outcome === 'callback' || input.callbackRequested) {
    return { eligible: true, reason: 'callback_requested' };
  }

  if (status === 'no_answer') return { eligible: true, reason: 'no_answer' };
  if (status === 'busy') return { eligible: true, reason: 'busy' };

  if (status === 'failed') {
    const er = (input.endReason || '').toLowerCase();
    if (
      er.includes('twilio_config') ||
      er.includes('voice_provider') ||
      er.includes('auth') ||
      er.includes('permission') ||
      er.includes('invalid') && er.includes('credential')
    ) {
      return { eligible: false, reason: null };
    }
    return { eligible: true, reason: 'failed' };
  }

  if (status === 'completed' && (!outcome || outcome === 'unknown')) {
    return { eligible: true, reason: 'outcome_unknown' };
  }

  return { eligible: false, reason: null };
}
