/**
 * Voice-провайдер Zadarma (обратный звонок request/callback, webhook NOTIFY_*).
 * Авторизация API и формы подписи webhook — как в официальном TS SDK:
 * @see https://github.com/zadarma/user-api-typescript/blob/main/src/Client.ts
 * @see https://github.com/zadarma/user-api-typescript/blob/main/src/Webhook.ts
 * Документация методов: https://zadarma.com/en/support/api/
 */
import { createHmac } from 'node:crypto';
import type { VoiceNormalizedWebhookEvent } from '../../../../../src/types/voice';
import { getVoiceIntegration } from '../../firebaseAdmin';
import type {
  CreateOutboundVoiceCallInput,
  CreateOutboundVoiceCallResult,
  VoiceProviderAdapter,
  VoiceWebhookParseInput
} from '../voiceProviderAdapter';
import { zadarmaFetchDirectNumbers, zadarmaProbeBalance, zadarmaRequestCallback } from '../zadarmaApiClient';

const PROVIDER_ID = 'zadarma' as const;

/** Безопасно вытаскиваем строковые id из ответа request/callback (без секретов). */
export function extractZadarmaResponseIdentifiers(data: Record<string, unknown> | null | undefined): string[] {
  if (!data || typeof data !== 'object') return [];
  const idKeys = [
    'pbx_call_id',
    'call_id',
    'id',
    'callback_id',
    'member_id',
    'call_id_with_rec'
  ];
  const out: string[] = [];
  for (const k of idKeys) {
    const v = data[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || s.length > 160) continue;
    if (/secret|password|token|key/i.test(s)) continue;
    out.push(s);
  }
  return [...new Set(out)];
}

export type ZadarmaFriendlyFailureCode =
  | 'busy'
  | 'no_answer'
  | 'rejected'
  | 'invalid_number'
  | 'provider_auth_error'
  | 'provider_config_error'
  | 'webhook_signature_invalid'
  | 'webhook_match_failed'
  | 'unknown_provider_error';

function mapZadarmaDispositionToFriendly(
  disposition: string,
  statusCode: string | undefined
): ZadarmaFriendlyFailureCode {
  const d = String(disposition ?? '').trim().toLowerCase();
  const sc = String(statusCode ?? '').trim().toLowerCase();
  if (sc && (sc === '404' || sc === '484' || sc === '604' || d.includes('invalid') || d.includes('wrong number'))) {
    return 'invalid_number';
  }
  if (d === 'busy' || d.includes('busy') || d === 'congestion') return 'busy';
  if (d === 'no answer' || d === 'no_answer' || d.includes('no answer')) return 'no_answer';
  if (d === 'reject' || d === 'rejected' || d === 'decline' || d === 'declined') return 'rejected';
  if (d === 'cancel' || d === 'canceled' || d === 'cancelled') return 'unknown_provider_error';
  if (d === 'failed' || d === 'error') return 'unknown_provider_error';
  if (!d) return 'unknown_provider_error';
  return 'unknown_provider_error';
}

export const ZADARMA_NOTIFY = {
  OUT_START: 'NOTIFY_OUT_START',
  OUT_END: 'NOTIFY_OUT_END',
  RECORD: 'NOTIFY_RECORD'
} as const;

/** Ошибка проверки подписи webhook Zadarma. */
export class ZadarmaWebhookSignatureError extends Error {
  readonly code = 'webhook_signature_invalid' as const;

  constructor(public readonly verifyReason: string) {
    super(`Zadarma webhook signature invalid (${verifyReason})`);
    this.name = 'ZadarmaWebhookSignatureError';
  }
}

function headerCi(headers: Record<string, string | undefined>, name: string): string | undefined {
  const low = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === low) return v;
  }
  return undefined;
}

function parseWebhookFlat(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw?.trim()) return out;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) {
        if (v != null) out[k] = String(v);
      }
      return out;
    } catch {
      /* urlencoded */
    }
  }
  try {
    const sp = new URLSearchParams(trimmed);
    sp.forEach((v, k) => {
      out[k] = v;
    });
  } catch {
    /* ignore */
  }
  return out;
}

/** Строка для HMAC по документации / официальному Webhook.ts */
function zadarmaNotifySignatureBaseString(fields: Record<string, string>, event: string): string {
  const g = (k: string) => (fields[k] != null ? String(fields[k]) : '');
  switch (event) {
    case 'NOTIFY_START':
      return g('caller_id') + g('called_did') + g('call_start');
    case 'NOTIFY_INTERNAL':
      return g('caller_id') + g('called_did') + g('call_start');
    case 'NOTIFY_ANSWER':
      return g('caller_id') + g('destination') + g('call_start');
    case 'NOTIFY_END':
      return g('caller_id') + g('called_did') + g('call_start');
    case 'NOTIFY_OUT_START':
      return g('internal') + g('destination') + g('call_start');
    case 'NOTIFY_OUT_END':
      return g('internal') + g('destination') + g('call_start');
    case 'NOTIFY_RECORD':
      return g('pbx_call_id') + g('call_id_with_rec');
    case 'NOTIFY_IVR':
      return g('caller_id') + g('called_did') + g('call_start');
    default:
      return '';
  }
}

function expectedWebhookSignature(secret: string, fields: Record<string, string>, event: string): string {
  const base = zadarmaNotifySignatureBaseString(fields, event);
  return createHmac('sha1', secret).update(base).digest('base64');
}

function toE164FromDigits(d: string): string {
  const x = String(d ?? '').replace(/\D/g, '');
  if (!x) return '';
  return `+${x}`;
}

function dispositionToNormalized(
  disposition: string,
  statusCode?: string
): {
  type: VoiceNormalizedWebhookEvent['type'];
  cause: string | null;
  friendly: ZadarmaFriendlyFailureCode | null;
} {
  const d = String(disposition ?? '').trim().toLowerCase();
  const friendlyGuess = mapZadarmaDispositionToFriendly(disposition, statusCode);
  if (d === 'answered') return { type: 'provider.completed', cause: 'answered', friendly: null };
  if (d === 'busy' || d.includes('busy') || d === 'congestion')
    return { type: 'provider.busy', cause: 'busy', friendly: 'busy' };
  if (d === 'no answer' || d === 'no_answer' || d.includes('no answer'))
    return { type: 'provider.no_answer', cause: 'no_answer', friendly: 'no_answer' };
  if (d === 'cancel' || d === 'canceled' || d === 'cancelled')
    return { type: 'provider.failed', cause: 'canceled', friendly: 'unknown_provider_error' };
  if (d === 'failed' || d === 'error') return { type: 'provider.failed', cause: 'failed', friendly: friendlyGuess };
  if (d === 'reject' || d === 'rejected' || d === 'decline' || d === 'declined')
    return { type: 'provider.failed', cause: 'rejected', friendly: 'rejected' };
  if (friendlyGuess === 'invalid_number') return { type: 'provider.failed', cause: 'invalid_number', friendly: 'invalid_number' };
  return { type: 'provider.failed', cause: d || 'unknown', friendly: friendlyGuess };
}

export type ZadarmaSyncedPhoneNumber = {
  externalNumberId: string;
  e164: string;
  label: string | null;
  active: boolean;
  countryCode: string | null;
  readinessStatus: string;
  capabilities: { voice: boolean };
};

/**
 * Импорт номеров из GET /v1/direct_numbers/ (поле info[] из ответа).
 */
export async function fetchZadarmaPhoneNumbers(
  key: string,
  secret: string
): Promise<{ ok: true; numbers: ZadarmaSyncedPhoneNumber[] } | { ok: false; error: string }> {
  const res = await zadarmaFetchDirectNumbers(key, secret);
  if (!res.ok) return { ok: false, error: res.message };
  const info = res.data.info;
  if (!Array.isArray(info)) return { ok: true, numbers: [] };
  const out: ZadarmaSyncedPhoneNumber[] = [];
  for (const raw of info) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const numRaw = row.number != null ? String(row.number) : '';
    const digits = numRaw.replace(/\D/g, '');
    if (!digits) continue;
    const e164 = `+${digits}`;
    const status = String(row.status ?? '').toLowerCase();
    const active = status !== 'disabled' && status !== 'closed';
    const label =
      row.number_name != null && String(row.number_name).trim() ? String(row.number_name).trim() : null;
    const country = row.country != null && String(row.country).trim() ? String(row.country).trim().slice(0, 8) : null;
    const sipVal = row.sip;
    const sipPart =
      sipVal != null && String(sipVal).trim() ? String(sipVal).replace(/\D/g, '') || String(sipVal).trim() : 'na';
    const extId = `dn_${digits}_sip_${sipPart}`;
    out.push({
      externalNumberId: extId,
      e164,
      label,
      active,
      countryCode: country,
      readinessStatus: active ? 'ready' : 'inactive',
      capabilities: { voice: true }
    });
  }
  return { ok: true, numbers: out };
}

export async function probeZadarmaCredentials(
  key: string,
  secret: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const k = key.trim();
  const s = secret.trim();
  if (!k) return { ok: false, error: 'Пустой API Key (user key)' };
  if (!s) return { ok: false, error: 'Пустой Secret Key' };
  const res = await zadarmaProbeBalance(k, s);
  if (!res.ok) {
    if (res.httpStatus === 401 || res.httpStatus === 403) {
      return { ok: false, error: 'Zadarma отклонила ключи (неверный key/secret)' };
    }
    return { ok: false, error: res.message || 'Не удалось проверить ключи Zadarma' };
  }
  return { ok: true };
}

export class ZadarmaVoiceProvider implements VoiceProviderAdapter {
  readonly providerId: string = PROVIDER_ID;

  async createOutboundCall(input: CreateOutboundVoiceCallInput): Promise<CreateOutboundVoiceCallResult> {
    const row = await getVoiceIntegration(input.companyId);
    const key = row?.zadarmaKey?.trim() ?? '';
    const secret = row?.zadarmaSecret?.trim() ?? '';
    const ext = row?.zadarmaCallbackExtension?.trim() ?? '';
    if (!row?.zadarmaEnabled) {
      return {
        ok: false,
        error: 'Интеграция Zadarma выключена',
        code: 'zadarma_disabled',
        friendlyCode: 'provider_connection_missing',
        hint: 'Включите Zadarma в Интеграциях.',
        providerFailureCode: 'zadarma_disabled'
      };
    }
    if (!key || !secret) {
      return {
        ok: false,
        error: 'Сохраните API Key и Secret Zadarma',
        code: 'zadarma_credentials_missing',
        friendlyCode: 'provider_auth_error',
        providerFailureCode: 'zadarma_credentials_missing'
      };
    }
    if (!ext) {
      return {
        ok: false,
        error:
          'Укажите внутренний номер АТС (расширение) для CallBack — поле «Первый вызов на extension». Это параметр from в Zadarma request/callback.',
        code: 'zadarma_callback_extension_required',
        friendlyCode: 'provider_connection_missing',
        hint: 'Например 100 или 101 — тот extension, который должен зазвонить первым по документации Zadarma.',
        providerFailureCode: 'zadarma_callback_extension_required'
      };
    }

    const toDigits = String(input.toE164 ?? '').replace(/\D/g, '');
    if (!toDigits) {
      return {
        ok: false,
        error: 'Пустой номер назначения',
        code: 'invalid_to',
        friendlyCode: 'invalid_number',
        providerFailureCode: 'invalid_number'
      };
    }

    const sipDigits = String(input.fromE164 ?? '').replace(/\D/g, '');
    const predicted = row.zadarmaPredicted === true;

    const api = await zadarmaRequestCallback(key, secret, {
      from: ext.replace(/\D/g, '') || ext,
      to: toDigits,
      sip: sipDigits || undefined,
      predicted
    });

    if (!api.ok) {
      const low = (api.message || '').toLowerCase();
      const friendlyCode: string =
        api.httpStatus === 401 || api.httpStatus === 403
          ? 'provider_auth_error'
          : low.includes('balance') || low.includes('money')
            ? 'provider_config_error'
            : low.includes('invalid') && (low.includes('number') || low.includes('phone'))
              ? 'invalid_number'
              : 'provider_api_error';
      return {
        ok: false,
        error: api.message || 'Zadarma request/callback отклонён',
        code: 'zadarma_api_error',
        friendlyCode,
        hint: 'Проверьте баланс, права API и корректность extension / номера.',
        providerFailureCode: 'zadarma_api_error',
        providerFailureReason: api.message,
        providerDebug: { httpStatus: api.httpStatus, zadarmaFriendlyCode: friendlyCode }
      };
    }

    const dataObj = (api.data ?? {}) as Record<string, unknown>;
    const extractedIds = extractZadarmaResponseIdentifiers(dataObj);
    const pendingProviderCallId = `zadarma:${input.companyId}:${input.callId}`;
    const primaryFromApi = extractedIds.find((x) => x && !x.startsWith('zadarma:')) ?? null;

    return {
      ok: true,
      providerCallId: pendingProviderCallId,
      raw: dataObj,
      providerDebug: {
        zadarmaRequest: 'request/callback',
        predicted,
        fromExtension: ext.replace(/\D/g, '') ? ext.replace(/\D/g, '') : ext,
        toDigits,
        sipDigitsUsed: sipDigits || null,
        zadarmaApiExtractedIds: extractedIds,
        zadarmaApiResponseTopKeys: Object.keys(dataObj).slice(0, 40),
        zadarmaPrimaryCallIdFromApi: primaryFromApi
      },
      initialNormalizedEvents: []
    };
  }

  async handleWebhook(input: VoiceWebhookParseInput): Promise<VoiceNormalizedWebhookEvent[]> {
    const raw = parseWebhookFlat(input.rawBody);
    const event = String(raw.event ?? '').trim();
    if (!event || !event.startsWith('NOTIFY_')) return [];

    const companyId = String(input.queryParams.companyId ?? '').trim();
    if (!companyId) {
      throw new Error('Zadarma: в URL webhook укажите ?companyId=… (ID компании в CRM)');
    }

    const row = await getVoiceIntegration(companyId);
    const secret = row?.zadarmaSecret?.trim() ?? '';
    if (!secret) {
      throw new Error('Zadarma: в CRM не сохранён Secret Key — не могу проверить подпись webhook');
    }

    const sigHeader = headerCi(input.headers, 'Signature') ?? headerCi(input.headers, 'signature');
    if (!sigHeader?.trim()) {
      throw new ZadarmaWebhookSignatureError('Отсутствует заголовок Signature');
    }

    const expected = expectedWebhookSignature(secret, raw, event);
    if (expected !== sigHeader.trim()) {
      throw new ZadarmaWebhookSignatureError('Несовпадение подписи');
    }

    const toE164 =
      event === ZADARMA_NOTIFY.OUT_START || event === ZADARMA_NOTIFY.OUT_END
        ? toE164FromDigits(raw.destination ?? '')
        : '';

    const zadarmaLookup =
      toE164 && companyId
        ? { companyId, toE164 }
        : companyId
          ? { companyId, toE164: toE164 || '' }
          : undefined;

    const pbxCallId = String(raw.pbx_call_id ?? '').trim();
    if (!pbxCallId) {
      console.log(
        JSON.stringify({
          tag: 'voice.zadarma.webhook.skip',
          reason: 'missing_pbx_call_id',
          event,
          companyId: companyId || null
        })
      );
      return [];
    }

    const alternateIds = [pbxCallId, String(raw.call_id ?? '').trim(), String(raw.id ?? '').trim()].filter(
      (x, i, a) => x && a.indexOf(x) === i
    );

    const occurredAt = (() => {
      const cs = raw.call_start;
      if (cs && /^\d+$/.test(String(cs).trim())) {
        const n = parseInt(String(cs).trim(), 10);
        if (Number.isFinite(n) && n > 1e9) return new Date(n * 1000).toISOString();
      }
      return new Date().toISOString();
    })();

    if (event === ZADARMA_NOTIFY.OUT_START) {
      return [
        {
          type: 'provider.ringing',
          providerCallId: pbxCallId,
          occurredAt,
          cause: null,
          providerEventType: event,
          providerEventId: `zadarma:${pbxCallId}:out_start`,
          providerMeta: {
            provider: 'zadarma',
            internal: raw.internal ?? null,
            destination: raw.destination ?? null,
            zadarmaLookup,
            zadarmaAlternateProviderCallIds: alternateIds,
            raw: { ...raw }
          }
        }
      ];
    }

    if (event === ZADARMA_NOTIFY.OUT_END) {
      const disp = String(raw.disposition ?? '').trim();
      const statusCode = String(raw.status_code ?? raw.sip_status ?? '').trim();
      const { type, cause, friendly } = dispositionToNormalized(disp, statusCode);
      const durRaw = raw.duration;
      let durationSec: number | null = null;
      if (typeof durRaw === 'string' && /^\d+$/.test(durRaw.trim())) {
        durationSec = parseInt(durRaw.trim(), 10);
      } else if (typeof durRaw === 'number' && Number.isFinite(durRaw)) {
        durationSec = Math.floor(durRaw);
      }

      return [
        {
          type,
          providerCallId: pbxCallId,
          occurredAt,
          durationSec,
          cause,
          providerEventType: event,
          providerEventId: `zadarma:${pbxCallId}:out_end:${disp}`,
          providerMeta: {
            provider: 'zadarma',
            disposition: disp,
            statusCode: raw.status_code ?? null,
            isRecorded: raw.is_recorded ?? null,
            zadarmaLookup,
            zadarmaAlternateProviderCallIds: alternateIds,
            ...(friendly ? { zadarmaFriendlyFailureCode: friendly } : {}),
            callStatus:
              type === 'provider.completed'
                ? 'completed'
                : type === 'provider.busy'
                  ? 'busy'
                  : type === 'provider.no_answer'
                    ? 'no-answer'
                    : 'failed',
            raw: { ...raw }
          }
        }
      ];
    }

    if (event === ZADARMA_NOTIFY.RECORD) {
      const link =
        raw.link ||
        raw.recording_url ||
        raw.recording_link ||
        raw.url ||
        raw.file ||
        raw.download;
      return [
        {
          type: 'provider.unknown',
          providerCallId: pbxCallId,
          occurredAt,
          cause: 'record_ready',
          providerEventType: event,
          providerEventId: `zadarma:${pbxCallId}:record:${raw.call_id_with_rec ?? ''}`,
          providerMeta: {
            provider: 'zadarma',
            callIdWithRec: raw.call_id_with_rec ?? null,
            zadarmaLookup,
            zadarmaAlternateProviderCallIds: alternateIds,
            zadarmaRecordingUrl: link ? String(link).slice(0, 2048) : null,
            raw: { ...raw }
          }
        }
      ];
    }

    return [];
  }
}
