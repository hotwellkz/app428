/**
 * Twilio REST: statusCallbackEvent для Programmable Voice — только допустимые значения.
 * @see Twilio Calls API — невалидные значения дают 21626.
 */

export const TWILIO_VOICE_STATUS_CALLBACK_EVENTS = [
  'initiated',
  'ringing',
  'answered',
  'completed'
] as const;

export type TwilioVoiceStatusCallbackEvent = (typeof TWILIO_VOICE_STATUS_CALLBACK_EVENTS)[number];

const ALLOWED = new Set<string>(TWILIO_VOICE_STATUS_CALLBACK_EVENTS);

/** Нормализация: только валидные события, порядок фиксированный. */
export function normalizeTwilioVoiceStatusCallbackEvents(
  input?: ReadonlyArray<string> | string | null
): TwilioVoiceStatusCallbackEvent[] {
  if (input == null) return [...TWILIO_VOICE_STATUS_CALLBACK_EVENTS];
  const arr = Array.isArray(input) ? input : [input];
  const picked = new Set<string>();
  for (const x of arr) {
    const v = String(x ?? '').trim().toLowerCase();
    if (ALLOWED.has(v)) picked.add(v);
  }
  if (picked.size === 0) return [...TWILIO_VOICE_STATUS_CALLBACK_EVENTS];
  return TWILIO_VOICE_STATUS_CALLBACK_EVENTS.filter((e) => picked.has(e));
}
