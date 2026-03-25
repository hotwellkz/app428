import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  findClientByPhone,
  createClient,
  findClientByInstagramChatId,
  createInstagramClient,
  updateClientAvatar,
  findConversationByClientId,
  createConversation,
  incrementUnreadCount,
  updateMessageStatus,
  normalizePhone,
  findCrmClientByPhone,
  createCrmClient,
  findCrmClientByExternalKey,
  createCrmClientInstagram,
  updateCrmClientLastMessageAt,
  findDealByClientPhone,
  createDeal,
  findDealByClientKey,
  createDealInstagram,
  instagramClientKey,
  upsertMessageFromWebhook,
  syncConversationWazzupRouting,
  getCompanyIdByWazzupChannelId,
  findSingleCompanyWithEmptyWazzupChannel,
  setWazzupIntegration,
  DEFAULT_COMPANY_ID,
  type MessageAttachmentRow
} from './lib/firebaseAdmin';
import { sendChatPushToManager } from './lib/mobilePushSender';

interface WazzupMessage {
  messageId?: string;
  channelId?: string;
  /** instagram | whatsapp — из webhook Wazzup */
  transport?: string;
  chatType?: string;
  chatId?: string;
  dateTime?: string;
  type?: string;
  /** Длительность медиа в секундах (если провайдер передаёт) */
  duration?: number;
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
  /** События CRM: chat_created, chat_updated (игнорируем тело, 200 OK) */
  event?: string;
}

function buildAttachmentsFromWazzup(
  type: string | undefined,
  contentUri: string | undefined,
  durationSec?: number
): MessageAttachmentRow[] {
  if (!contentUri?.trim()) return [];
  const t = (type ?? 'file').toLowerCase();
  let attachmentType: MessageAttachmentRow['type'] = 'file';
  if (t === 'image') attachmentType = 'image';
  else if (t === 'video') attachmentType = 'video';
  else if (t === 'ptt' || t === 'voice') attachmentType = 'voice';
  /**
   * Wazzup webhook ENUM: для WhatsApp отдельного типа «голосовое» нет — PTT приходит как `audio`
   * (см. документацию Wazzup: Message type — 'audio' — audio). Раньше мы сохраняли как `audio`
   * без mime/fileName → summary чата получал lastMessagePreview "[медиа]".
   * Голосовые в чате выглядели нормально (плеер для audio|voice), а список — нет.
   */
  else if (t === 'audio') attachmentType = 'voice';
  else if (t === 'document') attachmentType = 'file';
  const row: MessageAttachmentRow = { type: attachmentType, url: contentUri.trim() };
  if (typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec >= 0) {
    row.durationSeconds = durationSec;
  }
  return [row];
}

const LOG = '[wazzup-webhook]';
const IG_LOG = '[wazzup-instagram]';

function logIg(...args: unknown[]) {
  console.log(IG_LOG, new Date().toISOString(), ...args);
}

function log(...args: unknown[]) {
  console.log(LOG, ...args);
}

function isInstagramChatType(chatType: string): boolean {
  const t = chatType.toLowerCase();
  return t === 'instagram' || t === 'instagram_direct' || t === 'ig';
}

function wazzupTransportFromMessage(msg: WazzupMessage, instagram: boolean): string {
  const t = (msg.transport ?? '').toLowerCase().trim();
  if (t === 'instagram' || t === 'whatsapp') return t;
  return instagram ? 'instagram' : 'whatsapp';
}

async function handleInstagramMessage(msg: WazzupMessage, companyId: string, debugPayload: boolean): Promise<'ok' | 'skip' | 'err'> {
  const chatId = String(msg.chatId ?? '').trim();
  if (!chatId) {
    logIg('skip_no_chatId', msg.messageId);
    return 'skip';
  }
  const isEcho = msg.isEcho === true;
  const direction: 'incoming' | 'outgoing' = isEcho ? 'outgoing' : 'incoming';
  const username = (msg.contact?.name ?? '').trim() || `IG ${chatId.slice(0, 8)}`;
  const avatarUri = msg.contact?.avatarUri ?? undefined;
  const attachments = buildAttachmentsFromWazzup(msg.type, msg.contentUri, msg.duration);
  const textContent = (msg.text ?? '').trim();
  const text = textContent || (attachments.length ? '' : '[no text]');
  const extKey = instagramClientKey(chatId);

  try {
    logIg('incoming', { chatId, direction, username, messageId: msg.messageId, companyId });

    let crm = await findCrmClientByExternalKey(extKey, companyId);
    if (!crm) {
      await createCrmClientInstagram(chatId, username, companyId);
      logIg('crm_client_created', extKey);
    } else {
      await updateCrmClientLastMessageAt(crm.id);
    }

    let deal = await findDealByClientKey(extKey, companyId);
    if (!deal) {
      await createDealInstagram(chatId, companyId);
      logIg('deal_created', extKey);
    }

    let client = await findClientByInstagramChatId(chatId, companyId);
    if (!client) {
      const clientId = await createInstagramClient(chatId, username, avatarUri ?? null, companyId);
      logIg('wa_client_created', clientId);
      client = await findClientByInstagramChatId(chatId, companyId);
      if (!client) {
        logIg('error_load_client', clientId);
        return 'err';
      }
    } else if (avatarUri && !client.avatarUrl) {
      try {
        await updateClientAvatar(client.id, avatarUri);
      } catch (e) {
        logIg('avatar_update_fail', e);
      }
    }

    const channelId = String(msg.channelId ?? '').trim();
    const transport = wazzupTransportFromMessage(msg, true);
    const wazzupChatId = chatId;

    let conversation = await findConversationByClientId(client.id, companyId);
    if (!conversation) {
      const convId = await createConversation(client.id, chatId, {
        channel: 'instagram',
        displayPhone: `@${username}`,
        companyId,
        ...(channelId
          ? { wazzupChannelId: channelId, wazzupTransport: transport, wazzupChatId }
          : {})
      });
      logIg('conversation_created', convId);
      conversation = await findConversationByClientId(client.id, companyId);
      if (!conversation) return 'err';
    } else if (channelId) {
      try {
        await syncConversationWazzupRouting(conversation.id, {
          channelId,
          transport,
          chatId: wazzupChatId
        });
        logIg('wazzup_routing', { channelId, transport, chatId: wazzupChatId });
      } catch (e) {
        logIg('wazzup_routing_update_fail', e);
      }
    }

    const { id: savedId, created } = await upsertMessageFromWebhook(conversation.id, text, direction, {
      providerMessageId: msg.messageId ?? undefined,
      attachments: attachments.length ? attachments : undefined,
      channel: 'instagram',
      companyId
    });
    if (direction === 'incoming' && created) {
      await incrementUnreadCount(conversation.id);
    }
    logIg('message_saved', savedId, created, direction);
    return 'ok';
  } catch (e) {
    logIg('error', msg.messageId, e);
    return 'err';
  }
}

async function handleWhatsAppMessage(msg: WazzupMessage, companyId: string, debugPayload: boolean): Promise<'ok' | 'skip' | 'err'> {
  const phone = msg.chatId ?? msg.contact?.phone ?? '';
  if (!phone) return 'skip';
  const normalizedPhone = normalizePhone(phone);
  const isEcho = msg.isEcho === true;
  const direction: 'incoming' | 'outgoing' = isEcho ? 'outgoing' : 'incoming';
  const attachments = buildAttachmentsFromWazzup(msg.type, msg.contentUri, msg.duration);
  const textContent = (msg.text ?? '').trim();
  const text = textContent || (attachments.length ? '' : '[no text]');
  const authorName = msg.contact?.name ?? '';
  const avatarUri = msg.contact?.avatarUri ?? undefined;
  try {
    let crmClient = await findCrmClientByPhone(normalizedPhone, companyId);
    if (!crmClient) {
      await createCrmClient(normalizedPhone, companyId);
    } else {
      await updateCrmClientLastMessageAt(crmClient.id);
    }
    const deal = await findDealByClientPhone(normalizedPhone, companyId);
    if (!deal) await createDeal(normalizedPhone, companyId);

    let client = await findClientByPhone(normalizedPhone, companyId);
    if (!client) {
      await createClient(normalizedPhone, authorName, avatarUri ?? null, companyId);
      client = await findClientByPhone(normalizedPhone, companyId);
      if (!client) return 'err';
    } else if (avatarUri && !client.avatarUrl) {
      try {
        await updateClientAvatar(client.id, avatarUri);
      } catch {
        /* ignore */
      }
    }
    const channelId = String(msg.channelId ?? '').trim();
    const transport = wazzupTransportFromMessage(msg, false);
    const wazzupChatId = String(msg.chatId ?? normalizedPhone).trim();

    let conversation = await findConversationByClientId(client.id, companyId);
    if (!conversation) {
      await createConversation(client.id, normalizedPhone, {
        channel: 'whatsapp',
        companyId,
        ...(channelId
          ? { wazzupChannelId: channelId, wazzupTransport: transport, wazzupChatId }
          : {})
      });
      conversation = await findConversationByClientId(client.id, companyId);
      if (!conversation) return 'err';
    } else if (channelId) {
      try {
        await syncConversationWazzupRouting(conversation.id, {
          channelId,
          transport,
          chatId: wazzupChatId
        });
        log('wazzup_routing', { channelId, transport, chatId: wazzupChatId });
      } catch {
        /* ignore */
      }
    }
    const { created } = await upsertMessageFromWebhook(conversation.id, text, direction, {
      providerMessageId: msg.messageId ?? undefined,
      attachments: attachments.length ? attachments : undefined,
      channel: 'whatsapp',
      companyId
    });
    if (direction === 'incoming' && created) {
      await incrementUnreadCount(conversation.id);
      // Push: минимальная интеграция "новое входящее сообщение" → уведомление на мобильные устройства менеджера (companyId).
      // Dedupe делается по messageId на уровне mobilePushSender.
      try {
        const targetUrl = `https://2wix.ru/whatsapp?chatId=${encodeURIComponent(conversation.id)}`;
        await sendChatPushToManager({
          managerId: companyId,
          chatId: conversation.id,
          phone: normalizedPhone,
          clientName: (client.name || '').trim() || undefined,
          preview: (textContent || '').trim() || (attachments.length ? '[медиа]' : undefined),
          // Для Android badge/dot лучше передавать хотя бы 1.
          unreadCount: 1,
          targetUrl,
          messageId: msg.messageId ?? undefined,
          type: 'message'
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[wazzup-webhook] push_send_fail', e);
      }
    }
    return 'ok';
  } catch {
    return 'err';
  }
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
    logIg('webhook_json_error', String(e));
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

  /* Подписка на chat_created / chat_updated — отвечаем 200 без обработки тела */
  if (body.event && !Array.isArray(body.messages)) {
    log('Wazzup event (ack):', body.event);
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
    if (messages.length > 0) log('First message sample:', JSON.stringify(messages[0], null, 2));
  } else {
    log('Received messages count:', messages.length);
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    const chatType = msg.chatType ?? '';
    const channelId = String(msg.channelId ?? '').trim();
    let companyId: string = channelId ? (await getCompanyIdByWazzupChannelId(channelId)) ?? DEFAULT_COMPANY_ID : DEFAULT_COMPANY_ID;
    if (channelId && companyId === DEFAULT_COMPANY_ID) {
      const transport = isInstagramChatType(chatType) ? 'instagram' : 'whatsapp';
      const single = await findSingleCompanyWithEmptyWazzupChannel(transport);
      if (single) {
        try {
          if (transport === 'whatsapp') {
            await setWazzupIntegration(single.companyId, {
              apiKey: single.integration.apiKey,
              whatsappChannelId: channelId,
              instagramChannelId: single.integration.instagramChannelId
            });
          } else {
            await setWazzupIntegration(single.companyId, {
              apiKey: single.integration.apiKey,
              whatsappChannelId: single.integration.whatsappChannelId,
              instagramChannelId: channelId
            });
          }
          companyId = single.companyId;
          log('wazzup_channel_auto_linked', { channelId, companyId, transport });
        } catch (e) {
          log('wazzup_channel_auto_link_fail', channelId, e);
        }
      }
    }
    if (debugPayload) {
      log('Message item:', {
        messageId: msg.messageId,
        chatType,
        chatId: msg.chatId,
        channelId,
        companyId,
        isEcho: msg.isEcho
      });
    }

    if (isInstagramChatType(chatType)) {
      const r = await handleInstagramMessage(msg, companyId, debugPayload);
      if (r === 'ok') processed++;
      else if (r === 'skip') skipped++;
      else errors++;
      continue;
    }

    if (chatType !== 'whatsapp') {
      if (debugPayload) log('Skip chatType:', chatType);
      skipped++;
      continue;
    }

    const r = await handleWhatsAppMessage(msg, companyId, debugPayload);
    if (r === 'ok') processed++;
    else if (r === 'skip') skipped++;
    else errors++;
  }

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
    } catch (e) {
      log('Error updating status:', providerId, e);
    }
  }

  log('Done: processed=', processed, 'skipped=', skipped, 'errors=', errors);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
