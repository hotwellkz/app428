import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  writeBatch,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type DocumentData
} from 'firebase/firestore';
import { db } from './config';
import type {
  WhatsAppClient,
  WhatsAppConversation,
  WhatsAppMessage,
  MessageAttachment,
  MessageReaction
} from '../../types/whatsappDb';
import type { WhatsAppAiRuntime, WhatsAppAiRuntimeMode } from '../../types/whatsappAiRuntime';
import type { AiDealRecommendationSnapshot, AiDealCreatedFromRecommendationSnapshot } from '../../types/aiDealRecommendation';
import type {
  AiTaskCreatedFromRecommendationSnapshot,
  AiTaskRecommendationSnapshot
} from '../../types/aiTaskRecommendation';
import { parseWhatsAppAiRuntime } from '../../types/whatsappAiRuntime';
import { parseVoiceListPreviewFromText } from '../../components/whatsapp/whatsappUtils';

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
  /** Время последнего входящего сообщения (для derived state awaiting reply) */
  lastIncomingAt?: Date | Timestamp | null;
  /** Время последнего исходящего сообщения (для derived state awaiting reply) */
  lastOutgoingAt?: Date | Timestamp | null;
  /** Время последнего ручного сброса состояния «ждёт ответа» (one-shot dismiss). */
  awaitingReplyDismissedAt?: Date | Timestamp | null;
  unreadCount: number;
  /** Сделка (воронка): этап в списке чатов */
  dealId?: string | null;
  dealStageId?: string | null;
  dealStageName?: string | null;
  dealStageColor?: string | null;
  dealTitle?: string | null;
  dealResponsibleName?: string | null;
  /** Имя клиента из CRM, если контакт связан; иначе показывать phone */
  displayTitle?: string;
  /** Город клиента из CRM (для фильтра и отображения). */
  city?: string | null;
  channel?: 'whatsapp' | 'instagram';
  /** Kaspi-заказ, связанный с диалогом (если есть) */
  kaspiOrderNumber?: string | null;
  kaspiOrderAmount?: number | null;
  kaspiOrderStatus?: string | null;
  kaspiOrderCustomerName?: string | null;
  kaspiOrderAddress?: string | null;
  kaspiOrderUrl?: string | null;
  kaspiOrderItems?: Array<{ name: string; quantity: number }> | null;
  /** Runtime автоворонок в этом чате */
  aiRuntime?: WhatsAppAiRuntime;
  /** Тест: AI-бот включён для этого чата */
  aiBotEnabled?: boolean;
  /** Тест: разрешить боту отправлять КП */
  aiBotAutoProposalEnabled?: boolean;
}

export type ConversationAttentionState = 'unread' | 'need_reply' | 'normal';

/** Derived-state для визуального внимания: unread / need_reply / normal. */
export function getConversationAttentionState(item: ConversationListItem): ConversationAttentionState {
  const unread = item.unreadCount ?? 0;
  if (unread > 0) return 'unread';
  const lastIncoming = getMessageTimeFromDateLike(item.lastIncomingAt);
  if (!lastIncoming) return 'normal';
  const lastOutgoing = getMessageTimeFromDateLike(item.lastOutgoingAt);
  const lastDismissed = getMessageTimeFromDateLike(item.awaitingReplyDismissedAt ?? null);
  const baseline = Math.max(
    lastOutgoing ?? 0,
    lastDismissed ?? 0
  );
  const awaitingReply = baseline === 0 || baseline < lastIncoming;
  return awaitingReply ? 'need_reply' : 'normal';
}

function getMessageTimeFromDateLike(t: Date | Timestamp | null | undefined): number | null {
  if (!t) return null;
  if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
    return (t as { toMillis: () => number }).toMillis();
  }
  if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
    return ((t as { seconds: number }).seconds ?? 0) * 1000;
  }
  if (t instanceof Date) return t.getTime();
  return null;
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
    avatarUrl: (data.avatarUrl as string | null) ?? null,
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
    lastIncomingAt: (data.lastIncomingAt as WhatsAppConversation['lastIncomingAt']) ?? null,
    lastOutgoingAt: (data.lastOutgoingAt as WhatsAppConversation['lastOutgoingAt']) ?? null,
    lastClientMessageTime:
      (data.lastClientMessageTime as WhatsAppConversation['lastClientMessageTime']) ?? null,
    lastManagerMessageTime:
      (data.lastManagerMessageTime as WhatsAppConversation['lastManagerMessageTime']) ?? null,
    lastMessageSender: (data.lastMessageSender as WhatsAppConversation['lastMessageSender']) ?? null,
    unreadCount: (data.unreadCount as number) ?? 0,
    lastReadAt: data.lastReadAt as WhatsAppConversation['lastReadAt'],
    lastReadMessageId: (data.lastReadMessageId as string) ?? undefined,
    dealId: (data.dealId as string) ?? undefined,
    dealStageId: (data.dealStageId as string) ?? undefined,
    dealStageName: (data.dealStageName as string) ?? undefined,
    dealStageColor: (data.dealStageColor as string) ?? undefined,
    dealTitle: (data.dealTitle as string) ?? undefined,
    dealResponsibleName: (data.dealResponsibleName as string) ?? undefined,
    channel: (data.channel as WhatsAppConversation['channel']) ?? undefined,
    lastMessagePreview: (data.lastMessagePreview as string) ?? undefined,
    lastMessageMedia: data.lastMessageMedia === true,
    lastMessageMediaKind: (data.lastMessageMediaKind as WhatsAppConversation['lastMessageMediaKind']) ?? undefined,
    lastMessageAttachmentDurationSec:
      typeof data.lastMessageAttachmentDurationSec === 'number'
        ? data.lastMessageAttachmentDurationSec
        : data.lastMessageAttachmentDurationSec === null
          ? null
          : undefined,
    awaitingReplyDismissedAt:
      (data.awaitingReplyDismissedAt as WhatsAppConversation['awaitingReplyDismissedAt']) ?? null,
    aiRuntime: parseWhatsAppAiRuntime(data as Record<string, unknown>),
    aiBotEnabled: data.aiBotEnabled === true,
    aiBotAutoProposalEnabled: data.aiBotAutoProposalEnabled === true,
    aiBotLastMessageIdProcessed:
      (data.aiBotLastMessageIdProcessed as string | null | undefined) ?? null,
    aiBotLastProposalAt:
      (data.aiBotLastProposalAt as WhatsAppConversation['aiBotLastProposalAt']) ?? null,
    aiBotLeadContext:
      (data.aiBotLeadContext as WhatsAppConversation['aiBotLeadContext']) ?? null
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

function inferAttachmentType(
  stored: string,
  mime: string | undefined,
  url: string,
  fileName: string | undefined
): MessageAttachment['type'] {
  const t = ['image', 'video', 'audio', 'voice', 'file'].includes(stored) ? stored : 'file';
  const mimeL = (mime ?? '').toLowerCase();
  const path = url.split('?')[0].toLowerCase();
  const name = (fileName ?? '').toLowerCase();
  if (t === 'voice') return 'voice';
  if (t === 'video') return 'video';
  if (t === 'file' || t === 'image' || t === 'audio') {
    if (mimeL.startsWith('video/')) return 'video';
    if (/\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(path) || /\.(mp4|webm|mov|m4v)$/i.test(name)) {
      return 'video';
    }
    if (mimeL.startsWith('image/')) return 'image';
    if (mimeL.startsWith('audio/')) return 'audio';
  }
  return t as MessageAttachment['type'];
}

function dataToAttachments(arr: unknown): MessageAttachment[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const o = item as Record<string, unknown>;
    const typeRaw = (o.type as string) ?? 'file';
    const url = (o.url as string) ?? '';
    const mimeType = o.mimeType as string | undefined;
    const fileName = o.fileName as string | undefined;
    const type = inferAttachmentType(typeRaw, mimeType, url, fileName);
    const durRaw = o.durationSeconds;
    const durationSeconds =
      typeof durRaw === 'number' && Number.isFinite(durRaw) && durRaw >= 0 ? durRaw : undefined;
    return {
      type,
      url,
      mimeType,
      fileName,
      size: o.size as number | undefined,
      thumbnailUrl: (o.thumbnailUrl as string | null) ?? undefined,
      ...(durationSeconds !== undefined ? { durationSeconds } : {})
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
    transcription: (data.transcription as string | null) ?? null,
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
    reactions: reactions.length > 0 ? reactions : undefined,
    system: data.system === true
  };
}

/** Системное сообщение в чате (CRM), не уходит в WhatsApp. */
export async function saveSystemMessage(
  conversationId: string,
  text: string,
  companyId?: string | null
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
    conversationId,
    text,
    direction: 'outgoing',
    createdAt: serverTimestamp(),
    channel: 'whatsapp',
    system: true,
    status: 'sent',
    ...(companyId ? { companyId } : {})
  });
  return ref.id;
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
 * Разовый сброс состояния «ждёт ответа» для диалога.
 * Ставит awaitingReplyDismissedAt = serverTimestamp(), не отключая будущие срабатывания.
 */
export async function dismissAwaitingReply(conversationId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  await updateDoc(ref, {
    awaitingReplyDismissedAt: serverTimestamp()
  });
}

export interface AiBotFlagsUpdate {
  aiBotEnabled?: boolean;
  aiBotAutoProposalEnabled?: boolean;
}

/**
 * Обновить флаги AI-бота для диалога (тестовый режим).
 */
export async function updateConversationAiBotFlags(
  conversationId: string,
  flags: AiBotFlagsUpdate
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  const payload: Record<string, boolean> = {};
  if (typeof flags.aiBotEnabled === 'boolean') payload.aiBotEnabled = flags.aiBotEnabled;
  if (typeof flags.aiBotAutoProposalEnabled === 'boolean')
    payload.aiBotAutoProposalEnabled = flags.aiBotAutoProposalEnabled;
  if (Object.keys(payload).length === 0) return;
  await updateDoc(ref, payload);
}

/**
 * Записать ID последнего обработанного ботом сообщения (после успешной отправки ответа).
 */
export async function setConversationAiBotLastProcessedMessageId(
  conversationId: string,
  messageId: string
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  await updateDoc(ref, { aiBotLastMessageIdProcessed: messageId });
}

const AI_RT = 'aiRuntime' as const;

export interface WhatsAppAiRuntimePatch {
  enabled?: boolean;
  botId?: string | null;
  mode?: WhatsAppAiRuntimeMode;
  lastRunAt?: ReturnType<typeof serverTimestamp> | null;
  lastStatus?: WhatsAppAiRuntime['lastStatus'];
  lastReason?: string | null;
  lastGeneratedReply?: string | null;
  lastProcessedIncomingMessageId?: string | null;
  lastExtractionJson?: string | null;
  lastExtractionApplyStatus?: WhatsAppAiRuntime['lastExtractionApplyStatus'];
  lastExtractionApplyReason?: string | null;
  lastExtractionAppliedFields?: string[] | null;
  lastExtractionAppliedLabels?: string[] | null;
  lastExtractionAppliedFieldCount?: number | null;
  lastExtractionAppliedClientId?: string | null;
  lastExtractionAppliedAt?: string | null;
  dealRecommendation?: AiDealRecommendationSnapshot | null;
  dealFromAi?: AiDealCreatedFromRecommendationSnapshot | null;
  taskRecommendation?: AiTaskRecommendationSnapshot | null;
  taskFromAi?: AiTaskCreatedFromRecommendationSnapshot | null;
  lastTaskCreateStatus?: 'created' | 'duplicate' | 'error' | 'skipped' | null;
  lastTaskCreateReason?: string | null;
  lastTaskCreateAt?: string | null;
}

export interface UpdateWhatsAppConversationAiRuntimeOptions {
  /** Подставить верхний companyId при обновлении (нужно для старых диалогов без поля — иначе Firestore rules отклоняют update). */
  ensureCompanyId?: string | null;
}

/** Частичное обновление вложенного объекта aiRuntime (точечные поля Firestore). */
export async function updateWhatsAppConversationAiRuntime(
  conversationId: string,
  patch: WhatsAppAiRuntimePatch,
  options?: UpdateWhatsAppConversationAiRuntimeOptions
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  const payload: Record<string, unknown> = {};
  const cid = options?.ensureCompanyId;
  if (cid) payload.companyId = cid;
  if (patch.enabled !== undefined) payload[`${AI_RT}.enabled`] = patch.enabled;
  if (patch.botId !== undefined) payload[`${AI_RT}.botId`] = patch.botId;
  if (patch.mode !== undefined) payload[`${AI_RT}.mode`] = patch.mode;
  if (patch.lastRunAt !== undefined) payload[`${AI_RT}.lastRunAt`] = patch.lastRunAt;
  if (patch.lastStatus !== undefined) payload[`${AI_RT}.lastStatus`] = patch.lastStatus;
  if (patch.lastReason !== undefined) payload[`${AI_RT}.lastReason`] = patch.lastReason;
  if (patch.lastGeneratedReply !== undefined) payload[`${AI_RT}.lastGeneratedReply`] = patch.lastGeneratedReply;
  if (patch.lastProcessedIncomingMessageId !== undefined) {
    payload[`${AI_RT}.lastProcessedIncomingMessageId`] = patch.lastProcessedIncomingMessageId;
  }
  if (patch.lastExtractionJson !== undefined) payload[`${AI_RT}.lastExtractionJson`] = patch.lastExtractionJson;
  if (patch.lastExtractionApplyStatus !== undefined) {
    payload[`${AI_RT}.lastExtractionApplyStatus`] = patch.lastExtractionApplyStatus;
  }
  if (patch.lastExtractionApplyReason !== undefined) {
    payload[`${AI_RT}.lastExtractionApplyReason`] = patch.lastExtractionApplyReason;
  }
  if (patch.lastExtractionAppliedFields !== undefined) {
    payload[`${AI_RT}.lastExtractionAppliedFields`] = patch.lastExtractionAppliedFields;
  }
  if (patch.lastExtractionAppliedLabels !== undefined) {
    payload[`${AI_RT}.lastExtractionAppliedLabels`] = patch.lastExtractionAppliedLabels;
  }
  if (patch.lastExtractionAppliedFieldCount !== undefined) {
    payload[`${AI_RT}.lastExtractionAppliedFieldCount`] = patch.lastExtractionAppliedFieldCount;
  }
  if (patch.lastExtractionAppliedClientId !== undefined) {
    payload[`${AI_RT}.lastExtractionAppliedClientId`] = patch.lastExtractionAppliedClientId;
  }
  if (patch.lastExtractionAppliedAt !== undefined) {
    payload[`${AI_RT}.lastExtractionAppliedAt`] = patch.lastExtractionAppliedAt;
  }
  if (patch.dealRecommendation !== undefined) {
    payload[`${AI_RT}.dealRecommendation`] = patch.dealRecommendation;
  }
  if (patch.dealFromAi !== undefined) {
    payload[`${AI_RT}.dealFromAi`] = patch.dealFromAi;
  }
  if (patch.taskRecommendation !== undefined) {
    payload[`${AI_RT}.taskRecommendation`] = patch.taskRecommendation;
  }
  if (patch.taskFromAi !== undefined) {
    payload[`${AI_RT}.taskFromAi`] = patch.taskFromAi;
  }
  if (patch.lastTaskCreateStatus !== undefined) {
    payload[`${AI_RT}.lastTaskCreateStatus`] = patch.lastTaskCreateStatus;
  }
  if (patch.lastTaskCreateReason !== undefined) {
    payload[`${AI_RT}.lastTaskCreateReason`] = patch.lastTaskCreateReason;
  }
  if (patch.lastTaskCreateAt !== undefined) {
    payload[`${AI_RT}.lastTaskCreateAt`] = patch.lastTaskCreateAt;
  }
  if (Object.keys(payload).length === 0) return;
  await updateDoc(ref, payload);
}

export type DialogStage = 'city' | 'area' | 'floors' | 'roof' | 'calculation' | 'finish';

export interface AiBotLeadContext {
  city?: string | null;
  area_m2?: number | null;
  floors?: number | null;
  roofType?: string | null;
  stage?: DialogStage | null;
}

/**
 * Записать контекст лида AI-бота (город, площадь, этажность) в документе диалога.
 * Обычно передаётся уже объединённый контекст из ответа бота (extractedFacts).
 */
export async function setConversationAiBotLeadContext(
  conversationId: string,
  context: AiBotLeadContext
): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  await updateDoc(ref, { aiBotLeadContext: context });
}

/**
 * Ручной перевод диалога в состояние «есть непрочитанные».
 * Минимально: unreadCount >= 1, опционально сброс lastReadAt.
 */
export async function markConversationAsUnread(conversationId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Conversation not found');
  }
  const data = snap.data() as { unreadCount?: number };
  const current = data.unreadCount ?? 0;
  const next = current > 0 ? current : 1;
  await updateDoc(ref, {
    unreadCount: next
  });
}

/** Размер первой страницы и шаг пагинации (ленивая загрузка). */
/** Размер первой страницы (realtime). Чем больше — тем больше чатов «поднимаются» при новом сообщении без loadMore. */
export const CONVERSATIONS_PAGE_SIZE = 50;
/** При fallback (нет индекса по lastMessageAt) подписываемся на больше диалогов и сортируем по lastMessageAt на клиенте. */
const CONVERSATIONS_FALLBACK_PAGE_SIZE = 150;

function conversationToListItem(
  c: WhatsAppConversation,
  client: WhatsAppClient | null
): ConversationListItem {
  const phone = client?.phone ?? c.phone ?? c.clientId;
  const channel: ConversationListItem['channel'] =
    c.channel ?? (phone.startsWith('instagram:') ? 'instagram' : 'whatsapp');
  const createdAt = c.lastMessageAt ?? c.createdAt;
  const preview = (c.lastMessagePreview ?? '').trim();
  const hasMedia = c.lastMessageMedia === true;
  const mediaKind = c.lastMessageMediaKind ?? null;
  const mediaDur =
    typeof c.lastMessageAttachmentDurationSec === 'number' ? c.lastMessageAttachmentDurationSec : undefined;

  const previewAttachment = (): MessageAttachment | undefined => {
    if (!hasMedia) return undefined;
    if (mediaKind === 'voice') {
      return { type: 'voice' as const, url: '', ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {}) };
    }
    /** Текст превью уже «Голосовое сообщение…», но kind не записан (старые документы / частичные апдейты). */
    const voiceFromPreviewText = parseVoiceListPreviewFromText(preview);
    if (voiceFromPreviewText !== null) {
      const ds = mediaDur ?? voiceFromPreviewText.durationSeconds;
      return {
        type: 'voice' as const,
        url: '',
        ...(ds !== undefined ? { durationSeconds: ds } : {})
      };
    }
    if (mediaKind === 'image') return { type: 'image' as const, url: '' };
    if (mediaKind === 'video') {
      return { type: 'video' as const, url: '', ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {}) };
    }
    if (mediaKind === 'audio') {
      /**
       * Старые документы: Wazzup присылал голосовые как `audio` → в summary оставались preview "[медиа]" / пусто.
       * Не маппим все `audio` в voice (редкий шаринг трека), только типичный след голосового из webhook.
       */
      const p = preview.trim().toLowerCase();
      const treatAudioAsVoice = p === '[медиа]' || p === '[media]' || p === '[no text]';
      if (treatAudioAsVoice) {
        return { type: 'voice' as const, url: '', ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {}) };
      }
      return { type: 'audio' as const, url: '', ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {}) };
    }
    return { type: 'file' as const, url: '' };
  };

  const lastMessage: WhatsAppMessage | null =
    preview || hasMedia || c.lastMessageAt
      ? {
          id: `${c.id}:preview`,
          conversationId: c.id,
          text: hasMedia && !preview ? '' : preview || '',
          direction:
            c.lastMessageSender === 'manager' ? 'outgoing' : 'incoming',
          createdAt,
          channel: channel === 'instagram' ? 'instagram' : 'whatsapp',
          attachments: hasMedia ? [previewAttachment()!] : undefined
        }
      : null;
  return {
    id: c.id,
    clientId: c.clientId,
    phone,
    channel,
    client,
    lastMessage,
    lastMessageAt: c.lastMessageAt,
    lastIncomingAt: c.lastIncomingAt,
    lastOutgoingAt: c.lastOutgoingAt,
    awaitingReplyDismissedAt: c.awaitingReplyDismissedAt ?? null,
    unreadCount: c.unreadCount ?? 0,
    dealId: c.dealId ?? null,
    dealStageId: c.dealStageId ?? null,
    dealStageName: c.dealStageName ?? null,
    dealStageColor: c.dealStageColor ?? null,
    dealTitle: c.dealTitle ?? null,
    dealResponsibleName: c.dealResponsibleName ?? null,
    kaspiOrderNumber: (c as unknown as { kaspiOrderNumber?: string | null }).kaspiOrderNumber ?? null,
    kaspiOrderAmount: (c as unknown as { kaspiOrderAmount?: number | null }).kaspiOrderAmount ?? null,
    kaspiOrderStatus: (c as unknown as { kaspiOrderStatus?: string | null }).kaspiOrderStatus ?? null,
    kaspiOrderCustomerName:
      (c as unknown as { kaspiOrderCustomerName?: string | null }).kaspiOrderCustomerName ?? null,
    kaspiOrderAddress: (c as unknown as { kaspiOrderAddress?: string | null }).kaspiOrderAddress ?? null,
    kaspiOrderUrl: (c as unknown as { kaspiOrderUrl?: string | null }).kaspiOrderUrl ?? null,
    kaspiOrderItems:
      (c as unknown as { kaspiOrderItems?: Array<{ name: string; quantity: number }> | null }).kaspiOrderItems ??
      null,
    aiRuntime: c.aiRuntime,
    aiBotEnabled: c.aiBotEnabled === true,
    aiBotAutoProposalEnabled: c.aiBotAutoProposalEnabled === true
  };
}

function toMillis(v: ConversationListItem['lastMessageAt'] | ConversationListItem['lastIncomingAt']): number {
  if (!v) return 0;
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    return ((v as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(v as string).getTime();
}

/** Сортировка по последней активности: непрочитанные выше, затем по lastMessageAt (и lastIncomingAt) по убыванию. Экспорт для optimistic update после отправки. */
export function sortConversationItems(items: ConversationListItem[]): void {
  const getItemSortTime = (item: ConversationListItem): number => {
    if (item.lastMessage) return getMessageTime(item.lastMessage);
    const lastMsg = toMillis(item.lastMessageAt);
    const lastIn = toMillis(item.lastIncomingAt);
    return Math.max(lastMsg, lastIn);
  };
  items.sort((a, b) => {
    const unreadA = (a.unreadCount ?? 0) > 0 ? 1 : 0;
    const unreadB = (b.unreadCount ?? 0) > 0 ? 1 : 0;
    if (unreadB !== unreadA) return unreadB - unreadA;
    return getItemSortTime(b) - getItemSortTime(a);
  });
}

export interface SubscribeConversationsResult {
  unsubscribe: Unsubscribe;
  /** Подгрузить следующую порцию (после первой страницы). */
  loadMore: () => Promise<{ appended: number; hasMore: boolean }>;
  /** Есть ли ещё страницы (эвристика по размеру последней порции). */
  getHasMore: () => boolean;
}

/**
 * Первая страница — realtime (limit), без подписки на все сообщения.
 * Дальнейшие страницы — getDocs + startAfter.
 */
export function subscribeConversationsList(
  companyId: string,
  callback: (items: ConversationListItem[]) => void,
  onError?: (err: unknown) => void
): SubscribeConversationsResult {
  const clientsById = new Map<string, WhatsAppClient>();
  let firstPageConversations: WhatsAppConversation[] = [];
  let firstPageSnapDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  /** Документы последней загруженной порции (кроме первой) — цепочка курсоров */
  let loadMoreCursors: QueryDocumentSnapshot<DocumentData>[] = [];
  let extraItemsById = new Map<string, ConversationListItem>();
  let loadingMore = false;
  let hasMorePages = true;
  /** Первый onSnapshot ещё не пришёл — нельзя вызывать startAfter без курсора. */
  let firstSnapshotReady = false;

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

  function mergeAndEmit() {
    const page1Ids = new Set(firstPageConversations.map((c) => c.id));
    const merged: ConversationListItem[] = firstPageConversations.map((c) =>
      conversationToListItem(c, clientsById.get(c.clientId) ?? null)
    );
    for (const [, item] of extraItemsById) {
      if (!page1Ids.has(item.id)) merged.push(item);
    }
    sortConversationItems(merged);
    callback(merged);
  }

  /** Требуется индекс Firestore: companyId (==) + lastMessageAt (desc). Без него используется fallback (createdAt), тогда порядок по lastMessageAt — на клиенте. */
  const baseQuery = () =>
    query(
      collection(db, COLLECTIONS.CONVERSATIONS),
      where('companyId', '==', companyId),
      orderBy('lastMessageAt', 'desc'),
      limit(CONVERSATIONS_PAGE_SIZE)
    );

  const fallbackQuery = () =>
    query(
      collection(db, COLLECTIONS.CONVERSATIONS),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(CONVERSATIONS_FALLBACK_PAGE_SIZE)
    );

  let useFallback = false;
  let unsubFirst: Unsubscribe | null = null;

  const attachSnapshot = (q: ReturnType<typeof baseQuery>) => {
    unsubFirst = onSnapshot(
      q,
      async (convSnapshot) => {
        firstSnapshotReady = true;
        firstPageSnapDocs = convSnapshot.docs;
        firstPageConversations = convSnapshot.docs.map((d) =>
          docToConversation(d.id, d.data() as Record<string, unknown>)
        );
        const pageLimit = useFallback ? CONVERSATIONS_FALLBACK_PAGE_SIZE : CONVERSATIONS_PAGE_SIZE;
        hasMorePages = convSnapshot.docs.length >= pageLimit;
        const ids = [...new Set(firstPageConversations.map((c) => c.clientId))];
        await loadClients(ids);
        mergeAndEmit();
      },
      (err) => {
        const msg = String((err as Error)?.message ?? err);
        if (!useFallback && (msg.includes('index') || msg.includes('failed-precondition'))) {
          useFallback = true;
          if (unsubFirst) unsubFirst();
          attachSnapshot(fallbackQuery() as ReturnType<typeof baseQuery>);
          return;
        }
        onError?.(err);
      }
    );
  };

  attachSnapshot(baseQuery());

  const loadMore = async (): Promise<{ appended: number; hasMore: boolean }> => {
    if (loadingMore || !hasMorePages) return { appended: 0, hasMore: false };
    const lastCursor =
      loadMoreCursors.length > 0
        ? loadMoreCursors[loadMoreCursors.length - 1]
        : firstPageSnapDocs[firstPageSnapDocs.length - 1];
    /**
     * Гонка: loadMore вызвали до первого onSnapshot — курсора ещё нет.
     * Раньше возвращали hasMore: false → UI считал, что страниц больше нет, и скролл не догружал.
     */
    if (!lastCursor) {
      if (!firstSnapshotReady) {
        return { appended: 0, hasMore: true };
      }
      hasMorePages = false;
      return { appended: 0, hasMore: false };
    }
    loadingMore = true;
    try {
      const q = useFallback
        ? query(
            collection(db, COLLECTIONS.CONVERSATIONS),
            where('companyId', '==', companyId),
            orderBy('createdAt', 'desc'),
            startAfter(lastCursor),
            limit(CONVERSATIONS_PAGE_SIZE)
          )
        : query(
            collection(db, COLLECTIONS.CONVERSATIONS),
            where('companyId', '==', companyId),
            orderBy('lastMessageAt', 'desc'),
            startAfter(lastCursor),
            limit(CONVERSATIONS_PAGE_SIZE)
          );
      const snap = await getDocs(q);
      if (snap.empty) {
        hasMorePages = false;
        return { appended: 0, hasMore: false };
      }
      loadMoreCursors.push(snap.docs[snap.docs.length - 1]);
      hasMorePages = snap.docs.length >= CONVERSATIONS_PAGE_SIZE;
      const convs = snap.docs.map((d) =>
        docToConversation(d.id, d.data() as Record<string, unknown>)
      );
      await loadClients([...new Set(convs.map((c) => c.clientId))]);
      for (const c of convs) {
        extraItemsById.set(c.id, conversationToListItem(c, clientsById.get(c.clientId) ?? null));
      }
      mergeAndEmit();
      return { appended: snap.docs.length, hasMore: hasMorePages };
    } finally {
      loadingMore = false;
    }
  };

  return {
    unsubscribe: () => {
      unsubFirst?.();
    },
    loadMore,
    getHasMore: () => hasMorePages
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

const BATCH_SIZE = 500;

/**
 * Полное удаление клиента WhatsApp: все сообщения диалога, диалог, контакт.
 * Каскадное удаление. Логирует действие в admin_log (кто, когда, номер).
 */
export async function deleteClientWithConversation(
  conversationId: string,
  deletedBy: string
): Promise<void> {
  const convRef = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) {
    throw new Error('Conversation not found');
  }
  const convData = convSnap.data() as { clientId: string; companyId?: string; phone?: string };
  const clientId = convData.clientId;
  const companyId = convData.companyId ?? '';
  const phone = convData.phone ?? '';

  const messagesRef = collection(db, COLLECTIONS.MESSAGES);
  const messagesQuery = query(
    messagesRef,
    where('conversationId', '==', conversationId)
  );
  let snapshot = await getDocs(messagesQuery);
  while (!snapshot.empty) {
    const batch = writeBatch(db);
    const toDelete = snapshot.docs.slice(0, BATCH_SIZE);
    toDelete.forEach((d) => {
      batch.delete(doc(db, COLLECTIONS.MESSAGES, d.id));
    });
    await batch.commit();
    if (toDelete.length < BATCH_SIZE) break;
    snapshot = await getDocs(messagesQuery);
  }

  await deleteDoc(convRef);
  await deleteDoc(doc(db, COLLECTIONS.CLIENTS, clientId));

  const adminLogRef = collection(db, 'admin_log');
  await addDoc(adminLogRef, {
    action: 'whatsapp_client_deleted',
    conversationId,
    clientId,
    phone,
    companyId,
    deletedBy,
    deletedAt: serverTimestamp()
  });
}
