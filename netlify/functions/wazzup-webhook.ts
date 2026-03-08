import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  findClientByPhone,
  createClient,
  findConversationByClientId,
  createConversation,
  saveMessage,
  incrementUnreadCount,
  normalizePhone,
  findCrmClientByPhone,
  createCrmClient,
  updateCrmClientLastMessageAt,
  findDealByClientPhone,
  createDeal
} from './lib/firebaseAdmin';

/** Формат входящего сообщения Wazzup (упрощённо) */
interface WazzupMessage {
  messageId?: string;
  channelId?: string;
  chatType?: string;
  chatId?: string;
  dateTime?: string;
  type?: string;
  status?: string;
  text?: string;
  contentUri?: string;
  isEcho?: boolean;
  contact?: {
    name?: string;
    phone?: string;
    avatarUri?: string;
  };
}

interface WazzupWebhookBody {
  test?: boolean;
  messages?: WazzupMessage[];
}

const LOG_PREFIX = '[wazzup-webhook]';

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    log('Rejected method:', event.httpMethod);
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body: WazzupWebhookBody = {};
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (body.test === true) {
    log('Wazzup webhook test received');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  log('Received messages count:', messages.length);
  if (messages.length > 0) {
    log('First message sample:', JSON.stringify(messages[0], null, 2));
  }

  for (const msg of messages) {
    const chatType = msg.chatType ?? '';
    const isIncoming = msg.isEcho === false || msg.status === 'inbound';
    if (chatType !== 'whatsapp' || !isIncoming) {
      log('Skip non-WA or outgoing message:', msg.messageId, 'chatType=', chatType, 'isEcho=', msg.isEcho, 'status=', msg.status);
      continue;
    }

    const phone = msg.chatId ?? msg.contact?.phone ?? '';
    if (!phone) {
      log('Skip message without chatId:', msg.messageId);
      continue;
    }

    const normalizedPhone = normalizePhone(phone);
    const text = (msg.text ?? '').trim() || (msg.contentUri ? `[media: ${msg.contentUri}]` : '[no text]');
    const authorName = msg.contact?.name ?? '';

    try {
      log('Process incoming:', { normalizedPhone, text: text.slice(0, 50), authorName });

      // CRM: клиент и сделка при первом сообщении
      let crmClient = await findCrmClientByPhone(normalizedPhone);
      if (!crmClient) {
        await createCrmClient(normalizedPhone);
        log('Created CRM client for phone=', normalizedPhone);
      } else {
        await updateCrmClientLastMessageAt(crmClient.id);
      }
      const deal = await findDealByClientPhone(normalizedPhone);
      if (!deal) {
        await createDeal(normalizedPhone);
        log('Created deal for phone=', normalizedPhone);
      }

      let client = await findClientByPhone(normalizedPhone);
      if (!client) {
        const clientId = await createClient(normalizedPhone, authorName);
        log('Created client:', clientId, 'phone=', normalizedPhone);
        client = await findClientByPhone(normalizedPhone);
        if (!client) {
          log('Failed to load created client:', clientId);
          continue;
        }
      } else {
        log('Found existing client:', client.id);
      }

      let conversation = await findConversationByClientId(client.id);
      if (!conversation) {
        const conversationId = await createConversation(client.id);
        log('Created conversation:', conversationId, 'clientId=', client.id);
        conversation = await findConversationByClientId(client.id);
        if (!conversation) {
          log('Failed to load created conversation');
          continue;
        }
      } else {
        log('Found existing conversation:', conversation.id);
      }

      const messageId = await saveMessage(conversation.id, text, 'incoming');
      await incrementUnreadCount(conversation.id);
      log('Saved message:', messageId, 'conversationId=', conversation.id);
    } catch (err) {
      log('Error processing message:', msg.messageId, err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Processing failed', detail: String(err) })
      };
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
