import type { VoiceRetryReason } from '../../../../src/types/voice';

export type VoiceRetryPolicySlice = {
  maxAutoDispatches: number;
  /** Смещение от now до следующего слота (минуты), если нет точного callbackAt */
  backoffMinutes: number;
};

/**
 * P0 policy: лимиты и backoff по причине и номеру уже выполненных авто-dispatch.
 */
export function deriveVoiceRetryPolicy(
  reason: VoiceRetryReason,
  completedAutoDispatches: number
): VoiceRetryPolicySlice {
  switch (reason) {
    case 'no_answer':
      return {
        maxAutoDispatches: 3,
        backoffMinutes: completedAutoDispatches <= 0 ? 30 : 240
      };
    case 'busy':
      return {
        maxAutoDispatches: 2,
        backoffMinutes: completedAutoDispatches <= 0 ? 15 : 120
      };
    case 'failed':
      return {
        maxAutoDispatches: 2,
        backoffMinutes: completedAutoDispatches <= 0 ? 10 : 60
      };
    case 'callback_requested':
      return {
        maxAutoDispatches: 1,
        backoffMinutes: 120
      };
    case 'outcome_unknown':
      return {
        maxAutoDispatches: 2,
        backoffMinutes: completedAutoDispatches <= 0 ? 60 : 360
      };
    case 'manual':
      return { maxAutoDispatches: 0, backoffMinutes: 0 };
    default:
      return { maxAutoDispatches: 0, backoffMinutes: 60 };
  }
}
