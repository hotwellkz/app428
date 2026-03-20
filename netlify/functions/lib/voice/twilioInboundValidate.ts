import type { HandlerEvent } from '@netlify/functions';
import twilio from 'twilio';
import {
  resolveTwilioSignedRequestUrl,
  type TwilioSignedEndpointKind,
  type VoiceProviderRuntimeConfig
} from './providerConfig';

export function twilioDecodeRequestBody(event: HandlerEvent): string {
  if (!event.body) return '';
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event.body;
}

export function twilioParseFormBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Проверка X-Twilio-Signature для TwiML / Gather (без Firebase auth).
 */
export function validateTwilioInboundRequest(
  event: HandlerEvent,
  config: VoiceProviderRuntimeConfig,
  kind: TwilioSignedEndpointKind
): Record<string, string> {
  const rawBody = twilioDecodeRequestBody(event);
  const params = twilioParseFormBody(rawBody);
  const token = config.twilioAuthToken;
  if (!token) {
    throw new Error('Twilio: TWILIO_AUTH_TOKEN не задан');
  }

  if (!config.twilioSkipSignatureValidation) {
    const signature =
      event.headers['x-twilio-signature'] ?? event.headers['X-Twilio-Signature'] ?? undefined;
    if (!signature) {
      throw new Error('Twilio: отсутствует заголовок X-Twilio-Signature');
    }
    const validationUrl = resolveTwilioSignedRequestUrl(event.rawUrl, config, kind);
    const ok = twilio.validateRequest(token, signature, validationUrl, params);
    if (!ok) {
      throw new Error('Twilio: неверная подпись (проверьте TWILIO_TWIML_PUBLIC_URL / TWILIO_GATHER_PUBLIC_URL)');
    }
  }

  return params;
}
