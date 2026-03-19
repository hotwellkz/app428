import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb, verifyIdToken, getCompanyIdForUser } from './lib/firebaseAdmin';
import { processAiControlAlertsForCompany } from './lib/aiControlAlerting';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    const uid = await verifyIdToken(token);
    const companyId = await getCompanyIdForUser(uid);
    if (!companyId) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No company access' }) };

    const body = event.body ? (JSON.parse(event.body) as { runId?: string }) : {};
    if (!body.runId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'runId required' }) };

    const db = getDb();
    const out = await processAiControlAlertsForCompany(db, companyId, {
      runId: body.runId,
      forceManualResend: true
    });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, out }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: String(e) }) };
  }
};
