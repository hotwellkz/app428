import type { Handler } from '@netlify/functions';
import { getDb, markConversationAsRead } from './lib/firebaseAdmin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, code: 'method_not_allowed' }) };
  }

  let body: {
    managerId?: string;
    chatId?: string;
    lastReadMessageId?: string;
  };
  try {
    body = JSON.parse(event.body || '{}') as typeof body;
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'invalid_json' }) };
  }

  const managerId = String(body.managerId ?? '').trim();
  const chatId = String(body.chatId ?? '').trim();
  const lastReadMessageId = String(body.lastReadMessageId ?? '').trim() || null;

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
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ ok: false, code: 'chat_not_found', message: 'Chat not found' })
      };
    }
    const conv = convSnap.data() as { clientId?: string } | undefined;
    const clientId = String(conv?.clientId ?? '').trim();
    if (!clientId) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ ok: false, code: 'chat_not_found', message: 'Chat client is missing' })
      };
    }
    const ownerSnap = await db
      .collection('whatsappClients')
      .where('companyId', '==', 'hotwell')
      .where('managerId', '==', managerId)
      .where('__name__', '==', clientId)
      .limit(1)
      .get();
    if (ownerSnap.empty) {
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ ok: false, code: 'forbidden', message: 'Chat does not belong to manager' })
      };
    }

    await markConversationAsRead(chatId, lastReadMessageId, 'hotwell');
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        chatId,
        unreadCount: 0,
        markedAt: Date.now(),
        lastReadMessageId
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
