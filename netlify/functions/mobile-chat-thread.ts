import type { Handler } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, code: 'method_not_allowed' }) };
  }

  const managerId = String(event.queryStringParameters?.managerId ?? '').trim();
  const chatId = String(event.queryStringParameters?.chatId ?? '').trim();
  const beforeRaw = String(event.queryStringParameters?.before ?? '').trim();
  const before = beforeRaw ? Number.parseInt(beforeRaw, 10) : 0;
  const limitRaw = String(event.queryStringParameters?.limit ?? '').trim();
  const limit = Math.min(100, Math.max(1, limitRaw ? Number.parseInt(limitRaw, 10) || 50 : 50));

  if (!managerId || !chatId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ ok: false, code: 'invalid_request', message: 'managerId and chatId are required' })
    };
  }

  try {
    const db = getDb();
    const convSnap = await db.collection('whatsappConversations').doc(chatId).get();
    if (!convSnap.exists) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, code: 'chat_not_found' }) };
    }

    const conv = convSnap.data() as { clientId?: string; unreadCount?: number; status?: string; lastReadMessageId?: string | null };
    const clientId = String(conv.clientId ?? '').trim();
    if (!clientId) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, code: 'chat_not_found' }) };
    }

    const ownerSnap = await db
      .collection('whatsappClients')
      .where('companyId', '==', 'hotwell')
      .where('managerId', '==', managerId)
      .where('__name__', '==', clientId)
      .limit(1)
      .get();
    if (ownerSnap.empty) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, code: 'forbidden' }) };
    }

    let q = db
      .collection('whatsappMessages')
      .where('conversationId', '==', chatId)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (before > 0) {
      q = q.where('createdAt', '<', new Date(before));
    }

    const snap = await q.get();
    const rows = snap.docs.map((d) => {
      const x = d.data() as {
        text?: string;
        direction?: 'incoming' | 'outgoing';
        status?: string;
        createdAt?: { toMillis?: () => number };
        providerMessageId?: string;
        attachments?: unknown[];
        clientMessageId?: string;
      };
      const createdAt = x.createdAt?.toMillis?.() ?? 0;
      return {
        messageId: d.id,
        serverMessageId: x.providerMessageId ?? d.id,
        clientMessageId: String(x.clientMessageId ?? '').trim() || null,
        chatId,
        direction: x.direction ?? 'incoming',
        text: String(x.text ?? ''),
        status: x.status ?? 'sent',
        createdAt,
        attachments: Array.isArray(x.attachments) ? x.attachments : []
      };
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).reverse();
    const nextBefore = hasMore && rows[limit] ? rows[limit].createdAt : null;

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        contractVersion: '2026-03-android-chat-v1',
        chatId,
        items,
        hasMore,
        nextBefore,
        threadMeta: {
          status: String(conv.status ?? 'active'),
          unreadCount: Number(conv.unreadCount ?? 0),
          lastReadMessageId: (conv.lastReadMessageId as string | null | undefined) ?? null
        }
      })
    };
  } catch (e: unknown) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, code: 'internal_error', message: (e as { message?: string })?.message ?? 'failed' })
    };
  }
};
