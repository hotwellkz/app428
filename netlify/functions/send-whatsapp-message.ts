import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  findClientByPhone,
  createClient,
  findConversationByClientId,
  createConversation,
  saveMessage,
  normalizePhone,
  DEFAULT_COMPANY_ID
} from './lib/firebaseAdmin';

const WAZZUP_MESSAGE_URL = 'https://api.wazzup24.com/v3/message';

const LOG_PREFIX = '[send-whatsapp-message]';

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
  /** Текст (обязателен, если нет contentUri). При contentUri не передаётся в Wazzup, только сохраняется в БД как caption. */
  text?: string;
  /** Публичный URL файла для отправки как медиа. Взаимоисключающе с отправкой text в Wazzup. */
  contentUri?: string;
  /** Тип вложения для сохранения в БД: image | video | file | audio | voice */
  attachmentType?: 'image' | 'video' | 'file' | 'audio' | 'voice';
  /** Имя файла для отображения */
  fileName?: string;
  /** ID сообщения в CRM, на которое отвечаем (только в БД) */
  repliedToMessageId?: string | null;
  /** Пометить как пересланное в CRM */
  forwarded?: boolean;
  /** Текущий tenant в CRM (для валидации) */
  companyId?: string;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({ statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) });
  }

  const apiKey = process.env.WAZZUP_API_KEY;
  const channelId = process.env.WAZZUP_CHANNEL_ID;
  if (!apiKey || !channelId) {
    log('Missing env: WAZZUP_API_KEY or WAZZUP_CHANNEL_ID');
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' })
    });
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

  const { chatId, text, contentUri, attachmentType, fileName, repliedToMessageId, forwarded, companyId } = body;
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

  const normalizedPhone = normalizePhone(chatId);
  const effectiveCompanyId = (companyId ?? DEFAULT_COMPANY_ID).trim();
  if (effectiveCompanyId !== DEFAULT_COMPANY_ID) {
    log('Forbidden: WhatsApp not configured for companyId', effectiveCompanyId);
    return withCors({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'WhatsApp не настроен для этой компании' })
    });
  }
  const caption = hasText ? (text ?? '').trim() : '';
  log('Send to', normalizedPhone, hasMedia ? 'contentUri' : 'text', hasMedia ? contentUri?.slice(0, 60) + '...' : caption.length);

  let conversationId: string;
  try {
    let client = await findClientByPhone(normalizedPhone);
    if (!client) {
      const newClientId = await createClient(normalizedPhone, '');
      log('Created client:', newClientId);
      client = await findClientByPhone(normalizedPhone);
      if (!client) throw new Error('Failed to load created client');
    }

    let conversation = await findConversationByClientId(client.id);
    if (!conversation) {
      const newConvId = await createConversation(client.id, normalizedPhone);
      log('Created conversation:', newConvId);
      conversation = await findConversationByClientId(client.id);
      if (!conversation) throw new Error('Failed to load created conversation');
    }
    conversationId = conversation.id;
  } catch (err) {
    log('Firestore error:', err);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to resolve conversation', detail: String(err) })
    });
  }

  try {
    const wazzupBody: Record<string, string> = {
      channelId,
      chatType: 'whatsapp',
      chatId: normalizedPhone.replace(/^\+/, '')
    };
    if (hasMedia) {
      wazzupBody.contentUri = (contentUri as string).trim();
    } else {
      wazzupBody.text = caption;
    }

    const res = await fetch(WAZZUP_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      log('Wazzup API error:', res.status, resText);
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
    const msgText = hasMedia ? caption : (text ?? '').trim();
    const attachments = hasMedia
      ? [
          {
            type: (attachmentType === 'voice' ? 'audio' : attachmentType) || 'file' as 'image' | 'video' | 'audio' | 'file',
            url: (contentUri as string).trim(),
            fileName: typeof fileName === 'string' ? fileName : undefined
          }
        ]
      : undefined;
    await saveMessage(conversationId, msgText, 'outgoing', {
      status: 'sent',
      providerMessageId: providerMessageId ?? undefined,
      attachments,
      repliedToMessageId: repliedToMessageId ?? undefined,
      forwarded: forwarded === true
    });
    log('Message sent and saved, conversationId:', conversationId, providerMessageId ? 'providerId=' + providerMessageId : '');

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, conversationId, messageId: providerMessageId, response: resData })
    });
  } catch (err) {
    log('Request or save error:', err);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Send failed', detail: String(err) })
    });
  }
};
