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

/** Ответ GET voice-integration (серверный контракт). */
export type VoiceIntegrationClientSnapshot = {
  provider?: string;
  configured?: boolean;
  enabled?: boolean;
  accountSidMasked?: string | null;
  connectionStatus?: string;
  connectionError?: string | null;
  lastCheckedAt?: string | null;
  hasDefaultOutbound?: boolean;
  defaultNumberId?: string | null;
  voiceReady?: boolean;
  error?: string;
};

function looksLikeVoiceIntegrationPayload(data: unknown): data is VoiceIntegrationClientSnapshot {
  if (data == null || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
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

export async function launchVoiceCall(payload: {
  botId: string;
  linkedRunId: string;
  toE164: string;
  clientId?: string | null;
  contactId?: string | null;
  fromNumberId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ callId: string }> {
  const res = await voiceFetch('/api/voice/outbound-call', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const data = (await res.json().catch(() => ({}))) as { callId?: string; error?: string };
  if (!res.ok || !data.callId) throw new Error(data.error ?? 'Не удалось запустить звонок');
  return { callId: data.callId };
}
