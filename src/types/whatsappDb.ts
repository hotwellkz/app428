import { Timestamp } from 'firebase/firestore';
import type { WhatsAppAiRuntime } from './whatsappAiRuntime';

/**
 * Структура БД для хранения WhatsApp сообщений.
 * Коллекции: whatsappClients, whatsappConversations, whatsappMessages
 */

/** Контакт WhatsApp (участник переписки) */
export interface WhatsAppClient {
  id: string;
  name: string;
  phone: string;
  /** Аватар контакта (если есть, например из Wazzup/WhatsApp) */
  avatarUrl?: string | null;
  /** Владелец контакта (тенант) */
  companyId?: string;
  createdAt: Date | Timestamp;
}

/** Диалог с контактом */
export interface WhatsAppConversation {
  id: string;
  /** Владелец диалога (тенант) */
  companyId?: string;
  clientId: string;
  /** Номер для отображения/отправки, если клиент не загружен */
  phone?: string;
  status: 'active' | 'archived' | 'closed';
  createdAt: Date | Timestamp;
  /** Время последнего сообщения для сортировки */
  lastMessageAt?: Date | Timestamp;
  /** Время последнего входящего сообщения (для derived state awaiting reply) */
  lastIncomingAt?: Date | Timestamp | null;
  /** Время последнего исходящего сообщения (для derived state awaiting reply) */
  lastOutgoingAt?: Date | Timestamp | null;
  /** Время последнего сообщения клиента */
  lastClientMessageTime?: Date | Timestamp | null;
  /** Время последнего сообщения менеджера */
  lastManagerMessageTime?: Date | Timestamp | null;
  /** Кто отправил последнее сообщение: client | manager */
  lastMessageSender?: 'client' | 'manager' | null;
  /** Количество непрочитанных (входящих); источник истины в БД */
  unreadCount?: number;
  /** Время последнего «прочитано» (mark-as-read в БД) */
  lastReadAt?: Date | Timestamp;
  /** ID последнего прочитанного сообщения на момент mark-as-read */
  lastReadMessageId?: string | null;
  /** Связанная сделка (воронка CRM) */
  dealId?: string | null;
  dealStageId?: string | null;
  dealStageName?: string | null;
  dealStageColor?: string | null;
  dealTitle?: string | null;
  dealResponsibleName?: string | null;
  /** Канал диалога (Instagram — тот же список «Чаты») */
  channel?: 'whatsapp' | 'instagram';
  /** Превью последнего сообщения (денормализация для списка без загрузки всех сообщений) */
  lastMessagePreview?: string | null;
  lastMessageMedia?: boolean;
  /** Тип первого вложения последнего сообщения (для превью в списке чатов) */
  lastMessageMediaKind?: 'image' | 'video' | 'audio' | 'voice' | 'file' | null;
  /** Длительность первого вложения (сек), если есть (голосовое, аудио, видео) */
  lastMessageAttachmentDurationSec?: number | null;
  awaitingReplyDismissedAt?: Date | Timestamp | null;
  /** Runtime AI из модуля «Автоворонки» (WhatsApp) */
  aiRuntime?: WhatsAppAiRuntime;
  /** Тест: AI-бот отвечает в этом чате (per-conversation) */
  aiBotEnabled?: boolean;
  /** Тест: разрешить боту автоматически отправлять КП через калькулятор */
  aiBotAutoProposalEnabled?: boolean;
  /** ID последнего обработанного ботом входящего сообщения (защита от повтора) */
  aiBotLastMessageIdProcessed?: string | null;
  /** Время последней автоотправки КП ботом (защита от дублей) */
  aiBotLastProposalAt?: Date | Timestamp | null;
  /** Контекст лида для AI-бота: город, площадь, этажность, крыша, этап диалога (state machine) */
  aiBotLeadContext?: {
    city?: string | null;
    area_m2?: number | null;
    floors?: number | null;
    roofType?: string | null;
    stage?: 'city' | 'area' | 'floors' | 'roof' | 'calculation' | 'finish' | null;
  } | null;
  /** Метаданные заказа Kaspi, если диалог создан из Kaspi Shop */
  kaspiOrderNumber?: string | null;
  kaspiOrderAmount?: number | null;
  kaspiOrderStatus?: string | null;
  kaspiOrderCustomerName?: string | null;
  kaspiOrderAddress?: string | null;
  kaspiOrderUrl?: string | null;
  kaspiOrderItems?: Array<{ name: string; quantity: number }> | null;
}

/** Направление сообщения */
export type MessageDirection = 'incoming' | 'outgoing';

/** Канал (для расширения на другие мессенджеры) */
export type MessageChannel = 'whatsapp' | 'instagram';

/** Статус исходящего сообщения (по контракту Wazzup: sent, delivered, read, error) */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Вложение: медиа или файл */
export interface MessageAttachment {
  /** `voice` — голосовое сообщение (PTT / voice note), не обычный аудиофайл */
  type: 'image' | 'video' | 'audio' | 'voice' | 'file';
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  thumbnailUrl?: string | null;
  /** Длительность аудио/голосового в секундах (если известна) */
  durationSeconds?: number;
}

/** Реакция на сообщение (только в CRM) */
export interface MessageReaction {
  emoji: string;
  authorId: string;
  createdAt: Date | Timestamp;
}

/** Сообщение в диалоге */
export interface WhatsAppMessage {
  id: string;
  /** Владелец сообщения (тенант) */
  companyId?: string;
  conversationId: string;
  text: string;
  /** Расшифровка голосового/аудио сообщения (voice → text) */
  transcription?: string | null;
  direction: MessageDirection;
  createdAt: Date | Timestamp;
  channel: MessageChannel;
  /** Статус исходящего (pending → sent → delivered → read или failed) */
  status?: MessageStatus;
  statusUpdatedAt?: Date | Timestamp;
  /** ID сообщения у провайдера (Wazzup messageId) для обновления статусов */
  providerMessageId?: string | null;
  /** Текст ошибки при status === 'failed' */
  errorMessage?: string | null;
  /** Медиа-вложения (вместо сырого текста [media: url]) */
  attachments?: MessageAttachment[];
  /** Ответ на сообщение (ID сообщения в CRM) */
  repliedToMessageId?: string | null;
  /** Помечено как пересланное (только в CRM) */
  forwarded?: boolean;
  /** Удалено в CRM (soft delete) */
  deleted?: boolean;
  deletedAt?: Date | Timestamp;
  deletedBy?: string | null;
  /** В избранном в CRM */
  starred?: boolean;
  starredAt?: Date | Timestamp;
  starredBy?: string | null;
  /** Реакции (только в CRM) */
  reactions?: MessageReaction[];
  /** Системное сообщение CRM (смена этапа сделки и т.п.) */
  system?: boolean;
}
