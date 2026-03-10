import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyIdToken, getUserRole, softDeleteCompany } from './lib/firebaseAdmin';

const LOG_PREFIX = '[delete-company]';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body)
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
  if (!token) {
    return jsonResponse(401, { success: false, error: 'Authorization required' });
  }

  let uid: string;
  try {
    uid = await verifyIdToken(token);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(LOG_PREFIX, 'Invalid token:', String(e));
    }
    return jsonResponse(401, { success: false, error: 'Invalid token' });
  }

  const role = await getUserRole(uid);
  if (role !== 'global_admin') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(LOG_PREFIX, 'Forbidden: uid=', uid, 'role=', role);
    }
    return jsonResponse(403, { success: false, error: 'Forbidden: global_admin only' });
  }

  let body: { companyId?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
  }

  const companyId = body.companyId?.trim();
  if (!companyId) {
    return jsonResponse(400, { success: false, error: 'companyId required' });
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(LOG_PREFIX, 'soft delete:', { companyId, deletedBy: uid });
    }
    await softDeleteCompany(companyId, uid);
    if (process.env.NODE_ENV !== 'production') {
      console.log(LOG_PREFIX, 'soft delete success:', companyId);
    }
    return jsonResponse(200, {
      success: true,
      companyId,
      mode: 'soft-delete'
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    console.error(LOG_PREFIX, 'soft delete failed:', companyId, err);
    return jsonResponse(500, { success: false, error: message });
  }
};
