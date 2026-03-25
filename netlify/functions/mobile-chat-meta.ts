import type { Handler } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, code: 'method_not_allowed' }) };
  }

  const managerId = String(event.queryStringParameters?.managerId ?? '').trim();
  if (!managerId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'invalid_request', message: 'managerId is required' }) };
  }

  try {
    const db = getDb();
    const clientsSnap = await db
      .collection('whatsappClients')
      .where('companyId', '==', 'hotwell')
      .where('managerId', '==', managerId)
      .limit(500)
      .get();

    const clientIds = clientsSnap.docs.map((d) => d.id);
    if (clientIds.length === 0) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, managerId, unreadTotal: 0, waitingCount: 0, activeChats: 0, sourceTimestamp: 0 })
      };
    }

    const convSnaps = await Promise.all(
      chunk(clientIds, 10).map((ids) =>
        db
          .collection('whatsappConversations')
          .where('companyId', '==', 'hotwell')
          .where('status', '==', 'active')
          .where('clientId', 'in', ids)
          .limit(200)
          .get()
      )
    );

    let unreadTotal = 0;
    let waitingCount = 0;
    let activeChats = 0;
    let sourceTimestamp = 0;

    for (const snap of convSnaps) {
      for (const d of snap.docs) {
        const x = d.data() as { unreadCount?: number; lastIncomingAt?: { toMillis?: () => number } };
        activeChats += 1;
        unreadTotal += Math.max(0, Number(x.unreadCount ?? 0));
        if (Number(x.unreadCount ?? 0) > 0) waitingCount += 1;
        const ts = x.lastIncomingAt?.toMillis?.() ?? 0;
        if (ts > sourceTimestamp) sourceTimestamp = ts;
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, managerId, unreadTotal, waitingCount, activeChats, sourceTimestamp })
    };
  } catch (e: unknown) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, code: 'internal_error', message: (e as { message?: string })?.message ?? 'failed' })
    };
  }
};
