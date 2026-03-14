import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyIdToken, getDb } from './lib/firebaseAdmin';

const COLLECTION_QUICK_REPLIES = 'quick_replies';
const COLLECTION_COMPANY_USERS = 'company_users';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'DELETE, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body)
  };
}

/**
 * DELETE /api/templates/:id или POST /api/templates-delete — удаление шаблона quick_replies.
 * POST предпочтителен: многие прокси отдают 405 на DELETE к /api/templates/*.
 */
export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
  if (!token) {
    return json(401, { error: 'Authorization required' });
  }

  let uid: string;
  try {
    uid = await verifyIdToken(token);
  } catch {
    return json(401, { error: 'Invalid token' });
  }

  let templateId =
    event.queryStringParameters?.id?.trim() ||
    event.queryStringParameters?.templateId?.trim() ||
    '';
  if (!templateId && event.body) {
    try {
      const b = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      templateId = (b?.id as string)?.trim?.() ?? '';
    } catch {
      /* ignore */
    }
  }
  if (!templateId) {
    return json(400, { error: 'Template id required' });
  }

  const db = getDb();
  const ref = db.collection(COLLECTION_QUICK_REPLIES).doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) {
    return json(404, { error: 'Template not found' });
  }
  const data = snap.data() as { companyId?: string };
  const companyId = data.companyId;
  if (!companyId) {
    return json(400, { error: 'Invalid template' });
  }

  const userSnap = await db.collection(COLLECTION_COMPANY_USERS).doc(uid).get();
  if (!userSnap.exists) {
    return json(403, { error: 'Forbidden' });
  }
  const userData = userSnap.data() as { companyId?: string; menuAccess?: { quickReplies?: boolean } };
  if (userData.companyId !== companyId) {
    return json(403, { error: 'Forbidden' });
  }
  if (userData.menuAccess?.quickReplies === false) {
    return json(403, { error: 'Forbidden' });
  }

  await ref.delete();
  return json(200, { ok: true, id: templateId });
};
