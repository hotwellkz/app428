import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { loadVoiceProviderRuntimeConfig } from './lib/voice/providerConfig';
import { getVoiceProviderAdapter } from './lib/voice/voiceProviderAdapter';
import { ingestNormalizedVoiceEvents } from './lib/voice/voiceWebhookIngest';

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

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...jsonHeaders, 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const config = loadVoiceProviderRuntimeConfig();
    const headers = flattenHeaders(event.headers);

    /** Twilio проверяет X-Twilio-Signature в адаптере; общий VOICE_WEBHOOK_SECRET — для mock/прочего. */
    if (config.mode !== 'twilio' && config.webhookSecret) {
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
      adapter = getVoiceProviderAdapter(config);
    } catch (e) {
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
      if (msg.includes('mock webhook secret')) {
        return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Mock webhook secret mismatch' }) };
      }
      if (msg.includes('Twilio:') && (msg.includes('подпись') || msg.includes('X-Twilio-Signature'))) {
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: msg }) };
      }
      throw e;
    }

    const { results, unknownOrUnmatched } = await ingestNormalizedVoiceEvents(events);

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
  } catch (e) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: String(e) })
    };
  }
};
