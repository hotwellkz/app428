import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { Timestamp } from 'firebase-admin/firestore';
import { mergeVoiceIntegrationTelnyx, mergeVoiceIntegrationZadarma } from './lib/firebaseAdmin';
import { loadVoiceProviderRuntimeConfig } from './lib/voice/providerConfig';
import { getVoiceProviderAdapter } from './lib/voice/voiceProviderAdapter';
import { ingestNormalizedVoiceEvents } from './lib/voice/voiceWebhookIngest';
import { voiceFriendlyMessageRu } from './lib/voice/voiceProviderFriendlyCodes';
import { adminUpdateVoiceCallSession } from './lib/voice/voiceFirestoreAdmin';
import { TwilioVoiceProvider } from './lib/voice/providers/twilioVoiceProvider';
import { TelnyxVoiceProvider, TelnyxWebhookSignatureError } from './lib/voice/providers/telnyxVoiceProvider';
import { ZadarmaVoiceProvider, ZadarmaWebhookSignatureError } from './lib/voice/providers/zadarmaVoiceProvider';

function truthyEnv(key: string): boolean {
  const v = process.env[key];
  return v === '1' || v === 'true' || v === 'yes';
}

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

const jsonHeaders = { 'Content-Type': 'application/json' };

/** Telnyx всегда получает 200 + { status: "ok" } — см. TELNYX_WEBHOOK_MINIMAL в .env.example */
function telnyxOkResponse(): HandlerResponse {
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ status: 'ok' })
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const rawHeaders = flattenHeaders(event.headers);
  const bodyRaw = event.body ?? '';
  const isTwilioWebhook = !!(
    rawHeaders['x-twilio-signature'] ||
    rawHeaders['X-Twilio-Signature'] ||
    bodyRaw.includes('CallSid=')
  );
  const hasTelnyxSigHeaders = !!(
    rawHeaders['telnyx-signature-ed25519'] ||
    rawHeaders['Telnyx-Signature-Ed25519'] ||
    rawHeaders['telnyx-timestamp'] ||
    rawHeaders['Telnyx-Timestamp']
  );
  const ua = String(rawHeaders['user-agent'] ?? rawHeaders['User-Agent'] ?? '').toLowerCase();
  const isTelnyxUa = ua.includes('telnyx');
  const hasCrmTelnyxQuery = !!String(event.queryStringParameters?.companyId ?? '').trim();

  const isTelnyxWebhook = !!(
    hasTelnyxSigHeaders ||
    isTelnyxJsonBody(bodyRaw) ||
    isTelnyxUa
  );

  /** Расширенное определение: CRM подставляет companyId в URL webhook исходящего звонка */
  const isTelnyxFlow =
    isTelnyxWebhook || (!isTwilioWebhook && hasCrmTelnyxQuery) || (!isTwilioWebhook && isTelnyxUa);

  const twilioAck = (): HandlerResponse => ({ statusCode: 204, headers: { 'Content-Type': 'text/plain' }, body: '' });

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...jsonHeaders, 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  /** Проверка URL в кабинете Zadarma (GET ?zd_echo=…) — см. документацию Zadarma API / webhook. */
  if (event.httpMethod === 'GET') {
    const zd = event.queryStringParameters?.zd_echo;
    if (zd != null && zd !== '') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: zd
      };
    }
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const sigZ = rawHeaders['signature'] ?? rawHeaders['Signature'];
  const isZadarmaWebhook = !!(
    sigZ?.trim() &&
    (bodyRaw.includes('NOTIFY_') || bodyRaw.includes('event=NOTIFY'))
  );

  // --- Zadarma PBX notifications: POST + заголовок Signature + NOTIFY_* ---
  if (isZadarmaWebhook && !isTwilioWebhook) {
    const zOk = (): HandlerResponse => ({
      statusCode: 200,
      headers: { ...jsonHeaders, 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'ok' })
    });
    try {
      const config = loadVoiceProviderRuntimeConfig();
      const adapter = new ZadarmaVoiceProvider(config);
      const events = await adapter.handleWebhook({
        rawBody: event.body ?? '',
        headers: rawHeaders,
        queryParams: (event.queryStringParameters ?? {}) as Record<string, string | undefined>,
        requestUrl: event.rawUrl,
        config
      });
      const cid = String(event.queryStringParameters?.companyId ?? '').trim();
      const { results, unknownOrUnmatched } = await ingestNormalizedVoiceEvents(events);
      const lastEv = events.length > 0 ? events[events.length - 1] : null;
      const allEventsUnmatched =
        events.length > 0 && results.length > 0 && results.every((r) => !r.ok);
      if (cid) {
        if (allEventsUnmatched) {
          await mergeVoiceIntegrationZadarma(cid, {
            zadarmaWebhookLastErrorCode: 'webhook_match_failed',
            zadarmaWebhookLastErrorAt: Timestamp.now(),
            zadarmaWebhookLastErrorDetail: 'Нет сессии CRM для события Zadarma (проверьте URL с companyId и время звонка).',
            zadarmaLastWebhookAt: Timestamp.now(),
            zadarmaLastWebhookEventType: lastEv?.providerEventType ?? null,
            zadarmaLastWebhookSignatureOk: true
          });
        } else {
          await mergeVoiceIntegrationZadarma(cid, {
            zadarmaWebhookLastErrorCode: null,
            zadarmaWebhookLastErrorAt: null,
            zadarmaWebhookLastErrorDetail: null,
            zadarmaLastWebhookAt: Timestamp.now(),
            zadarmaLastWebhookEventType: lastEv?.providerEventType ?? null,
            zadarmaLastWebhookSignatureOk: true
          });
        }
      }
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.zadarma.processed',
          received: events.length,
          processed: results.length,
          unknownOrUnmatched,
          allEventsUnmatched
        })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        if (e instanceof ZadarmaWebhookSignatureError) {
          const companyId = String(event.queryStringParameters?.companyId ?? '').trim();
          if (companyId) {
            await mergeVoiceIntegrationZadarma(companyId, {
              zadarmaWebhookLastErrorCode: 'webhook_signature_invalid',
              zadarmaWebhookLastErrorAt: Timestamp.now(),
              zadarmaWebhookLastErrorDetail: e.verifyReason,
              zadarmaLastWebhookSignatureOk: false
            });
          }
        } else if (msg.includes('Zadarma:')) {
          const companyId = String(event.queryStringParameters?.companyId ?? '').trim();
          if (companyId) {
            await mergeVoiceIntegrationZadarma(companyId, {
              zadarmaWebhookLastErrorCode: 'provider_webhook_error',
              zadarmaWebhookLastErrorAt: Timestamp.now(),
              zadarmaWebhookLastErrorDetail: msg.slice(0, 200)
            });
          }
        }
      } catch (mergeErr) {
        console.log(JSON.stringify({ tag: 'voice.webhook.zadarma.merge_error', error: String(mergeErr) }));
      }
      console.log(JSON.stringify({ tag: 'voice.webhook.zadarma.error', error: msg }));
    }
    return zOk();
  }

  // --- Telnyx: всегда HTTP 200 + { status: "ok" }; ошибки только в логах / Firestore (readiness) ---
  if (isTelnyxFlow && !isTwilioWebhook) {
    try {
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.telnyx.incoming',
          bodyLen: bodyRaw.length,
          body: bodyRaw.slice(0, 16000),
          query: event.queryStringParameters ?? {},
          hasTelnyxSigHeaders,
          isTelnyxUa
        })
      );
    } catch (logErr) {
      console.log(JSON.stringify({ tag: 'voice.webhook.telnyx.log_error', error: String(logErr) }));
    }

    if (truthyEnv('TELNYX_WEBHOOK_MINIMAL')) {
      console.log(JSON.stringify({ tag: 'voice.webhook.telnyx.minimal', note: 'TELNYX_WEBHOOK_MINIMAL: skip adapter/ingest' }));
      return telnyxOkResponse();
    }

    try {
      const config = loadVoiceProviderRuntimeConfig();
      const headers = rawHeaders;
      const adapter = new TelnyxVoiceProvider(config);
      const events = await adapter.handleWebhook({
        rawBody: event.body ?? '',
        headers,
        queryParams: (event.queryStringParameters ?? {}) as Record<string, string | undefined>,
        requestUrl: event.rawUrl,
        config
      });
      const cid = String(event.queryStringParameters?.companyId ?? '').trim();
      if (cid) {
        await mergeVoiceIntegrationTelnyx(cid, {
          telnyxWebhookLastErrorCode: null,
          telnyxWebhookLastErrorAt: null,
          telnyxWebhookLastErrorDetail: null
        });
      }
      const { results, unknownOrUnmatched } = await ingestNormalizedVoiceEvents(events);
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.telnyx.processed',
          received: events.length,
          processed: results.length,
          unknownOrUnmatched
        })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        if (e instanceof TelnyxWebhookSignatureError) {
          const companyId = String(event.queryStringParameters?.companyId ?? '').trim();
          const callId = String(event.queryStringParameters?.callId ?? '').trim();
          if (companyId) {
            await mergeVoiceIntegrationTelnyx(companyId, {
              telnyxWebhookLastErrorCode: 'provider_webhook_signature_invalid',
              telnyxWebhookLastErrorAt: Timestamp.now(),
              telnyxWebhookLastErrorDetail: e.verifyReason
            });
          }
          if (companyId && callId) {
            try {
              await adminUpdateVoiceCallSession(companyId, callId, {
                providerFailureCode: 'provider_webhook_signature_invalid',
                providerFailureReason: 'webhook_signature_invalid'
              });
            } catch {
              /* ignore */
            }
          }
        } else if (msg.includes('Telnyx:')) {
          const companyId = String(event.queryStringParameters?.companyId ?? '').trim();
          const code = msg.includes('Public Key') ? 'provider_public_key_missing' : 'provider_webhook_error';
          if (companyId) {
            await mergeVoiceIntegrationTelnyx(companyId, {
              telnyxWebhookLastErrorCode: code,
              telnyxWebhookLastErrorAt: Timestamp.now(),
              telnyxWebhookLastErrorDetail: msg.slice(0, 200)
            });
          }
        }
      } catch (mergeErr) {
        console.log(JSON.stringify({ tag: 'voice.webhook.telnyx.merge_error', error: String(mergeErr) }));
      }
      console.log(
        JSON.stringify({
          tag: 'voice.webhook.telnyx.processing_error',
          error: msg,
          friendly: e instanceof TelnyxWebhookSignatureError ? voiceFriendlyMessageRu('provider_webhook_signature_invalid') : undefined
        })
      );
    }
    return telnyxOkResponse();
  }

  try {
    const config = loadVoiceProviderRuntimeConfig();
    const headers = rawHeaders;

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
      const msg = e instanceof Error ? e.message : String(e);
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
