import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyIdToken, getDb } from './lib/firebaseAdmin';
import {
  FieldPath,
  type Timestamp,
  type Firestore,
  type QueryDocumentSnapshot
} from 'firebase-admin/firestore';

const CONVERSATIONS = 'whatsappConversations';
const CLIENTS = 'whatsappClients';
const COMPANY_USERS = 'company_users';

const BATCH = 500;
const MAX_MATCHES = 80;
const MAX_BATCHES = 50; // до ~25k чтений за запрос — верхняя граница по стоимости

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function json(status: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(body)
  };
}

function tsToIso(t: Timestamp | Date | undefined | null): string | null {
  if (!t) return null;
  try {
    if (typeof (t as Timestamp).toDate === 'function') return (t as Timestamp).toDate().toISOString();
    if (t instanceof Date) return t.toISOString();
  } catch {
    /* ignore */
  }
  return null;
}

async function loadClientsMap(
  db: Firestore,
  clientIds: string[]
): Promise<Map<string, { id: string; name: string; phone: string; avatarUrl: string | null }>> {
  const map = new Map<string, { id: string; name: string; phone: string; avatarUrl: string | null }>();
  const unique = [...new Set(clientIds)].filter(Boolean);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
  for (const chunk of chunks) {
    const refs = chunk.map((id) => db.collection(CLIENTS).doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data() as Record<string, unknown>;
      map.set(s.id, {
        id: s.id,
        name: (d.name as string) ?? '',
        phone: (d.phone as string) ?? '',
        avatarUrl: (d.avatarUrl as string | null) ?? null
      });
    }
  }
  return map;
}

function buildChatJson(
  id: string,
  data: Record<string, unknown>,
  client: { id: string; name: string; phone: string; avatarUrl: string | null } | undefined
): Record<string, unknown> {
  const phone = client?.phone || (data.phone as string) || '';
  const channel =
    (data.channel as string) || (phone.startsWith('instagram:') ? 'instagram' : 'whatsapp');
  const lastMessageAt = data.lastMessageAt as Timestamp | undefined;
  const createdAt = lastMessageAt || (data.createdAt as Timestamp);
  const preview = String(data.lastMessagePreview ?? '').trim();
  const hasMedia = data.lastMessageMedia === true;
  const mediaKind = (data.lastMessageMediaKind as string | undefined) ?? null;
  const mediaDur =
    typeof data.lastMessageAttachmentDurationSec === 'number' ? data.lastMessageAttachmentDurationSec : undefined;

  const previewAttachment = (): { type: string; url: string; durationSeconds?: number } => {
    if (mediaKind === 'voice') {
      return {
        type: 'voice',
        url: '',
        ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {})
      };
    }
    if (mediaKind === 'audio') {
      const p = preview.trim().toLowerCase();
      const legacyVoice = p === '[медиа]' || p === '[media]' || p === '[no text]';
      return {
        type: legacyVoice ? 'voice' : 'audio',
        url: '',
        ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {})
      };
    }
    if (mediaKind === 'image') return { type: 'image', url: '' };
    if (mediaKind === 'video') {
      return { type: 'video', url: '', ...(mediaDur !== undefined ? { durationSeconds: mediaDur } : {}) };
    }
    return { type: 'file', url: '' };
  };

  const lastMessage =
    preview || hasMedia || lastMessageAt
      ? {
          id: `${id}:preview`,
          conversationId: id,
          text: hasMedia && !preview ? '' : preview || '',
          direction: data.lastMessageSender === 'manager' ? 'outgoing' : 'incoming',
          createdAt: tsToIso(createdAt as Timestamp) || new Date().toISOString(),
          channel: channel === 'instagram' ? 'instagram' : 'whatsapp',
          attachments: hasMedia ? [previewAttachment()] : undefined
        }
      : null;

  return {
    id,
    clientId: (data.clientId as string) ?? '',
    phone,
    channel,
    client: client
      ? {
          id: client.id,
          name: client.name,
          phone: client.phone,
          avatarUrl: client.avatarUrl,
          createdAt: new Date().toISOString()
        }
      : null,
    lastMessage,
    lastMessageAt: tsToIso(lastMessageAt),
    lastIncomingAt: tsToIso(data.lastIncomingAt as Timestamp),
    lastOutgoingAt: tsToIso(data.lastOutgoingAt as Timestamp),
    awaitingReplyDismissedAt: tsToIso(data.awaitingReplyDismissedAt as Timestamp),
    unreadCount: (data.unreadCount as number) ?? 0,
    dealId: data.dealId ?? null,
    dealStageId: data.dealStageId ?? null,
    dealStageName: data.dealStageName ?? null,
    dealStageColor: data.dealStageColor ?? null,
    dealTitle: data.dealTitle ?? null,
    dealResponsibleName: data.dealResponsibleName ?? null
  };
}

async function runSearch(
  uid: string,
  rawQ: string,
  companyIdFromClient: string | undefined
): Promise<HandlerResponse> {
  if (rawQ.length < 1) {
    return json(200, { chats: [], total: 0 });
  }

  const db = getDb();
  const userSnap = await db.collection(COMPANY_USERS).doc(uid).get();
  if (!userSnap.exists) return json(403, { error: 'Forbidden' });
  const userData = userSnap.data() as { companyId?: string; menuAccess?: { whatsapp?: boolean } };
  const companyId = userData.companyId;
  if (!companyId) return json(403, { error: 'Forbidden' });
  if (userData.menuAccess?.whatsapp === false) return json(403, { error: 'Forbidden' });
  if (companyIdFromClient && companyIdFromClient !== companyId) {
    return json(403, { error: 'companyId mismatch' });
  }

  const qLower = rawQ.toLowerCase();
  const qDigits = rawQ.replace(/\D/g, '');
  const matches: Record<string, unknown>[] = [];
  let lastDoc: QueryDocumentSnapshot | null = null;
  let batches = 0;
  let scanned = 0;

  while (matches.length < MAX_MATCHES && batches < MAX_BATCHES) {
    let q = db
      .collection(CONVERSATIONS)
      .where('companyId', '==', companyId)
      .orderBy(FieldPath.documentId())
      .limit(BATCH);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    scanned += snap.docs.length;
    batches += 1;

    const clientIds = snap.docs.map((d) => (d.data().clientId as string) || '').filter(Boolean);
    const clientsMap = await loadClientsMap(db, clientIds);

    for (const doc of snap.docs) {
      if (matches.length >= MAX_MATCHES) break;
      const data = doc.data() as Record<string, unknown>;
      const clientId = (data.clientId as string) || '';
      const client = clientsMap.get(clientId);
      const phone = (client?.phone || (data.phone as string) || '').toLowerCase();
      const name = (client?.name || '').toLowerCase();
      const preview = String(data.lastMessagePreview ?? '').toLowerCase();
      const phoneDigits = (client?.phone || (data.phone as string) || '').replace(/\D/g, '');

      const textMatch = qLower.length >= 1 && (name.includes(qLower) || preview.includes(qLower) || phone.includes(qLower));
      const phoneMatch = qDigits.length >= 2 && phoneDigits.includes(qDigits);

      if (textMatch || phoneMatch) {
        matches.push(buildChatJson(doc.id, data, client));
      }
    }
  }

  return json(200, {
    chats: matches,
    total: matches.length,
    scanned,
    capped: matches.length >= MAX_MATCHES || batches >= MAX_BATCHES
  });
}

/**
 * POST /api/chats-search { query, companyId } — поиск по всей базе диалогов компании.
 */
export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
  if (!token) return json(401, { error: 'Authorization required' });

  let uid: string;
  try {
    uid = await verifyIdToken(token);
  } catch {
    return json(401, { error: 'Invalid token' });
  }

  let rawQ = (event.queryStringParameters?.q ?? '').trim();
  let companyIdBody: string | undefined;
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const b = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      const body = b as { q?: string; query?: string; companyId?: string };
      rawQ = String(body.query ?? body.q ?? '').trim();
      companyIdBody = typeof body.companyId === 'string' ? body.companyId.trim() : undefined;
    } catch {
      /* keep rawQ from query */
    }
  }
  return runSearch(uid, rawQ, companyIdBody);
};
