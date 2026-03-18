import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getCompanyIdForUser, verifyIdToken } from './lib/firebaseAdmin';
import { runKaspiSyncForCompany } from './lib/kaspiSyncRun';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

async function getCompanyIdFromAuth(event: HandlerEvent): Promise<string | null> {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
  if (!token) return null;
  try {
    const uid = await verifyIdToken(token);
    return await getCompanyIdForUser(uid);
  } catch {
    return null;
  }
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }
  if (event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  }

  const companyId = await getCompanyIdFromAuth(event);
  if (!companyId) {
    return withCors({
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Требуется авторизация' })
    });
  }

  const result = await runKaspiSyncForCompany(companyId);

  if (!result.ok && result.error) {
    const isConfig = result.error.includes('не настроен') || result.error.includes('отключена');
    return withCors({
      statusCode: isConfig ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: result.error, processed: result.processed, found: result.found })
    });
  }

  return withCors({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, processed: result.processed, found: result.found })
  });
};

