import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { loadVoiceProviderRuntimeConfig } from './lib/voice/providerConfig';
import { getVoiceProviderAdapter } from './lib/voice/voiceProviderAdapter';
import { ingestNormalizedVoiceEvents } from './lib/voice/voiceWebhookIngest';
import { TwilioVoiceProvider } from './lib/voice/providers/twilioVoiceProvider';
import { TelnyxVoiceProvider } from './lib/voice/providers/telnyxVoiceProvider';

function flattenHeaders(
  raw: HandlerEvent['headers'] | HandlerEvent['multiValueHeaders']
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

function isTelnyxJsonBody(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const j = JSON.parse(raw) as { data?: { event_type?: string }; event_type?: string };
    const et = j?.data?.event_type ?? j?.event_type;
    return typeof et === 'string' && et.startsWith('call.');
  } catch {
    return false;
  }
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const jsonHeaders = { 'Content-Type': 'application/json' };
  const rawHeaders = flattenHeaders(event.headers);
  const bodyRaw = event.body ?? '';
  const isTwilioWebhook = !!(
    rawHeaders['x-twilio-signature'] ||
    rawHeaders['X-Twilio-Signature'] ||
    bodyRaw.includes('CallSid=')
  );
  const isTelnyxWebhook = !!(
    rawHeaders['telnyx-signature-ed25519'] ||
    rawHeaders['Telnyx-Signature-Ed25519'] ||
    rawHeaders['telnyx-timestamp'] ||
    rawHeaders['Telnyx-Timestamp'] ||
    isTelnyxJsonBody(bodyRaw)
  );
  const twilioAck = (): HandlerResponse => ({ statusCode: 204, headers: { 'Content-Type': 'text/plain' }, body: '' });

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...jsonHeaders, 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const config = loadVoiceProviderRuntimeConfig();
    const headers = rawHeaders;

    /** Twilio проверяет X-Twilio-Signature в адаптере; Telnyx — свою Ed25519; общий VOICE_WEBHOOK_SECRET — для mock JSON. */
    if (config.mode !== 'twilio' && config.webhookSecret && !isTwilioWebhook && !isTelnyxWebhook) {
      const h =
        headers['x-voice-webhook-secret'] ??
        headers['X-Voice-Webhook-Secret'] ??
        event.queryStringParameters?.secret;
      if (h !== config.webhookSecret) {
        return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Webhook unauthorized' }) };
      }
    }

    let adapter;
    try {
      if (isTwilioWebhook) {
        adapter = new TwilioVoiceProvider(config);
      } else if (isTelnyxWebhook) {
        adapter = new TelnyxVoiceProvider(config);
      } else {
        adapter = getVoiceProviderAdapter(config);
      }
    } catch (e) {
      if (isTwilioWebhook) {
        console.log(
          JSON.stringify({
            tag: 'voice.webhook.response',
            provider: 'twilio',
            statusCode: 204,
            swallowedError: String(e),
            reason: 'adapter_init_failed'
          })
        );
        return twilioAck();
      }
      return {
        statusCode: 501,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: false, error: String(e) })
      };
    }

    let events;
    try {
      events = await adapter.handleWebhook({
        rawBody: event.body ?? '',
        headers,
        queryParams: (event.queryStringParameters ?? {}) as Record<string, string | undefined>,
        requestUrl: event.rawUrl,
        config
      });
    } catch (e) {
      const msg = String(e);
      if (isTelnyxWebhook && msg.includes('Telnyx:')) {
        console.log(
          JSON.stringify({
            tag: 'voice.webhook.response',
            provider: 'telnyx',
            statusCode: 403,
            error: msg
          })
        );
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: msg }) };
      }
      if (msg.includes('mock webhook secret')) {
        return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Mock webhook secret mismatch' }) };
      }
      if (msg.includes('Twilio:') && (msg.includes('подпись') || msg.includes('X-Twilio-Signature'))) {
        if (isTwilioWebhook) {
          console.log(
            JSON.stringify({
              tag: 'voice.webhook.response',
              provider: 'twilio',
              statusCode: 204,
              swallowedError: msg,
              reason: 'signature_validation_failed'
            })
          );
          return twilioAck();
        }
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: msg }) };
      }
      if (isTwilioWebhook) {
        console.log(
          JSON.stringify({
            tag: 'voice.webhook.response',
            provider: 'twilio',
            statusCode: 204,
            swallowedError: msg,
            reason: 'handle_webhook_failed'
          })
        );
        return twilioAck();
      }
      throw e;
    }

    const { results, unknownOrUnmatched } = await ingestNormalizedVoiceEvents(events);

    if (isTelnyxWebhook) {
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.response',
          provider: 'telnyx',
          statusCode: 200,
          received: events.length,
          processed: results.length,
          unknownOrUnmatched
        })
      );
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: true,
          received: events.length,
          processed: results.length,
          unknownOrUnmatched
        })
      };
    }

    if (isTwilioWebhook) {
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.response',
          provider: 'twilio',
          statusCode: 204,
          received: events.length,
          processed: results.length,
          unknownOrUnmatched
        })
      );
      return twilioAck();
    }

    const response = {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        ok: true,
        received: events.length,
        processed: results.length,
        unknownOrUnmatched
      })
    };
    console.log(
      JSON.stringify({
        tag: 'voice.webhook.response',
        provider: adapter.providerId,
        statusCode: response.statusCode,
        received: events.length,
        processed: results.length
      })
    );
    return response;
  } catch (e) {
    if (isTwilioWebhook) {
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.response',
          provider: 'twilio',
          statusCode: 204,
          swallowedError: String(e),
          reason: 'outer_catch'
        })
      );
      return twilioAck();
    }
    console.log(
      JSON.stringify({
        tag: 'voice.webhook.response',
        statusCode: 500,
        error: String(e)
      })
    );
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: String(e) })
    };
  }
};
