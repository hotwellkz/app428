import type { Handler } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';

type ChatItem = {
  chatId: string;
  title: string;
  clientName: string;
  phone: string;
  preview: string;
  lastMessageAt: number;
  unreadCount: number;
  avatarUrl: string | null;
  status: string;
  tags: string[];
  sourceTimestamp: number;
};

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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  const managerId = String(event.queryStringParameters?.managerId ?? event.queryStringParameters?.userId ?? '')
    .trim();
  if (!managerId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'managerId is required' }) };
  }

  const sinceRaw = String(event.queryStringParameters?.since ?? '').trim();
  const since = sinceRaw ? Number.parseInt(sinceRaw, 10) : 0;
  const cursorRaw = String(event.queryStringParameters?.cursor ?? '').trim();
  const cursor = cursorRaw ? Number.parseInt(cursorRaw, 10) : 0;
  const limitRaw = String(event.queryStringParameters?.limit ?? '').trim();
  const limit = Math.min(100, Math.max(1, limitRaw ? Number.parseInt(limitRaw, 10) || 50 : 50));

  try {
    const db = getDb();

    // В текущей модели managerId хранится у whatsappClients.
    const clientsSnap = await db
      .collection('whatsappClients')
      .where('companyId', '==', 'hotwell')
      .where('managerId', '==', managerId)
      .limit(500)
      .get();

    const clients = clientsSnap.docs.map((d) => {
      const x = d.data() as {
        name?: string;
        phone?: string;
        avatarUrl?: string | null;
      };
      return {
        id: d.id,
        name: (x.name ?? '').trim(),
        phone: (x.phone ?? '').trim(),
        avatarUrl: (x.avatarUrl as string | null | undefined) ?? null
      };
    });

    if (clients.length === 0) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, items: [], sourceTimestamp: 0, count: 0 })
      };
    }

    const clientsById = new Map(clients.map((c) => [c.id, c]));
    const clientIds = clients.map((c) => c.id);

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

    const items: ChatItem[] = [];
    for (const snap of convSnaps) {
      for (const d of snap.docs) {
        const x = d.data() as {
          clientId?: string;
          phone?: string;
          lastMessagePreview?: string;
          lastMessageAt?: { toMillis?: () => number };
          unreadCount?: number;
          status?: string;
          tags?: string[];
        };

        const lm = x.lastMessageAt?.toMillis?.() ?? 0;
        if (since > 0 && lm > 0 && lm <= since) continue;

        const c = clientsById.get(String(x.clientId ?? ''));
        const title = c?.name?.trim() || c?.phone?.trim() || (x.phone ?? '').trim() || 'Чат';
        const phone = c?.phone?.trim() || (x.phone ?? '').trim();

        items.push({
          chatId: d.id,
          title,
          clientName: c?.name?.trim() || title,
          phone,
          preview: String(x.lastMessagePreview ?? '').trim(),
          lastMessageAt: lm,
          unreadCount: Number.isFinite(x.unreadCount) ? Math.max(0, Number(x.unreadCount ?? 0)) : 0,
          avatarUrl: c?.avatarUrl ?? null,
          status: String(x.status ?? 'active'),
          tags: Array.isArray(x.tags) ? x.tags.map((t) => String(t).trim()).filter(Boolean) : [],
          sourceTimestamp: lm
        });
      }
    }

    items.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    const sourceTimestamp = items.reduce((m, i) => Math.max(m, i.sourceTimestamp || 0), 0);

    // snapshot paging by cursor(lastMessageAt); since-mode returns changed items.
    const pagedBase =
      since > 0
        ? items
        : cursor > 0
          ? items.filter((i) => i.lastMessageAt < cursor)
          : items;

    const hasMore = pagedBase.length > limit;
    const pageItems = pagedBase.slice(0, limit);
    const nextCursor =
      !since && hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].lastMessageAt : null;
    const unreadTotal = items.reduce((sum, i) => sum + Math.max(0, i.unreadCount || 0), 0);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        contractVersion: '2026-03-android-chat-v1',
        mode: since > 0 ? 'incremental' : 'snapshot',
        items: pageItems,
        deleted: [],
        sourceTimestamp,
        hasMore: since > 0 ? false : hasMore,
        nextCursor,
        count: pageItems.length,
        meta: {
          unreadTotal,
          totalChats: items.length
        }
      })
    };
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'chat-list failed';
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: msg })
    };
  }
};
