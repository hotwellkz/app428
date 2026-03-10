import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';
import type {
  WhatsAppClient,
  WhatsAppConversation,
  WhatsAppMessage,
  MessageAttachment,
  MessageReaction
} from '../../types/whatsappDb';

export const COLLECTIONS = {
  CLIENTS: 'whatsappClients',
  CONVERSATIONS: 'whatsappConversations',
  MESSAGES: 'whatsappMessages'
} as const;

/** Элемент списка диалогов: диалог + клиент + последнее сообщение */
export interface ConversationListItem {
  id: string;
  clientId: string;
  /** Номер для отображения и отправки (из conversation.phone или client.phone) */
  phone: string;
  client: WhatsAppClient | null;
  lastMessage: WhatsAppMessage | null;
  lastMessageAt?: Date | Timestamp;
  unreadCount: number;
  /** Имя клиента из CRM, если контакт связан; иначе показывать phone */
  displayTitle?: string;
}

/** Нормализация номера для единообразного сравнения и поиска */
export function normalizePhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits ? `+${digits}` : (phone ?? '').trim();
}

function docToClient(docId: string, data: Record<string, unknown>): WhatsAppClient {
  return {
    id: docId,
    name: (data.name as string) ?? '',
    phone: (data.phone as string) ?? '',
    companyId: data.companyId as string | undefined,
    createdAt: data.createdAt as WhatsAppClient['createdAt']
  };
}

function docToConversation(docId: string, data: Record<string, unknown>): WhatsAppConversation {
  return {
    id: docId,
    companyId: (data.companyId as string) ?? undefined,
    clientId: (data.clientId as string) ?? '',
    phone: data.phone as string | undefined,
    status: (data.status as WhatsAppConversation['status']) ?? 'active',
    createdAt: data.createdAt as WhatsAppConversation['createdAt'],
    lastMessageAt: data.lastMessageAt as WhatsAppConversation['lastMessageAt'],
    unreadCount: (data.unreadCount as number) ?? 0,
    lastReadAt: data.lastReadAt as WhatsAppConversation['lastReadAt'],
    lastReadMessageId: (data.lastReadMessageId as string) ?? undefined
  };
}

function parseLegacyMediaAttachments(text: string): MessageAttachment[] {
  const m = text.match(/^\[media:\s*(https?:\/\/[^\s\]]+)\]\s*$/i);
  if (!m) return [];
  const url = m[1];
  const lower = url.toLowerCase();
  let type: MessageAttachment['type'] = 'file';
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(lower)) type = 'image';
  else if (/\.(mp4|webm|mov)(\?|$)/i.test(lower)) type = 'video';
  else if (/\.(mp3|ogg|m4a|wav|webm)(\?|$)/i.test(lower)) type = 'audio';
  return [{ type, url }];
}

function dataToAttachments(arr: unknown): MessageAttachment[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const o = item as Record<string, unknown>;
    const type = (o.type as string) ?? 'file';
    const url = (o.url as string) ?? '';
    return {
      type: (['image', 'video', 'audio', 'file'].includes(type) ? type : 'file') as MessageAttachment['type'],
      url,
      mimeType: o.mimeType as string | undefined,
      fileName: o.fileName as string | undefined,
      size: o.size as number | undefined,
      thumbnailUrl: (o.thumbnailUrl as string | null) ?? undefined
    };
  });
}

function dataToReactions(arr: unknown): MessageReaction[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      emoji: (o.emoji as string) ?? '👍',
      authorId: (o.authorId as string) ?? '',
      createdAt: o.createdAt as MessageReaction['createdAt']
    };
  }).filter((r) => r.emoji && r.authorId);
}

function docToMessage(docId: string, data: Record<string, unknown>): WhatsAppMessage {
  const rawText = (data.text as string) ?? '';
  let attachments = dataToAttachments(data.attachments);
  let text = rawText;
  if (attachments.length === 0 && /^\[media:\s*https?:\/\//i.test(rawText.trim())) {
    attachments = parseLegacyMediaAttachments(rawText.trim());
    if (attachments.length > 0) text = '';
  }
  const reactions = dataToReactions(data.reactions);
  return {
    id: docId,
    companyId: (data.companyId as string) ?? undefined,
    conversationId: (data.conversationId as string) ?? '',
    text,
    direction: (data.direction as WhatsAppMessage['direction']) ?? 'incoming',
    createdAt: data.createdAt as WhatsAppMessage['createdAt'],
    channel: (data.channel as WhatsAppMessage['channel']) ?? 'whatsapp',
    status: data.status as WhatsAppMessage['status'],
    statusUpdatedAt: data.statusUpdatedAt as WhatsAppMessage['statusUpdatedAt'],
    providerMessageId: (data.providerMessageId as string) ?? undefined,
    errorMessage: (data.errorMessage as string) ?? undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    repliedToMessageId: (data.repliedToMessageId as string) ?? undefined,
    forwarded: data.forwarded === true,
    deleted: data.deleted === true,
    deletedAt: data.deletedAt as WhatsAppMessage['deletedAt'],
    deletedBy: (data.deletedBy as string) ?? undefined,
    starred: data.starred === true,
    starredAt: data.starredAt as WhatsAppMessage['starredAt'],
    starredBy: (data.starredBy as string) ?? undefined,
    reactions: reactions.length > 0 ? reactions : undefined
  };
}

/**
 * Найти контакт по номеру телефона.
 * @returns документ контакта или null
 */
export async function findClientByPhone(phone: string): Promise<WhatsAppClient | null> {
  const normalized = normalizePhone(phone);
  const q = query(
    collection(db, COLLECTIONS.CLIENTS),
    where('phone', '==', normalized)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  const data = d.data();
  return {
    id: d.id,
    name: data.name ?? '',
    phone: data.phone ?? normalized,
    createdAt: data.createdAt ?? null
  } as WhatsAppClient;
}

/**
 * Создать контакт (клиента WhatsApp).
 * @param phone номер телефона
 * @param name имя (опционально)
 * @returns id созданного документа
 */
export async function createClient(phone: string, name: string = ''): Promise<string> {
  const normalized = normalizePhone(phone);
  const ref = await addDoc(collection(db, COLLECTIONS.CLIENTS), {
    name: name || normalized,
    phone: normalized,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Создать диалог с контактом.
 * @param clientId id из whatsappClients
 * @returns id созданной беседы
 */
export async function createConversation(clientId: string): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), {
    clientId,
    status: 'active',
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Сохранить сообщение в диалоге.
 * @param conversationId id из whatsappConversations
 * @param text текст сообщения
 * @param direction incoming | outgoing
 * @returns id созданного сообщения
 */
export async function saveMessage(
  conversationId: string,
  text: string,
  direction: 'incoming' | 'outgoing'
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
    conversationId,
    text,
    direction,
    createdAt: serverTimestamp(),
    channel: 'whatsapp'
  });
  return ref.id;
}


/**
 * Загрузить всех клиентов WhatsApp (для маппинга в списке диалогов).
 */
export async function getClients(): Promise<WhatsAppClient[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.CLIENTS));
  return snapshot.docs.map((d) => docToClient(d.id, d.data() as Record<string, unknown>));
}

function getMessageTime(m: WhatsAppMessage): number {
  const t = m.createdAt;
  if (!t) return 0;
  if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
    return (t as { toMillis: () => number }).toMillis();
  }
  if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
    return ((t as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(t as string).getTime();
}

const MARK_READ_API = '/.netlify/functions/mark-whatsapp-read';

/**
 * Пометить диалог как прочитанный в БД (через backend, чтобы запись гарантированно сохранялась).
 * После reload unread badge не вернётся — источник истины в документе conversation.
 */
export async function clearUnreadCount(
  conversationId: string,
  lastReadMessageId?: string | null,
  companyId?: string | null
): Promise<void> {
  const payload: { conversationId: string; lastReadMessageId?: string; companyId?: string } = {
    conversationId
  };
  if (lastReadMessageId) payload.lastReadMessageId = lastReadMessageId;
  if (companyId) payload.companyId = companyId;
  const res = await fetch(MARK_READ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string })?.error ?? `mark-read failed: ${res.status}`);
  }
}

/**
 * Подписка на список диалогов с данными клиента и последним сообщением (realtime).
 * @param onError опционально вызывается при ошибке (например, индекс ещё строится)
 * @returns функция отписки
 */
export function subscribeConversationsList(
  companyId: string,
  callback: (items: ConversationListItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const clientsById = new Map<string, WhatsAppClient>();
  let conversations: WhatsAppConversation[] = [];
  let messages: WhatsAppMessage[] = [];

  function mergeAndEmit() {
    const lastByConv = new Map<string, WhatsAppMessage>();
    for (const m of messages) {
      const mTime = getMessageTime(m);
      const cur = lastByConv.get(m.conversationId);
      if (!cur || mTime > getMessageTime(cur)) lastByConv.set(m.conversationId, m);
    }
    const items: ConversationListItem[] = conversations.map((c) => {
      const client = clientsById.get(c.clientId) ?? null;
      const lastMessage = lastByConv.get(c.id) ?? null;
      const phone = client?.phone ?? c.phone ?? c.clientId;
      return {
        id: c.id,
        clientId: c.clientId,
        phone,
        client,
        lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount ?? 0
      };
    });
    const getItemSortTime = (item: ConversationListItem): number => {
      if (item.lastMessage) return getMessageTime(item.lastMessage);
      const t = item.lastMessageAt;
      if (!t) return 0;
      if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
        return (t as { toMillis: () => number }).toMillis();
      }
      if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
        return ((t as { seconds: number }).seconds ?? 0) * 1000;
      }
      return new Date(t as string).getTime();
    };
    // Сначала непрочитанные, потом по lastMessageAt desc
    items.sort((a, b) => {
      const unreadA = (a.unreadCount ?? 0) > 0 ? 1 : 0;
      const unreadB = (b.unreadCount ?? 0) > 0 ? 1 : 0;
      if (unreadB !== unreadA) return unreadB - unreadA;
      return getItemSortTime(b) - getItemSortTime(a);
    });
    callback(items);
  }

  async function loadClients(clientIds: string[]) {
    const missing = clientIds.filter((id) => !clientsById.has(id));
    if (missing.length === 0) return;
    await Promise.all(
      missing.map(async (id) => {
        const d = await getDoc(doc(db, COLLECTIONS.CLIENTS, id));
        if (d.exists()) {
          clientsById.set(d.id, docToClient(d.id, d.data() as Record<string, unknown>));
        }
      })
    );
  }

  const conversationsQuery = query(
    collection(db, COLLECTIONS.CONVERSATIONS),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );

  const unsubConv = onSnapshot(
    conversationsQuery,
    async (convSnapshot) => {
      conversations = convSnapshot.docs.map((d) =>
        docToConversation(d.id, d.data() as Record<string, unknown>)
      );
      if (import.meta.env.DEV) {
        console.log('[WhatsApp] conversations snapshot:', conversations.length, 'items');
        conversations.forEach((c) => {
          console.log('[WhatsApp] conversation:', { id: c.id, unreadCount: c.unreadCount, lastReadAt: c.lastReadAt != null ? 'set' : 'null' });
        });
      }
      const ids = [...new Set(conversations.map((c) => c.clientId))];
      await loadClients(ids);
      mergeAndEmit();
    },
    (err) => onError?.(err)
  );

  const unsubMsg = onSnapshot(
    query(
      collection(db, COLLECTIONS.MESSAGES),
      orderBy('createdAt', 'asc')
    ),
    (msgSnapshot) => {
      messages = msgSnapshot.docs.map((d) =>
        docToMessage(d.id, d.data() as Record<string, unknown>)
      );
      mergeAndEmit();
    },
    (err) => onError?.(err)
  );

  return () => {
    unsubConv();
    unsubMsg();
  };
}

/**
 * Подписка на сообщения диалога (realtime), отсортированные по createdAt.
 * @param onError опционально вызывается при ошибке (например, индекс ещё строится)
 * @returns функция отписки
 */
export function subscribeMessages(
  conversationId: string,
  callback: (messages: WhatsAppMessage[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        docToMessage(d.id, d.data() as Record<string, unknown>)
      );
      callback(list);
    },
    (err) => onError?.(err)
  );
}

/** Мягкое удаление сообщения в CRM (только в UI/БД, не в WhatsApp). */
export async function softDeleteMessage(messageId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
  await updateDoc(ref, {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: null
  });
}

/** Переключить звёздочку сообщения в CRM. */
export async function toggleStarMessage(messageId: string, starred: boolean): Promise<void> {
  const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
  await updateDoc(ref, {
    starred,
    starredAt: serverTimestamp(),
    starredBy: null
  });
}

/** Добавить реакцию к сообщению (только в CRM). authorId — идентификатор пользователя CRM. */
export async function addReactionToMessage(
  messageId: string,
  emoji: string,
  authorId: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.MESSAGES, messageId);
  const reaction = {
    emoji: emoji || '👍',
    authorId,
    createdAt: new Date()
  };
  await updateDoc(ref, {
    reactions: arrayUnion(reaction)
  });
}
