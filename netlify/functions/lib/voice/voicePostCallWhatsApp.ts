/**
 * Отдельный транспорт follow-up в WhatsApp после голосового звонка (Wazzup API).
 * Не трогает voice runtime; ошибки не роняют весь pipeline.
 */
import {
  findClientByPhone,
  findConversationByClientId,
  getWazzupApiKeyForCompany,
  normalizePhone
} from '../firebaseAdmin';

const WAZZUP_MESSAGE_URL = 'https://api.wazzup24.com/v3/message';

export type VoicePostCallFollowUpResult =
  | { ok: true; status: 'sent' }
  | { ok: true; status: 'skipped'; reason: string }
  | { ok: false; status: 'error'; message: string };

export async function sendVoicePostCallWhatsappFollowUp(params: {
  companyId: string;
  toE164: string;
  text: string;
}): Promise<VoicePostCallFollowUpResult> {
  const text = params.text.trim();
  if (!text) {
    return { ok: true, status: 'skipped', reason: 'empty_text' };
  }
  const normalizedPhone = normalizePhone(params.toE164);
  const client = await findClientByPhone(normalizedPhone, params.companyId);
  if (!client?.id) {
    return { ok: true, status: 'skipped', reason: 'no_client_for_phone' };
  }
  const conversation = await findConversationByClientId(client.id, params.companyId);
  if (!conversation) {
    return { ok: true, status: 'skipped', reason: 'no_whatsapp_conversation' };
  }
  const channelId = (conversation.wazzupChannelId ?? '').trim();
  if (!channelId) {
    return { ok: true, status: 'skipped', reason: 'missing_wazzup_channel' };
  }
  const apiKey = await getWazzupApiKeyForCompany(params.companyId);
  if (!apiKey?.trim()) {
    return { ok: true, status: 'skipped', reason: 'no_wazzup_api_key' };
  }
  const transport = (conversation.wazzupTransport ?? '').toLowerCase();
  const chatTypeWazzup = transport === 'instagram' ? 'instagram' : 'whatsapp';
  const chatIdWazzup =
    (conversation.wazzupChatId ?? '').trim() || normalizedPhone.replace(/^\+/, '');

  try {
    const res = await fetch(WAZZUP_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId,
        chatType: chatTypeWazzup,
        chatId: chatIdWazzup,
        text: text.slice(0, 4000)
      })
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, status: 'error', message: `Wazzup ${res.status}: ${t.slice(0, 300)}` };
    }
    return { ok: true, status: 'sent' };
  } catch (e) {
    return { ok: false, status: 'error', message: e instanceof Error ? e.message : 'send_failed' };
  }
}
