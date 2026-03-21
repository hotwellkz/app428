import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  findClientByPhone,
  createClient,
  findClientByInstagramChatId,
  createInstagramClient,
  findConversationByClientId,
  createConversation,
  saveMessage,
  normalizePhone,
  DEFAULT_COMPANY_ID,
  getWazzupApiKeyForCompany
} from './lib/firebaseAdmin';

const WAZZUP_MESSAGE_URL = 'https://api.wazzup24.com/v3/message';

const LOG_PREFIX = '[send-whatsapp-message]';

function formatMessageForWhatsApp(message: string): string {
  if (typeof message !== 'string') return '';
  return message
    .replace(/\\n/g, '\n')
    .replace(/\n\n+/g, '\n\n')
    .trim();
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

interface SendMessageBody {
  chatId: string;
  chatType?: 'whatsapp' | 'instagram';
  text?: string;
  contentUri?: string;
  attachmentType?: 'image' | 'video' | 'file' | 'audio' | 'voice';
  fileName?: string;
  /** Длительность записи в секундах (голосовое) */
  durationSeconds?: number;
  repliedToMessageId?: string | null;
  forwarded?: boolean;
  companyId?: string;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({ statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) });
  }


  let body: SendMessageBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const {
    chatId,
    chatType,
    text,
    contentUri,
    attachmentType,
    fileName,
    durationSeconds,
    repliedToMessageId,
    forwarded,
    companyId
  } = body;
  const isInstagram = chatType === 'instagram';
  const hasMedia = typeof contentUri === 'string' && contentUri.trim().length > 0;
  const hasText = typeof text === 'string' && text.trim().length > 0;
  if (!chatId) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'chatId is required' })
    });
  }
  if (!hasMedia && !hasText) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'text or contentUri is required' })
    });
  }

  const normalizedPhone = isInstagram ? chatId : normalizePhone(chatId);
  const effectiveCompanyId = (companyId ?? DEFAULT_COMPANY_ID).trim();
  const apiKey = await getWazzupApiKeyForCompany(effectiveCompanyId);
  if (!apiKey?.trim()) {
    log('No Wazzup API key for company:', effectiveCompanyId);
    return withCors({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Подключите каналы WhatsApp в настройках интеграции (Настройки → Интеграции → Wazzup).'
      })
    });
  }
  const caption = hasText ? formatMessageForWhatsApp((text ?? '').trim()) : '';

  let conversationId: string;
  try {
    let client = isInstagram
      ? await findClientByInstagramChatId(chatId, effectiveCompanyId)
      : await findClientByPhone(normalizedPhone, effectiveCompanyId);
    if (!client) {
      if (isInstagram) {
        await createInstagramClient(chatId, '', undefined, effectiveCompanyId);
        client = await findClientByInstagramChatId(chatId, effectiveCompanyId);
      } else {
        await createClient(normalizedPhone, '', undefined, effectiveCompanyId);
        client = await findClientByPhone(normalizedPhone, effectiveCompanyId);
      }
      if (!client) throw new Error('Failed to load created client');
    }

    let conversation = await findConversationByClientId(client.id, effectiveCompanyId);
    if (!conversation) {
      const newConvId = isInstagram
        ? await createConversation(client.id, chatId, { channel: 'instagram', displayPhone: '@Instagram', companyId: effectiveCompanyId })
        : await createConversation(client.id, normalizedPhone, { companyId: effectiveCompanyId });
      log('Created conversation (no webhook yet):', newConvId);
      conversation = await findConversationByClientId(client.id, effectiveCompanyId);
      if (!conversation) throw new Error('Failed to load created conversation');
    }
    conversationId = conversation.id;

    const channelId = (conversation.wazzupChannelId ?? '').trim();
    if (!channelId) {
      log('No wazzupChannelId on conversation — need incoming webhook first', conversationId);
      return withCors({
        statusCode: 503,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error:
            'Канал Wazzup ещё не привязан: дождитесь входящего сообщения в этом чате (webhook сохранит channelId).',
          code: 'MISSING_WAZZUP_CHANNEL'
        })
      });
    }

    console.log('Wazzup channelId:', channelId);

    const transport = (conversation.wazzupTransport ?? '').toLowerCase();
    const chatTypeWazzup = transport === 'instagram' ? 'instagram' : 'whatsapp';
    const chatIdWazzup = (conversation.wazzupChatId ?? '').trim() || (isInstagram ? chatId : normalizedPhone.replace(/^\+/, ''));

    const wazzupBody: Record<string, string> = {
      channelId,
      chatType: chatTypeWazzup,
      chatId: chatIdWazzup
    };
    if (hasMedia) {
      wazzupBody.contentUri = (contentUri as string).trim();
    } else {
      wazzupBody.text = caption;
    }

    log('Wazzup send', { channelId, chatType: chatTypeWazzup, chatId: chatIdWazzup });

    const res = await fetch(WAZZUP_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(wazzupBody)
    });

    const resText = await res.text();
    let resData: unknown;
    try {
      resData = resText ? JSON.parse(resText) : {};
    } catch {
      resData = { raw: resText };
    }

    if (!res.ok) {
      log('Wazzup API error:', res.status);
      return withCors({
        statusCode: res.status >= 500 ? 502 : 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Wazzup API error',
          status: res.status,
          detail: resData
        })
      });
    }

    const providerMessageId =
      (resData as { messageId?: string }).messageId ?? (resData as { id?: string }).id ?? null;
    const msgText = hasText ? caption : '';
    const attachments = hasMedia
      ? [
          (() => {
            let type: 'image' | 'video' | 'audio' | 'voice' | 'file' = 'file';
            if (attachmentType === 'voice') type = 'voice';
            else if (attachmentType === 'image') type = 'image';
            else if (attachmentType === 'video') type = 'video';
            else if (attachmentType === 'audio') type = 'audio';
            const row: {
              type: typeof type;
              url: string;
              fileName?: string;
              durationSeconds?: number;
            } = {
              type,
              url: (contentUri as string).trim(),
              fileName: typeof fileName === 'string' ? fileName : undefined
            };
            if (
              typeof durationSeconds === 'number' &&
              Number.isFinite(durationSeconds) &&
              durationSeconds >= 0 &&
              (type === 'voice' || type === 'audio' || type === 'video')
            ) {
              row.durationSeconds = durationSeconds;
            }
            return row;
          })()
        ]
      : undefined;
    await saveMessage(conversationId, msgText, 'outgoing', {
      status: 'sent',
      providerMessageId: providerMessageId ?? undefined,
      attachments,
      repliedToMessageId: repliedToMessageId ?? undefined,
      forwarded: forwarded === true,
      channel: chatTypeWazzup === 'instagram' ? 'instagram' : 'whatsapp',
      companyId: effectiveCompanyId
    });
    log('Message sent', conversationId, providerMessageId ?? '');

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, conversationId, messageId: providerMessageId, response: resData })
    });
  } catch (err) {
    log('Error:', err);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Send failed', detail: String(err) })
    });
  }
};
