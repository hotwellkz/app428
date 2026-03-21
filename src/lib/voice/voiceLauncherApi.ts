import { getAuthToken } from '../firebase/auth';

export type VoiceLaunchMode = 'call_now' | 'callback' | 'test';
export type VoiceLaunchSource = 'deal' | 'chat' | 'bot_test' | 'client' | 'campaign';

export type VoiceLaunchContext = {
  source: VoiceLaunchSource;
  companyId: string;
  botId?: string | null;
  phone?: string | null;
  clientId?: string | null;
  dealId?: string | null;
  conversationId?: string | null;
  fromNumberId?: string | null;
  mode?: VoiceLaunchMode;
};

function fallbackVoicePath(path: string): string | null {
  if (!path.startsWith('/api/voice/')) return null;
  const tail = path.replace('/api/voice/', '').trim();
  if (!tail) return null;
  return `/.netlify/functions/voice-${tail}`;
}

/** Снэпшот Telnyx из GET voice-integration (вложенный или ?provider=telnyx). */
export type TelnyxVoiceIntegrationSnapshot = {
  provider?: string;
  /** Есть сохранённые ключи / начата настройка */
  configured?: boolean;
  enabled?: boolean;
  connectionStatus?: string;
  connectionError?: string | null;
  publicKeySet?: boolean;
  apiKeyMasked?: string | null;
  connectionId?: string | null;
  hasAnyNumbers?: boolean;
  hasDefaultOutbound?: boolean;
  voiceReady?: boolean;
  readinessMessages?: string[];
  blockingReason?: string | null;
  lastCheckedAt?: string | null;
  lastSyncedAt?: string | null;
  providerWebhookLastErrorCode?: string | null;
  providerWebhookLastErrorAt?: string | null;
  webhookSignatureOk?: boolean;
  /** Канонический webhook base URL сервера (совпадает с исходящим Telnyx POST /v2/calls). */
  outboundWebhookBaseUrl?: string | null;
};

/** Снэпшот Zadarma из GET voice-integration (вложенный объект zadarma). */
export type ZadarmaVoiceIntegrationSnapshot = {
  provider?: string;
  /** Есть key/secret/extension или начата настройка */
  configured?: boolean;
  enabled?: boolean;
  connectionStatus?: string;
  connectionError?: string | null;
  keyMasked?: string | null;
  secretMasked?: string | null;
  callbackExtension?: string | null;
  predicted?: boolean;
  hasAnyNumbers?: boolean;
  hasDefaultOutbound?: boolean;
  voiceReady?: boolean;
  readinessMessages?: string[];
  blockingReason?: string | null;
  lastCheckedAt?: string | null;
  lastSyncedAt?: string | null;
  providerWebhookLastErrorCode?: string | null;
  providerWebhookLastErrorAt?: string | null;
  webhookSignatureOk?: boolean;
  outboundWebhookUrlHint?: string | null;
  zdEchoNote?: string | null;
  apiKeySet?: boolean;
  apiSecretSet?: boolean;
  extensionSet?: boolean;
  webhookUrlHintReady?: boolean;
  defaultOutboundSelected?: boolean;
  lastWebhookReceivedAt?: string | null;
  lastWebhookEventType?: string | null;
  lastWebhookSignatureOk?: boolean | null;
  lastOutboundAttemptAt?: string | null;
  lastOutboundOk?: boolean | null;
  lastOutboundFriendlyCode?: string | null;
};

/** Ответ GET voice-integration (серверный контракт). */
export type VoiceIntegrationClientSnapshot = {
  provider?: string;
  configured?: boolean;
  enabled?: boolean;
  accountSidMasked?: string | null;
  /** Из Twilio API при последнем сохранении/проверке: Trial, Full и т.д. */
  twilioAccountType?: string | null;
  twilioAccountStatus?: string | null;
  connectionStatus?: string;
  connectionError?: string | null;
  lastCheckedAt?: string | null;
  hasDefaultOutbound?: boolean;
  defaultNumberId?: string | null;
  /** Готовность только Twilio (для карточки Twilio в Интеграциях). */
  voiceReady?: boolean;
  outboundVoiceProvider?: 'twilio' | 'telnyx' | 'zadarma';
  /** Вложенный снэпшот Telnyx (GET без ?provider). */
  telnyx?: TelnyxVoiceIntegrationSnapshot;
  zadarma?: ZadarmaVoiceIntegrationSnapshot;
  /** Готовность исходящих для выбранного outbound-провайдера. */
  activeOutboundVoiceReady?: boolean;
  error?: string;
};

function looksLikeVoiceIntegrationPayload(data: unknown): data is VoiceIntegrationClientSnapshot {
  if (data == null || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  if ('activeOutboundVoiceReady' in o) return true;
  if ('telnyx' in o && o.telnyx != null && typeof o.telnyx === 'object') return true;
  if ('zadarma' in o && o.zadarma != null && typeof o.zadarma === 'object') return true;
  return 'connectionStatus' in o || 'voiceReady' in o || ('configured' in o && 'enabled' in o);
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  const t = text.trim();
  if (!t) return null;
  // SPA fallback часто отдаёт 200 + text/html с index.html — не пытаемся парсить как JSON
  if (!ct.includes('application/json') && t.startsWith('<')) {
    throw new Error('non_json_html');
  }
  try {
    return JSON.parse(t) as unknown;
  } catch {
    throw new Error('invalid_json');
  }
}

/**
 * Загружает статус Voice integration так же надёжно, как страница Integrations:
 * сначала /.netlify/functions (обходит SPA-fallback на /api/* при 200+HTML),
 * затем /api/voice/* с fallback при 404.
 */
export async function fetchVoiceIntegrationStatus(): Promise<{
  ok: boolean;
  status: number;
  data: VoiceIntegrationClientSnapshot | null;
}> {
  const token = await getAuthToken();
  if (!token) throw new Error('Нет авторизации');

  const uniqueUrls = ['/.netlify/functions/voice-integration', '/api/voice/integration'];

  const reqInit: RequestInit = {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  };

  let lastStatus = 0;
  for (const url of uniqueUrls) {
    try {
      let res = await fetch(url, reqInit);
      lastStatus = res.status;
      if (res.status === 404 && url.startsWith('/api/voice/')) {
        const fb = fallbackVoicePath(url);
        if (fb) res = await fetch(fb, reqInit);
        lastStatus = res.status;
      }
      if (!res.ok) continue;
      const parsed = await parseJsonBody(res);
      if (looksLikeVoiceIntegrationPayload(parsed)) {
        return { ok: true, status: res.status, data: parsed };
      }
    } catch {
      continue;
    }
  }

  return { ok: false, status: lastStatus, data: null };
}

export async function voiceFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  if (!token) throw new Error('Нет авторизации');
  const reqInit: RequestInit = {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  };
  const primary = await fetch(path, { ...reqInit, cache: 'no-store' });
  if (primary.status !== 404) return primary;
  const fallback = fallbackVoicePath(path);
  if (!fallback || fallback === path) return primary;
  return fetch(fallback, { ...reqInit, cache: 'no-store' });
}

/** Тело ошибки POST outbound-call (серверный контракт). */
export type VoiceOutboundErrorPayload = {
  ok?: boolean;
  callId?: unknown;
  error?: unknown;
  code?: unknown;
  friendlyCode?: unknown;
  hint?: unknown;
  twilioCode?: unknown;
};

/** Ошибка запуска звонка с полями для UI (hint, friendlyCode). */
export class VoiceLaunchError extends Error {
  readonly launchCode?: string;
  readonly friendlyCode?: string;
  readonly hint?: string | null;
  readonly twilioCode?: number | null;
  /** Сессия могла быть создана до отказа Twilio */
  readonly failedCallId?: string | null;

  constructor(
    message: string,
    opts?: {
      launchCode?: string;
      friendlyCode?: string;
      hint?: string | null;
      twilioCode?: number | null;
      failedCallId?: string | null;
    }
  ) {
    super(message);
    this.name = 'VoiceLaunchError';
    this.launchCode = opts?.launchCode;
    this.friendlyCode = opts?.friendlyCode;
    this.hint = opts?.hint ?? null;
    this.twilioCode = opts?.twilioCode ?? null;
    this.failedCallId = opts?.failedCallId ?? null;
  }

  static fromPayload(data: VoiceOutboundErrorPayload): VoiceLaunchError {
    const msg = String(data.error ?? 'Не удалось запустить звонок');
    const tw = data.twilioCode;
    const twilioCode =
      typeof tw === 'number' && Number.isFinite(tw)
        ? tw
        : typeof tw === 'string' && /^\d+$/.test(tw.trim())
          ? parseInt(tw.trim(), 10)
          : null;
    const failedCallId =
      data.callId != null ? String(data.callId).trim() || null : null;
    return new VoiceLaunchError(msg, {
      launchCode: data.code != null ? String(data.code) : undefined,
      friendlyCode: data.friendlyCode != null ? String(data.friendlyCode) : undefined,
      hint: data.hint != null ? String(data.hint) : null,
      twilioCode,
      failedCallId
    });
  }
}

export async function launchVoiceCall(payload: {
  botId: string;
  linkedRunId: string;
  toE164: string;
  clientId?: string | null;
  contactId?: string | null;
  fromNumberId?: string | null;
  /** Явный исходящий провайдер (multi-provider). */
  outboundVoiceProvider?: 'twilio' | 'telnyx' | 'zadarma' | null;
  /** Алиас для outboundVoiceProvider */
  providerId?: 'twilio' | 'telnyx' | 'zadarma' | null;
  metadata?: Record<string, unknown>;
}): Promise<{ callId: string }> {
  const token = await getAuthToken();
  if (!token) throw new Error('Нет авторизации');
  const body = JSON.stringify(payload);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  };

  async function postOnce(url: string): Promise<Response> {
    let res = await fetch(url, { method: 'POST', body, headers, cache: 'no-store' });
    if (res.status === 404 && url.startsWith('/api/voice/')) {
      const fb = fallbackVoicePath(url);
      if (fb) res = await fetch(fb, { method: 'POST', body, headers, cache: 'no-store' });
    }
    return res;
  }

  /** Как integration: сначала прямой Netlify function (обходит отсутствие редиректа /api на части хостингов). */
  const urls = ['/.netlify/functions/voice-outbound-call', '/api/voice/outbound-call'];
  let lastMessage = 'Не удалось запустить звонок';

  for (const url of urls) {
    let res: Response;
    try {
      res = await postOnce(url);
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = await parseJsonBody(res);
    } catch {
      continue;
    }
    const data = (parsed && typeof parsed === 'object' ? parsed : {}) as VoiceOutboundErrorPayload;
    if (data.error != null) lastMessage = String(data.error);
    const callId = data.callId != null ? String(data.callId).trim() : '';
    const explicitFail = data.ok === false;

    if (!res.ok) {
      if (res.status === 404) continue;
      throw VoiceLaunchError.fromPayload({
        ok: false,
        error: data.error ?? lastMessage,
        code: data.code,
        friendlyCode: data.friendlyCode,
        hint: data.hint,
        twilioCode: data.twilioCode,
        callId: data.callId
      });
    }

    // HTTP 200, но провайдер отклонил вызов — не считаем успехом
    if (explicitFail) {
      throw VoiceLaunchError.fromPayload(data);
    }

    if (callId) {
      return { callId };
    }

    throw new VoiceLaunchError(lastMessage || 'Сервер вернул успех без идентификатора звонка');
  }

  throw new VoiceLaunchError(lastMessage);
}
