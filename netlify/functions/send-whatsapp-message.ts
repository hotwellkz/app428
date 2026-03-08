import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  findClientByPhone,
  createClient,
  findConversationByClientId,
  createConversation,
  saveMessage,
  normalizePhone
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
  text: string;
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

  const { chatId, text } = body;
  if (!chatId || typeof text !== 'string') {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'chatId and text are required' })
    });
  }

  const normalizedPhone = normalizePhone(chatId);
  log('Send to', normalizedPhone, 'text length:', text.length);

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
    const res = await fetch(WAZZUP_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId,
        chatType: 'whatsapp',
        chatId: normalizedPhone.replace(/^\+/, ''),
        text
      })
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
    await saveMessage(conversationId, text, 'outgoing', {
      status: 'sent',
      providerMessageId: providerMessageId ?? undefined
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
