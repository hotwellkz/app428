import { Timestamp } from 'firebase/firestore';

/**
 * Структура БД для хранения WhatsApp сообщений.
 * Коллекции: whatsappClients, whatsappConversations, whatsappMessages
 */

/** Контакт WhatsApp (участник переписки) */
export interface WhatsAppClient {
  id: string;
  name: string;
  phone: string;
  createdAt: Date | Timestamp;
}

/** Диалог с контактом */
export interface WhatsAppConversation {
  id: string;
  clientId: string;
  /** Номер для отображения/отправки, если клиент не загружен */
  phone?: string;
  status: 'active' | 'archived' | 'closed';
  createdAt: Date | Timestamp;
  /** Время последнего сообщения для сортировки */
  lastMessageAt?: Date | Timestamp;
  /** Количество непрочитанных (входящих) сообщений; сбрасывается при открытии чата */
  unreadCount?: number;
}

/** Направление сообщения */
export type MessageDirection = 'incoming' | 'outgoing';

/** Канал (для расширения на другие мессенджеры) */
export type MessageChannel = 'whatsapp';

/** Статус исходящего сообщения (по контракту Wazzup: sent, delivered, read, error) */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Вложение: медиа или файл */
export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  thumbnailUrl?: string | null;
}

/** Сообщение в диалоге */
export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  text: string;
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
}
