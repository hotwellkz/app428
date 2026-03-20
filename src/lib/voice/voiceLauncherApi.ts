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

export async function voiceFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  if (!token) throw new Error('Нет авторизации');
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
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
