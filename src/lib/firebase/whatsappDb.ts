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
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';
import type { WhatsAppClient, WhatsAppConversation, WhatsAppMessage } from '../../types/whatsappDb';

export const COLLECTIONS = {
  CLIENTS: 'whatsappClients',
  CONVERSATIONS: 'whatsappConversations',
  MESSAGES: 'whatsappMessages'
} as const;

/** Элемент списка диалогов: диалог + клиент + последнее сообщение */
export interface ConversationListItem {
  id: string;
  clientId: string;
  client: WhatsAppClient | null;
  lastMessage: WhatsAppMessage | null;
  unreadCount: number;
}

function docToClient(docId: string, data: Record<string, unknown>): WhatsAppClient {
  return {
    id: docId,
    name: (data.name as string) ?? '',
    phone: (data.phone as string) ?? '',
    createdAt: data.createdAt as WhatsAppClient['createdAt']
  };
}

function docToConversation(docId: string, data: Record<string, unknown>): WhatsAppConversation {
  return {
    id: docId,
    clientId: (data.clientId as string) ?? '',
    status: (data.status as WhatsAppConversation['status']) ?? 'active',
    createdAt: data.createdAt as WhatsAppConversation['createdAt'],
    unreadCount: (data.unreadCount as number) ?? 0
  };
}

function docToMessage(docId: string, data: Record<string, unknown>): WhatsAppMessage {
  return {
    id: docId,
    conversationId: (data.conversationId as string) ?? '',
    text: (data.text as string) ?? '',
    direction: (data.direction as WhatsAppMessage['direction']) ?? 'incoming',
    createdAt: data.createdAt as WhatsAppMessage['createdAt'],
    channel: (data.channel as WhatsAppMessage['channel']) ?? 'whatsapp'
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

/** Нормализация номера для единообразного поиска (только цифры, опционально с +) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
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

/**
 * Сбросить счётчик непрочитанных при открытии чата.
 */
export async function clearUnreadCount(conversationId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  await updateDoc(ref, { unreadCount: 0 });
}

/**
 * Подписка на список диалогов с данными клиента и последним сообщением (realtime).
 * @param onError опционально вызывается при ошибке (например, индекс ещё строится)
 * @returns функция отписки
 */
export function subscribeConversationsList(
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
    const items: ConversationListItem[] = conversations.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      client: clientsById.get(c.clientId) ?? null,
      lastMessage: lastByConv.get(c.id) ?? null,
      unreadCount: c.unreadCount ?? 0
    }));
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

  const unsubConv = onSnapshot(
    query(
      collection(db, COLLECTIONS.CONVERSATIONS),
      orderBy('createdAt', 'desc')
    ),
    async (convSnapshot) => {
      conversations = convSnapshot.docs.map((d) =>
        docToConversation(d.id, d.data() as Record<string, unknown>)
      );
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
