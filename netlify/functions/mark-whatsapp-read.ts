import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { markConversationAsRead, DEFAULT_COMPANY_ID } from './lib/firebaseAdmin';

const LOG_PREFIX = '[mark-whatsapp-read]';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

interface MarkReadBody {
  conversationId: string;
  lastReadMessageId?: string | null;
  companyId?: string | null;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({ statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) });
  }

  let body: MarkReadBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as MarkReadBody) ?? {};
  } catch (e) {
    console.warn(LOG_PREFIX, 'Invalid JSON:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const { conversationId, lastReadMessageId, companyId } = body;
  if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'conversationId is required' })
    });
  }

  try {
    const effectiveCompanyId = (companyId ?? DEFAULT_COMPANY_ID).trim();
    if (process.env.NODE_ENV !== 'production') {
      console.log(LOG_PREFIX, 'request', { conversationId, lastReadMessageId: lastReadMessageId ?? null, companyId: effectiveCompanyId });
    }
    await markConversationAsRead(conversationId.trim(), lastReadMessageId ?? undefined, effectiveCompanyId);
    if (process.env.NODE_ENV !== 'production') {
      console.log(LOG_PREFIX, 'marked read', conversationId, lastReadMessageId ?? '');
    }
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, conversationId })
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'markConversationAsRead failed:', conversationId, err);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to mark as read', detail: String(err) })
    });
  }
};
