import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  findClientByPhone,
  createClient,
  findConversationByClientId,
  createConversation,
  incrementUnreadCount,
  updateMessageStatus,
  normalizePhone,
  findCrmClientByPhone,
  createCrmClient,
  updateCrmClientLastMessageAt,
  findDealByClientPhone,
  createDeal,
  upsertMessageFromWebhook,
  type MessageAttachmentRow
} from './lib/firebaseAdmin';

/** Формат входящего сообщения Wazzup (по документации) */
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
  error?: { error?: string; description?: string };
  contact?: {
    name?: string;
    phone?: string;
    avatarUri?: string;
  };
}

/** Элемент webhook statuses — обновление статуса исходящего сообщения */
interface WazzupStatusItem {
  messageId?: string;
  timestamp?: string;
  status?: string;
  error?: { error?: string; description?: string };
}

interface WazzupWebhookBody {
  test?: boolean;
  messages?: WazzupMessage[];
  statuses?: WazzupStatusItem[];
}

function buildAttachmentsFromWazzup(type: string | undefined, contentUri: string | undefined): MessageAttachmentRow[] {
  if (!contentUri?.trim()) return [];
  const t = (type ?? 'file').toLowerCase();
  let attachmentType: MessageAttachmentRow['type'] = 'file';
  if (t === 'image') attachmentType = 'image';
  else if (t === 'video') attachmentType = 'video';
  else if (t === 'audio' || t === 'ptt' || t === 'voice') attachmentType = 'audio';
  else if (t === 'document') attachmentType = 'file';
  return [{ type: attachmentType, url: contentUri.trim() }];
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
  const debugPayload = process.env.WAZZUP_WEBHOOK_DEBUG === '1' || process.env.NODE_ENV !== 'production';
  if (debugPayload) {
    log('Raw webhook keys:', Object.keys(body));
    log('Received messages count:', messages.length);
    if (messages.length > 0) {
      log('First message sample:', JSON.stringify(messages[0], null, 2));
    }
  } else {
    log('Received messages count:', messages.length);
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    const chatType = msg.chatType ?? '';
    const status = (msg.status ?? '').toLowerCase();
    const isEcho = msg.isEcho === true;
    if (debugPayload) {
      log('Message item:', {
        messageId: msg.messageId,
        chatType,
        status,
        isEcho,
        chatId: msg.chatId,
        type: msg.type
      });
    }
    if (chatType !== 'whatsapp') {
      if (debugPayload) log('Skip non-whatsapp chatType:', chatType, 'messageId=', msg.messageId);
      skipped++;
      continue;
    }

    const direction: 'incoming' | 'outgoing' = isEcho ? 'outgoing' : 'incoming';

    const phone = msg.chatId ?? msg.contact?.phone ?? '';
    if (!phone) {
      log('Skip message without chatId:', msg.messageId);
      skipped++;
      continue;
    }

    const normalizedPhone = normalizePhone(phone);
    const attachments = buildAttachmentsFromWazzup(msg.type, msg.contentUri);
    const hasMedia = attachments.length > 0;
    const textContent = (msg.text ?? '').trim();
    const text = textContent || (hasMedia ? '' : '[no text]');
    const authorName = msg.contact?.name ?? '';

    try {
      if (debugPayload) {
        log('Process incoming:', { normalizedPhone, text: text.slice(0, 50), authorName });
      }

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
          errors++;
          continue;
        }
      }

      let conversation = await findConversationByClientId(client.id);
      if (!conversation) {
        const conversationId = await createConversation(client.id, normalizedPhone);
        log('Created conversation:', conversationId, 'clientId=', client.id);
        conversation = await findConversationByClientId(client.id);
        if (!conversation) {
          log('Failed to load created conversation');
          errors++;
          continue;
        }
      }

      if (direction === 'incoming') {
        const { id: savedId, created } = await upsertMessageFromWebhook(conversation.id, text, 'incoming', {
          providerMessageId: msg.messageId ?? undefined,
          attachments: attachments.length > 0 ? attachments : undefined
        });
        if (created) {
          await incrementUnreadCount(conversation.id);
        }
        processed++;
        if (debugPayload) {
          log(
            'Saved incoming message:',
            savedId,
            'conversationId=',
            conversation.id,
            hasMedia ? 'with attachment' : '',
            'created=',
            created
          );
        }
      } else {
        // Исходящее сообщение (isEcho === true): сохраняем как outgoing, но не трогаем unreadCount
        const { id: savedId, created } = await upsertMessageFromWebhook(conversation.id, text, 'outgoing', {
          providerMessageId: msg.messageId ?? undefined,
          attachments: attachments.length > 0 ? attachments : undefined
        });
        processed++;
        if (debugPayload) {
          log(
            'Saved outgoing message (webhook):',
            savedId,
            'conversationId=',
            conversation.id,
            hasMedia ? 'with attachment' : '',
            'created=',
            created
          );
        }
      }
    } catch (err) {
      log('Error processing message:', msg.messageId, err);
      errors++;
      // Не возвращаем 500 — обрабатываем остальные сообщения
    }
  }

  // Обработка statuses — обновление статусов исходящих сообщений (sent → delivered → read / error)
  const statuses = Array.isArray(body.statuses) ? body.statuses : [];
  let statusUpdates = 0;
  for (const st of statuses) {
    const providerId = st.messageId;
    if (!providerId) continue;
    const status = (st.status ?? '').toLowerCase();
    const isError = status === 'error';
    const mapped =
      status === 'sent'
        ? 'sent'
        : status === 'delivered'
          ? 'delivered'
          : status === 'read'
            ? 'read'
            : isError
              ? 'failed'
              : null;
    if (!mapped) continue;
    try {
      const errorMsg = isError && st.error ? (st.error.description ?? st.error.error) ?? null : null;
      const updated = await updateMessageStatus(providerId, mapped, errorMsg);
      if (updated) statusUpdates++;
      if (debugPayload && updated) log('Status updated:', providerId, mapped);
    } catch (e) {
      log('Error updating status:', providerId, e);
    }
  }
  if (statusUpdates > 0 || (debugPayload && statuses.length > 0)) {
    log('Statuses processed:', statusUpdates, 'of', statuses.length);
  }

  if (errors > 0 || (debugPayload && (processed > 0 || skipped > 0))) {
    log('Done: processed=', processed, 'skipped=', skipped, 'errors=', errors);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
