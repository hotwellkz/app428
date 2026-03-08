import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue, type CollectionReference } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const COLLECTIONS = {
  CLIENTS: 'whatsappClients',
  CONVERSATIONS: 'whatsappConversations',
  MESSAGES: 'whatsappMessages',
  CRM_CLIENTS: 'clients',
  DEALS: 'deals'
} as const;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

/** Собрать JSON из одной переменной или из частей FIREBASE_SA_1, FIREBASE_SA_2, ... (для обхода лимита 4KB в Lambda) */
function getFirebaseServiceAccountJson(): string {
  const single = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (single) return single;
  const parts: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const p = process.env[`FIREBASE_SA_${i}`];
    if (p) parts.push(p);
  }
  if (parts.length === 0) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SA_1,2,... is not set');
  return parts.join('');
}

function getDb() {
  if (getApps().length === 0) {
    const json = getFirebaseServiceAccountJson();
    let credential: ServiceAccount;
    try {
      credential = JSON.parse(json) as ServiceAccount;
    } catch {
      throw new Error('Firebase service account JSON is invalid');
    }
    initializeApp({ credential: cert(credential) });
  }
  return getFirestore();
}

export interface WhatsAppClientRow {
  id: string;
  name: string;
  phone: string;
  createdAt: Timestamp;
}

export interface WhatsAppConversationRow {
  id: string;
  clientId: string;
  /** Номер для отображения/отправки, если клиент не загружен */
  phone?: string;
  status: string;
  createdAt: Timestamp;
  unreadCount?: number;
  lastMessageAt?: Timestamp;
}

export async function findClientByPhone(phone: string): Promise<WhatsAppClientRow | null> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const snap = await db.collection(COLLECTIONS.CLIENTS).where('phone', '==', normalized).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    name: (data.name as string) ?? '',
    phone: (data.phone as string) ?? normalized,
    createdAt: data.createdAt as Timestamp
  };
}

const DEFAULT_COMPANY_ID = 'hotwell';

export async function createClient(phone: string, name: string = ''): Promise<string> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const ref = await db.collection(COLLECTIONS.CLIENTS).add({
    name: name || normalized,
    phone: normalized,
    createdAt: Timestamp.now(),
    companyId: DEFAULT_COMPANY_ID
  });
  return ref.id;
}

export async function findConversationByClientId(clientId: string): Promise<WhatsAppConversationRow | null> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.CONVERSATIONS)
    .where('clientId', '==', clientId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId as string,
    phone: data.phone as string | undefined,
    status: data.status as string,
    createdAt: data.createdAt as Timestamp,
    unreadCount: (data.unreadCount as number) ?? 0,
    lastMessageAt: data.lastMessageAt as Timestamp | undefined
  };
}

export async function createConversation(clientId: string, phone: string): Promise<string> {
  const db = getDb();
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.CONVERSATIONS).add({
    clientId,
    phone: normalizePhone(phone),
    status: 'active',
    createdAt: now,
    lastMessageAt: now,
    unreadCount: 0,
    companyId: DEFAULT_COMPANY_ID
  });
  return ref.id;
}

/** Увеличить счётчик непрочитанных в диалоге (при входящем сообщении) */
export async function incrementUnreadCount(conversationId: string): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  await ref.update({ unreadCount: FieldValue.increment(1) });
}

export interface MessageAttachmentRow {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  thumbnailUrl?: string | null;
}

export interface SaveMessageOptions {
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  providerMessageId?: string | null;
  attachments?: MessageAttachmentRow[];
  errorMessage?: string | null;
}

export async function saveMessage(
  conversationId: string,
  text: string,
  direction: 'incoming' | 'outgoing',
  options: SaveMessageOptions = {}
): Promise<string> {
  const db = getDb();
  const now = Timestamp.now();
  const data: Record<string, unknown> = {
    conversationId,
    text,
    direction,
    createdAt: now,
    channel: 'whatsapp',
    companyId: DEFAULT_COMPANY_ID
  };
  if (options.status != null) data.status = options.status;
  if (options.providerMessageId != null) data.providerMessageId = options.providerMessageId;
  if (options.attachments != null && options.attachments.length > 0) {
    data.attachments = options.attachments;
  }
  if (options.errorMessage != null) data.errorMessage = options.errorMessage;
  const ref = await db.collection(COLLECTIONS.MESSAGES).add(data);
  const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  await convRef.update({ lastMessageAt: now });
  return ref.id;
}

/** Обновить статус сообщения по providerMessageId (из webhook statuses). */
export async function updateMessageStatus(
  providerMessageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  errorMessage?: string | null
): Promise<boolean> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.MESSAGES)
    .where('providerMessageId', '==', providerMessageId)
    .limit(1)
    .get();
  if (snap.empty) return false;
  const ref = snap.docs[0].ref;
  const update: Record<string, unknown> = {
    status,
    statusUpdatedAt: Timestamp.now()
  };
  if (status === 'failed' && errorMessage != null) update.errorMessage = errorMessage;
  await ref.update(update);
  return true;
}

// --- CRM: clients (по phone) и deals (по clientPhone) ---

export interface CrmClientRow {
  id: string;
  phone: string;
  name: string | null;
  source: string;
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
}

export async function findCrmClientByPhone(phone: string): Promise<CrmClientRow | null> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const snap = await db
    .collection(COLLECTIONS.CRM_CLIENTS)
    .where('companyId', '==', DEFAULT_COMPANY_ID)
    .where('phone', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    phone: (data.phone as string) ?? normalized,
    name: (data.name as string) ?? null,
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt as Timestamp,
    lastMessageAt: data.lastMessageAt as Timestamp
  };
}

export async function createCrmClient(phone: string): Promise<string> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.CRM_CLIENTS).add({
    phone: normalized,
    name: null,
    source: 'whatsapp',
    createdAt: now,
    lastMessageAt: now,
    companyId: DEFAULT_COMPANY_ID
  });
  return ref.id;
}

export async function updateCrmClientLastMessageAt(clientId: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.CRM_CLIENTS).doc(clientId).update({
    lastMessageAt: Timestamp.now()
  });
}

export type DealStatus = 'new' | 'in_progress' | 'closed' | 'lost';

export interface DealRow {
  id: string;
  clientPhone: string;
  status: DealStatus;
  source: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function findDealByClientPhone(phone: string): Promise<DealRow | null> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const snap = await db
    .collection(COLLECTIONS.DEALS)
    .where('companyId', '==', DEFAULT_COMPANY_ID)
    .where('clientPhone', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientPhone: (data.clientPhone as string) ?? normalized,
    status: (data.status as DealStatus) ?? 'new',
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp
  };
}

export async function createDeal(phone: string): Promise<string> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.DEALS).add({
    clientPhone: normalized,
    status: 'new',
    source: 'whatsapp',
    createdAt: now,
    updatedAt: now,
    companyId: DEFAULT_COMPANY_ID
  });
  return ref.id;
}

/** Получить роль пользователя из Firestore (users/{uid}). */
export async function getUserRole(uid: string): Promise<string | null> {
  const db = getDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return (snap.data()?.role as string) ?? null;
}

/** Инициализировать app и вернуть Auth (для verifyIdToken). */
function ensureApp() {
  if (getApps().length === 0) {
    const json = getFirebaseServiceAccountJson();
    let credential: ServiceAccount;
    try {
      credential = JSON.parse(json) as ServiceAccount;
    } catch {
      throw new Error('Firebase service account JSON is invalid');
    }
    initializeApp({ credential: cert(credential) });
  }
  return getAuth();
}

/** Проверить ID token и вернуть uid. */
export async function verifyIdToken(idToken: string): Promise<string> {
  const auth = ensureApp();
  const decoded = await auth.verifyIdToken(idToken);
  return decoded.uid;
}

/** Удалить все данные компании: company, company_users, clients, transactions, messages, deals. */
export async function deleteCompanyData(companyId: string): Promise<void> {
  const db = getDb();
  const BATCH_SIZE = 500;

  const deleteQueryBatch = async (ref: CollectionReference, field: string) => {
    const q = ref.where(field, '==', companyId).limit(BATCH_SIZE);
    const snap = await q.get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size === BATCH_SIZE) await deleteQueryBatch(ref, field);
  };

  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) throw new Error('Company not found');

  const companyUsersRef = db.collection('company_users');
  await deleteQueryBatch(companyUsersRef, 'companyId');

  const clientsRef = db.collection(COLLECTIONS.CRM_CLIENTS);
  await deleteQueryBatch(clientsRef, 'companyId');

  const transactionsRef = db.collection('transactions');
  await deleteQueryBatch(transactionsRef, 'companyId');

  const messagesRef = db.collection('messages');
  await deleteQueryBatch(messagesRef, 'companyId');

  const dealsRef = db.collection(COLLECTIONS.DEALS);
  await deleteQueryBatch(dealsRef, 'companyId');

  await companyRef.delete();
}

export { normalizePhone };
