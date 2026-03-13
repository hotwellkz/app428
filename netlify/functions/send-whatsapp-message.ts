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
  DEFAULT_COMPANY_ID
} from './lib/firebaseAdmin';

const WAZZUP_MESSAGE_URL = 'https://api.wazzup24.com/v3/message';

const LOG_PREFIX = '[send-whatsapp-message]';

/** Преобразует литеральные \n в переносы строк для корректного отображения в WhatsApp. */
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
  /** instagram — отправка в поток Instagram (Wazzup). Нужен WAZZUP_INSTAGRAM_CHANNEL_ID или общий channelId с IG. */
  chatType?: 'whatsapp' | 'instagram';
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
  const channelIdWa = process.env.WAZZUP_CHANNEL_ID;
  const channelIdIg = process.env.WAZZUP_INSTAGRAM_CHANNEL_ID || channelIdWa;
  const channelId = channelIdWa;
  if (!apiKey || !channelIdWa) {
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

  const { chatId, chatType, text, contentUri, attachmentType, fileName, repliedToMessageId, forwarded, companyId } =
    body;
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
  if (effectiveCompanyId !== DEFAULT_COMPANY_ID) {
    log('Forbidden: WhatsApp not configured for companyId', effectiveCompanyId);
    return withCors({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'WhatsApp не настроен для этой компании' })
    });
  }
  const caption = hasText ? formatMessageForWhatsApp((text ?? '').trim()) : '';
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    log('Prepare send payload', {
      originalChatId: chatId,
      chatType: isInstagram ? 'instagram' : 'whatsapp',
      normalizedPhone,
      finalChatIdForWazzup: isInstagram ? chatId : normalizedPhone.replace(/^\+/, ''),
      hasMedia,
      hasText,
      captionLength: caption.length,
      attachmentType,
      hasRepliedTo: !!repliedToMessageId,
      forwarded: forwarded === true,
      companyId: effectiveCompanyId
    });
  }

  let conversationId: string;
  let clientId: string;
  try {
    let client = isInstagram
      ? await findClientByInstagramChatId(chatId)
      : await findClientByPhone(normalizedPhone);
    if (!client) {
      if (isInstagram) {
        const newClientId = await createInstagramClient(chatId, '');
        log('Created IG client:', newClientId);
        client = await findClientByInstagramChatId(chatId);
      } else {
        const newClientId = await createClient(normalizedPhone, '');
        log('Created client:', newClientId);
        client = await findClientByPhone(normalizedPhone);
      }
      if (!client) throw new Error('Failed to load created client');
    }
    clientId = client.id;

    let conversation = await findConversationByClientId(client.id);
    if (!conversation) {
      const newConvId = isInstagram
        ? await createConversation(client.id, chatId, { channel: 'instagram', displayPhone: '@Instagram' })
        : await createConversation(client.id, normalizedPhone);
      log('Created conversation:', newConvId);
      conversation = await findConversationByClientId(client.id);
      if (!conversation) throw new Error('Failed to load created conversation');
    }
    conversationId = conversation.id;
    if (isDev) {
      log('Resolved conversation for send', { clientId, conversationId });
    }
  } catch (err) {
    log('Firestore error:', err);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to resolve conversation', detail: String(err) })
    });
  }

  try {
    const wazzupChannel = isInstagram ? channelIdIg! : channelIdWa;
    const wazzupBody: Record<string, string> = {
      channelId: wazzupChannel,
      chatType: isInstagram ? 'instagram' : 'whatsapp',
      chatId: isInstagram ? chatId : normalizedPhone.replace(/^\+/, '')
    };
    if (hasMedia) {
      wazzupBody.contentUri = (contentUri as string).trim();
    } else {
      wazzupBody.text = caption;
    }
    if (isDev) {
      log('Wazzup request body (safe)', {
        channelId: wazzupBody.channelId,
        chatType: wazzupBody.chatType,
        chatId: wazzupBody.chatId,
        hasText: !!wazzupBody.text,
        hasContentUri: !!wazzupBody.contentUri
      });
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
      if (isDev) {
        log('Wazzup API error:', res.status, resText.slice(0, 500));
      } else {
        log('Wazzup API error:', res.status);
      }
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
      forwarded: forwarded === true,
      channel: isInstagram ? 'instagram' : 'whatsapp'
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
