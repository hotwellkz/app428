import type { VoiceNormalizedWebhookEvent } from '../../../../../src/types/voice';
import { getVoiceIntegration } from '../../firebaseAdmin';
import {
  buildVoiceProviderWebhookUrl,
  loadVoiceProviderRuntimeConfig,
  type VoiceProviderRuntimeConfig
} from '../providerConfig';
import { verifyTelnyxWebhookSignature } from '../telnyxWebhookVerify';
import type {
  CreateOutboundVoiceCallInput,
  CreateOutboundVoiceCallResult,
  VoiceProviderAdapter,
  VoiceProviderCapabilities,
  VoiceProviderValidateConfigResult,
  VoiceWebhookParseInput
} from '../voiceProviderAdapter';

const PROVIDER_ID = 'telnyx';

/** Ошибка проверки Ed25519-подписи входящего webhook Telnyx (обрабатывается в voice-provider-webhook). */
export class TelnyxWebhookSignatureError extends Error {
  readonly code = 'provider_webhook_signature_invalid' as const;

  constructor(public readonly verifyReason: string) {
    super(`Telnyx webhook signature invalid (${verifyReason})`);
    this.name = 'TelnyxWebhookSignatureError';
  }
}

function truthyEnv(key: string): boolean {
  const v = process.env[key];
  return v === '1' || v === 'true' || v === 'yes';
}

function headerCi(headers: Record<string, string | undefined>, name: string): string | undefined {
  const low = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === low) return v;
  }
  return undefined;
}

/**
 * Нормализует ID Call Control Application: trim, убирает zero-width/NBSP,
 * вытаскивает id из вставленной ссылки Mission Control / API (…/call_control_applications/{id}).
 */
export function normalizeTelnyxCallControlApplicationId(raw: string): string {
  let s = String(raw ?? '')
    .trim()
    .replace(/\u200B|\uFEFF/g, '')
    .replace(/[\u00A0\s]+/g, '');
  if (!s) return '';
  try {
    if (s.includes('://')) {
      const u = new URL(s);
      const m = u.pathname.match(/call_control_applications\/([^/?#]+)/i);
      if (m?.[1]) return decodeURIComponent(m[1].trim());
    }
  } catch {
    /* не URL */
  }
  const m2 = s.match(/call_control_applications\/([^/?#]+)/i);
  if (m2?.[1]) return decodeURIComponent(m2[1].trim());
  return s;
}

function looksLikeE164Phone(id: string): boolean {
  if (!id) return false;
  if (id.startsWith('+')) return /^\+\d{10,15}$/.test(id);
  return /^\d{10,15}$/.test(id);
}

/**
 * Список Call Control Applications по API Key — для подсказки, если GET по одному ID вернул 404.
 */
export async function listTelnyxCallControlApplicationsForHint(apiKey: string): Promise<
  | { ok: true; applications: Array<{ id: string; application_name: string | null }> }
  | { ok: false }
> {
  const k = apiKey.trim();
  if (!k) return { ok: false };
  try {
    const res = await fetch(
      'https://api.telnyx.com/v2/call_control_applications?page[size]=50&page[number]=1',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${k}`, Accept: 'application/json' }
      }
    );
    if (!res.ok) return { ok: false };
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const data = Array.isArray(json.data) ? json.data : [];
    const applications = data
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const id = String(row.id ?? '').trim();
        const application_name =
          typeof row.application_name === 'string' && row.application_name.trim()
            ? row.application_name.trim()
            : null;
        return { id, application_name };
      })
      .filter((a) => a.id);
    return { ok: true, applications };
  } catch {
    return { ok: false };
  }
}

/** GET /v2/call_control_applications/{id} — проверка ID перед исходящим звонком. */
export type TelnyxCallControlAppProbe =
  | {
      ok: true;
      id: string;
      applicationName: string | null;
      webhookEventUrl: string | null;
      active: boolean;
    }
  | { ok: false; error: string; httpStatus?: number };

export async function fetchTelnyxCallControlApplication(
  apiKey: string,
  applicationId: string
): Promise<TelnyxCallControlAppProbe> {
  const k = apiKey.trim();
  const id = normalizeTelnyxCallControlApplicationId(applicationId);
  if (!k) return { ok: false, error: 'Пустой API Key' };
  if (!id) return { ok: false, error: 'Пустой Connection / Application ID' };
  if (id.startsWith('KEY')) {
    return {
      ok: false,
      error:
        'В поле Connection / Application ID похоже вставлен API Key (начинается с KEY…). Нужен только числовой ID приложения Call Control из Mission Control (Voice → Call Control Applications → ID).'
    };
  }
  if (looksLikeE164Phone(id)) {
    return {
      ok: false,
      error:
        'В поле похоже на номер телефона (E.164), а не на ID Call Control Application. В Mission Control: Voice → Call Control Applications — скопируйте столбец ID (длинное число), не номер.'
    };
  }
  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/call_control_applications/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${k}`, Accept: 'application/json' }
      }
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 404) {
      const base =
        'Call Control Application с таким ID не найден (404). Проверьте: 1) ID из Voice → Call Control Applications (столбец ID), не из Phone Numbers / TeXML / SIP. 2) Тот же Telnyx-аккаунт, что и API Key в CRM. 3) Можно вставить целиком URL страницы приложения — сервер извлечёт ID.';
      let extra = '';
      const listed = await listTelnyxCallControlApplicationsForHint(k);
      if (listed.ok) {
        if (listed.applications.length === 0) {
          extra =
            ' По этому API Key в аккаунте нет ни одного Call Control Application — создайте приложение в Mission Control (Voice → Call Control Applications) и укажите его ID.';
        } else {
          const parts = listed.applications.slice(0, 12).map((a) =>
            a.application_name ? `${a.id} («${a.application_name}»)` : a.id
          );
          const tail =
            listed.applications.length > 12
              ? ` … (+${listed.applications.length - 12} ещё)`
              : '';
          extra = ` По этому ключу API Telnyx видит приложения: ${parts.join(', ')}${tail}. Вставьте в CRM один из этих ID (возможно, был указан неверный или устаревший).`;
        }
      }
      return {
        ok: false,
        error: base + (extra ? ` ${extra}` : ''),
        httpStatus: 404
      };
    }
    if (!res.ok) {
      const errors = json.errors as Array<{ detail?: string; title?: string }> | undefined;
      const msg = errors?.[0]?.detail || errors?.[0]?.title || JSON.stringify(json).slice(0, 280);
      return { ok: false, error: `Telnyx API ${res.status}: ${msg}`, httpStatus: res.status };
    }
    const data = json.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Telnyx: пустой ответ при получении Call Control Application' };
    }
    const w1 = data.webhook_event_url;
    const w2 = (data as Record<string, unknown>).webhook_url;
    const webhookEventUrl =
      typeof w1 === 'string' && w1.trim()
        ? w1.trim()
        : typeof w2 === 'string' && w2.trim()
          ? w2.trim()
          : null;
    return {
      ok: true,
      id: String(data.id ?? id),
      applicationName:
        typeof data.application_name === 'string' ? data.application_name.trim() : null,
      webhookEventUrl,
      active: data.active === true
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сеть / Telnyx недоступен' };
  }
}

/**
 * Сверяет webhook_event_url из Telnyx с тем, что CRM использует при POST /v2/calls.
 * Домен должен совпадать с VOICE_PUBLIC_SITE_URL; путь — содержать voice-provider-webhook.
 */
export function validateTelnyxCallControlWebhookForCrm(
  webhookEventUrl: string | null
): { ok: true } | { ok: false; error: string } {
  const cfg = loadVoiceProviderRuntimeConfig();
  const expected = buildVoiceProviderWebhookUrl(cfg);
  if (!webhookEventUrl?.trim()) {
    return {
      ok: false,
      error:
        'В Call Control Application в Mission Control не задан Webhook URL. Откройте приложение → укажите URL из блока CRM «Webhook URL для Call Control» (HTTPS, без параметров ?).'
    };
  }
  const w = webhookEventUrl.trim();
  if (!/^https:\/\//i.test(w)) {
    return { ok: false, error: 'Webhook URL в Telnyx должен начинаться с https://' };
  }
  if (!expected.startsWith('http')) {
    return { ok: true };
  }
  try {
    const exp = new URL(expected);
    const got = new URL(w);
    if (exp.hostname !== got.hostname) {
      return {
        ok: false,
        error: `В Telnyx Webhook указывает на ${got.hostname}, CRM собирает URL для ${exp.hostname}. Задайте в Netlify переменную URL / VOICE_PUBLIC_SITE_URL=https://${exp.hostname} и тот же хост в Mission Control.`
      };
    }
    if (!got.pathname.includes('voice-provider-webhook')) {
      return {
        ok: false,
        error:
          'В Telnyx в пути Webhook должен быть endpoint …/voice-provider-webhook (скопируйте полный URL из CRM).'
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Некорректный Webhook URL в Telnyx' };
  }
}

export async function probeTelnyxApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const k = apiKey.trim();
  if (!k) return { ok: false, error: 'Пустой API Key' };
  try {
    const res = await fetch('https://api.telnyx.com/v2/phone_numbers?page[size]=1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${k}`, Accept: 'application/json' }
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Telnyx отклонил ключ (401/403)' };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `Telnyx API ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сеть / Telnyx недоступен' };
  }
}

/** Одна запись из Telnyx API `GET /v2/phone_numbers` для sync в CRM. */
export type TelnyxSyncedPhoneNumber = {
  externalNumberId: string;
  e164: string;
  label: string | null;
  active: boolean;
  countryCode: string | null;
  readinessStatus: string;
  capabilities: { voice: boolean };
};

/**
 * Загружает все номера телефонии аккаунта Telnyx (официальный API v2, пагинация page[number]/page[size]).
 * @see https://developers.telnyx.com/api/phone-numbers/list-phone-numbers
 */
export async function fetchTelnyxPhoneNumbers(
  apiKey: string
): Promise<{ ok: true; numbers: TelnyxSyncedPhoneNumber[] } | { ok: false; error: string }> {
  const k = apiKey.trim();
  if (!k) return { ok: false, error: 'Пустой API Key' };
  const out: TelnyxSyncedPhoneNumber[] = [];
  let page = 1;
  const pageSize = 50;
  try {
    for (;;) {
      const url = `https://api.telnyx.com/v2/phone_numbers?page[size]=${pageSize}&page[number]=${page}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${k}`, Accept: 'application/json' }
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'Telnyx отклонил ключ (401/403)' };
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return { ok: false, error: `Telnyx API ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}` };
      }
      const json = (await res.json()) as Record<string, unknown>;
      const data = Array.isArray(json.data) ? json.data : [];
      const meta = json.meta as Record<string, unknown> | undefined;
      for (const raw of data) {
        const row = raw as Record<string, unknown>;
        const id = String(row.id ?? '').trim();
        const phone = String(row.phone_number ?? '').trim();
        if (!id || !phone) continue;
        const status = String(row.status ?? '').toLowerCase();
        const active = status === 'active' || status === 'porting' || status === 'pending';
        const friendly =
          row.friendly_name != null && String(row.friendly_name).trim()
            ? String(row.friendly_name).trim()
            : null;
        const countryIso =
          row.country_iso_alpha2 != null && String(row.country_iso_alpha2).trim()
            ? String(row.country_iso_alpha2).trim().slice(0, 8)
            : null;
        const countryFromCode =
          row.country_code != null && String(row.country_code).trim()
            ? String(row.country_code).trim().slice(0, 8)
            : null;
        const countryCode = countryIso ?? countryFromCode ?? null;
        const features = row.features as Record<string, unknown> | undefined;
        const vfeat = features?.voice;
        const voiceCap =
          vfeat === false ? false : vfeat === true || typeof vfeat === 'object' || vfeat === undefined;
        out.push({
          externalNumberId: id,
          e164: phone,
          label: friendly,
          active,
          countryCode,
          readinessStatus: active ? 'ready' : 'inactive',
          capabilities: { voice: voiceCap }
        });
      }
      const totalPages =
        typeof meta?.total_pages === 'number' && Number.isFinite(meta.total_pages) ? meta.total_pages : 1;
      const pageNumber =
        typeof meta?.page_number === 'number' && Number.isFinite(meta.page_number) ? meta.page_number : page;
      if (pageNumber >= totalPages || data.length === 0) break;
      page += 1;
      if (page > 200) break;
    }
    return { ok: true, numbers: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сеть / Telnyx недоступен' };
  }
}

function extractDataObject(parsed: Record<string, unknown>): Record<string, unknown> {
  const data = parsed.data;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return parsed;
}

function mapTelnyxCallEvent(
  eventType: string,
  eventId: string,
  occurredAt: string,
  payload: Record<string, unknown>
): VoiceNormalizedWebhookEvent | null {
  const callControlId = String(payload.call_control_id ?? '').trim();
  if (!callControlId) return null;

  const from = payload.from != null ? String(payload.from).slice(0, 64) : null;
  const to = payload.to != null ? String(payload.to).slice(0, 64) : null;
  const direction = payload.direction != null ? String(payload.direction).slice(0, 32) : null;

  const baseMeta = (callStatus: string, extra: Record<string, unknown>): Record<string, unknown> => ({
    callStatus,
    from,
    to,
    direction,
    ...extra
  });

  const stableEvId = (suffix: string) =>
    eventId ? `telnyx:${eventId}` : `telnyx:${callControlId}:${suffix}`;

  if (
    eventType === 'call.initiated' ||
    eventType === 'call.enqueued' ||
    eventType === 'call.dequeued'
  ) {
    return null;
  }

  if (eventType === 'call.answered') {
    return {
      type: 'provider.answered',
      providerCallId: callControlId,
      occurredAt: occurredAt || new Date().toISOString(),
      cause: null,
      rawDigest: stableEvId('answered'),
      providerEventId: stableEvId('answered'),
      providerEventType: `telnyx.${eventType}`,
      providerMeta: baseMeta('in-progress', { raw: { state: payload.state } })
    };
  }

  if (eventType === 'call.hangup') {
    const cause = String(payload.hangup_cause ?? 'unspecified').trim();
    const sipRaw = payload.sip_hangup_cause;
    let sipResponseCode: number | null = null;
    if (typeof sipRaw === 'number' && Number.isFinite(sipRaw)) sipResponseCode = sipRaw;
    else if (typeof sipRaw === 'string' && /^\d{3}$/.test(sipRaw.trim())) sipResponseCode = parseInt(sipRaw.trim(), 10);

    const start = payload.start_time != null ? String(payload.start_time) : null;
    let durationSec: number | null = null;
    if (start && occurredAt) {
      const a = Date.parse(start);
      const b = Date.parse(occurredAt);
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        durationSec = Math.max(0, Math.floor((b - a) / 1000));
      }
    }

    const providerMeta = baseMeta(
      cause === 'user_busy'
        ? 'busy'
        : cause === 'no_answer' || cause === 'timeout'
          ? 'no-answer'
          : cause === 'normal_clearing'
            ? 'completed'
            : cause === 'originator_cancel' || cause === 'call_rejected'
              ? 'canceled'
              : 'failed',
      {
        hangupCause: cause,
        sipResponseCode,
        sipHangupCause: sipRaw != null ? String(sipRaw).slice(0, 64) : null,
        raw: { hangup_cause: cause, sip_hangup_cause: sipRaw }
      }
    );

    const base = {
      providerCallId: callControlId,
      occurredAt: occurredAt || new Date().toISOString(),
      providerEventId: stableEvId(`hangup:${cause}`),
      providerEventType: 'telnyx.call.hangup',
      rawDigest: `telnyx:hangup:${callControlId}:${cause}`,
      providerMeta
    };

    if (cause === 'user_busy') {
      return { ...base, type: 'provider.busy', cause: null };
    }
    if (cause === 'no_answer' || cause === 'timeout') {
      return { ...base, type: 'provider.no_answer', cause: null };
    }
    if (cause === 'originator_cancel' || cause === 'call_rejected') {
      return { ...base, type: 'user.cancel', cause: cause };
    }
    if (cause === 'normal_clearing') {
      return { ...base, type: 'provider.completed', durationSec, cause: null };
    }
    return { ...base, type: 'provider.failed', cause: cause || null };
  }

  if (eventType.startsWith('call.machine.') || eventType.startsWith('call.playback.')) {
    return null;
  }

  if (eventType === 'call.bridged') {
    return null;
  }

  return {
    type: 'provider.unknown',
    providerCallId: callControlId,
    occurredAt: occurredAt || new Date().toISOString(),
    cause: eventType,
    rawDigest: stableEvId('unknown'),
    providerEventId: stableEvId(`unknown:${eventType}`),
    providerEventType: `telnyx.${eventType}`,
    providerMeta: baseMeta(eventType, { raw: { event_type: eventType } })
  };
}

export class TelnyxVoiceProvider implements VoiceProviderAdapter {
  readonly providerId = PROVIDER_ID;

  private readonly config: VoiceProviderRuntimeConfig;

  constructor(config: VoiceProviderRuntimeConfig) {
    this.config = config;
  }

  getCapabilities(): VoiceProviderCapabilities {
    return {
      providerId: this.providerId,
      supportedCountries: [],
      localCallerIdSupported: true,
      readiness: 'experimental'
    };
  }

  async validateConfig(): Promise<VoiceProviderValidateConfigResult> {
    return { ok: true, details: { note: 'use probeTelnyxApiKey or company integration save flow' } };
  }

  async createOutboundCall(input: CreateOutboundVoiceCallInput): Promise<CreateOutboundVoiceCallResult> {
    const row = await getVoiceIntegration(input.companyId);
    if (!row?.telnyxEnabled || !row.telnyxApiKey?.trim()) {
      return {
        ok: false,
        error:
          'Telnyx не включён или не сохранён API Key компании. Настройте интеграцию Telnyx в CRM.',
        code: 'telnyx_company_config_incomplete',
        providerFailureCode: 'provider_auth_error',
        providerFailureReason: 'telnyx_not_configured'
      };
    }
    const apiKey = row.telnyxApiKey.trim();
    /** Call Control Application ID из Mission Control — в Firestore поле telnyxConnectionId (историческое имя). */
    const callControlApplicationId = normalizeTelnyxCallControlApplicationId(row.telnyxConnectionId ?? '');
    if (!callControlApplicationId) {
      return {
        ok: false,
        error:
          'Для исходящего звонка Telnyx нужен Connection / Application ID (Call Control). Укажите его в настройках Telnyx.',
        code: 'telnyx_connection_id_required',
        providerFailureCode: 'provider_connection_missing',
        providerFailureReason: 'missing_connection_id'
      };
    }

    const baseUrl = buildVoiceProviderWebhookUrl(this.config);
    if (!baseUrl.startsWith('http')) {
      return {
        ok: false,
        error:
          'Невозможно построить публичный webhook URL для Telnyx (задайте URL сайта / VOICE_PUBLIC_SITE_URL на Netlify).',
        code: 'telnyx_public_url',
        providerFailureCode: 'provider_api_error',
        providerFailureReason: 'missing_public_url'
      };
    }

    const webhookUrl = new URL(baseUrl);
    webhookUrl.searchParams.set('companyId', input.companyId);
    webhookUrl.searchParams.set('callId', input.callId);

    /**
     * Telnyx Dial (POST /v2/calls): в ответах часто фигурирует `application_id` (Call Control Application).
     * Передаём `application_id` + `connection_id` с одним и тем же ID из CRM — см. документацию Dial (connection_id = ID приложения).
     */
    const body = {
      application_id: callControlApplicationId,
      connection_id: callControlApplicationId,
      to: input.toE164,
      from: input.fromE164,
      webhook_url: webhookUrl.toString(),
      webhook_url_method: 'POST'
    };

    console.log(
      JSON.stringify({
        tag: 'voice.telnyx.create',
        phase: 'request',
        url: 'https://api.telnyx.com/v2/calls',
        companyId: input.companyId,
        callId: input.callId,
        body
      })
    );

    try {
      const res = await fetch('https://api.telnyx.com/v2/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(body)
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const errors = json.errors as Array<{ code?: string; title?: string; detail?: string }> | undefined;
        const first = errors?.[0];
        const msg =
          first?.detail || first?.title || JSON.stringify(json).slice(0, 400) || `HTTP ${res.status}`;
        const msgLower = msg.toLowerCase();
        const isCallControlIssue =
          (msgLower.includes('connection_id') ||
            msgLower.includes('connection id') ||
            msgLower.includes('application_id') ||
            msgLower.includes('application id')) &&
          (msgLower.includes('invalid') ||
            msgLower.includes('does not exist') ||
            msgLower.includes('not exist') ||
            msgLower.includes('not found'));
        const isWebhookUrlIssue =
          msgLower.includes('webhook') && (msgLower.includes('url') || msgLower.includes('valid'));
        const isClientSideTelnyx = res.status >= 400 && res.status < 500;
        const hint =
          isCallControlIssue || isWebhookUrlIssue
            ? 'В Telnyx Mission Control → Call Control Application: Webhook URL должен совпадать с блоком «Webhook URL для Call Control» в CRM (Интеграции) — тот же базовый URL, что использует сервер (обычно …/.netlify/functions/voice-provider-webhook). Затем вставьте ID именно этого приложения в поле Connection / Application ID в CRM.'
            : isClientSideTelnyx && res.status !== 401 && res.status !== 403
              ? 'Проверьте ключ API, Connection ID и в Netlify переменные URL / VOICE_PUBLIC_SITE_URL (должен быть https://ваш-домен).'
              : null;
        const friendlyCode =
          isCallControlIssue || isWebhookUrlIssue ? 'telnyx_invalid_call_control' : undefined;
        console.log(
          JSON.stringify({
            tag: 'voice.telnyx.create',
            phase: 'response',
            ok: false,
            status: res.status,
            message: msg
          })
        );
        return {
          ok: false,
          error: `Telnyx: ${msg}`,
          code: 'telnyx_api_error',
          friendlyCode,
          hint,
          providerFailureCode:
            res.status === 401 || res.status === 403
              ? 'provider_auth_error'
              : isCallControlIssue || isWebhookUrlIssue
                ? 'telnyx_invalid_call_control'
                : 'provider_api_error',
          providerFailureReason: msg,
          rawProviderMessage: msg,
          providerDebug: { status: res.status, body: json }
        };
      }
      const data = json.data as Record<string, unknown> | undefined;
      const callControlId = String(data?.call_control_id ?? '').trim();
      if (!callControlId) {
        return {
          ok: false,
          error: 'Telnyx: в ответе нет call_control_id',
          code: 'telnyx_api_error',
          providerFailureCode: 'provider_api_error',
          providerFailureReason: 'missing_call_control_id',
          providerDebug: { body: json }
        };
      }
      console.log(
        JSON.stringify({
          tag: 'voice.telnyx.create',
          phase: 'response',
          ok: true,
          companyId: input.companyId,
          callId: input.callId,
          callControlId
        })
      );
      return {
        ok: true,
        providerCallId: callControlId,
        raw: json as Record<string, unknown>,
        providerDebug: {
          telnyxCallControlId: callControlId,
          callControlApplicationId
        },
        initialNormalizedEvents: []
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Telnyx: ${msg}`,
        code: 'telnyx_api_error',
        providerFailureCode: 'provider_api_error',
        providerFailureReason: msg
      };
    }
  }

  async handleWebhook(input: VoiceWebhookParseInput): Promise<VoiceNormalizedWebhookEvent[]> {
    const companyId = String(input.queryParams.companyId ?? '').trim();
    if (!companyId) {
      throw new Error('Telnyx: в URL webhook должен быть query-параметр companyId');
    }
    const row = await getVoiceIntegration(companyId);
    const pub = row?.telnyxPublicKey?.trim() ?? '';
    if (!pub) {
      throw new Error('Telnyx: для компании не сохранён Public Key (проверка подписи невозможна)');
    }

    const skipSig = truthyEnv('TELNYX_SKIP_SIGNATURE_VALIDATION');
    if (!skipSig) {
      const v = verifyTelnyxWebhookSignature({
        publicKeyMaterial: pub,
        rawBody: input.rawBody,
        timestampHeader: headerCi(input.headers, 'telnyx-timestamp'),
        signatureHeaderB64: headerCi(input.headers, 'telnyx-signature-ed25519')
      });
      if (!v.ok) {
        throw new TelnyxWebhookSignatureError(v.reason);
      }
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      return [];
    }

    const data = extractDataObject(parsed);
    const eventType = String(data.event_type ?? '').trim();
    if (!eventType.startsWith('call.')) {
      return [];
    }

    const eventId = String(data.id ?? '').trim();
    const occurredAt =
      String(data.occurred_at ?? '').trim() && Number.isFinite(Date.parse(String(data.occurred_at)))
        ? new Date(Date.parse(String(data.occurred_at))).toISOString()
        : new Date().toISOString();

    const payload =
      (data.payload as Record<string, unknown>) ??
      (data.record as Record<string, unknown>) ??
      ({} as Record<string, unknown>);

    const ev = mapTelnyxCallEvent(eventType, eventId, occurredAt, payload);
    return ev ? [ev] : [];
  }
}
