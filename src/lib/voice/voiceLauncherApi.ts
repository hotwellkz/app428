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
  const primary = await fetch(path, reqInit);
  if (primary.status !== 404) return primary;
  const fallback = fallbackVoicePath(path);
  if (!fallback || fallback === path) return primary;
  return fetch(fallback, reqInit);
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
