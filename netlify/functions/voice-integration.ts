import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import twilio from 'twilio';
import {
  getCompanyIdForUser,
  getVoiceIntegration,
  setVoiceIntegration,
  getDb
} from './lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyIdToken } from './lib/firebaseAdmin';

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

async function getDefaultNumberStatus(companyId: string): Promise<{ hasDefaultOutbound: boolean; defaultNumberId: string | null }> {
  const db = getDb();
  const snap = await db
    .collection('voiceNumbers')
    .where('companyId', '==', companyId)
    .where('isDefault', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return { hasDefaultOutbound: false, defaultNumberId: null };
  return { hasDefaultOutbound: true, defaultNumberId: snap.docs[0].id };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';
  if (!token) return json(401, { error: 'Требуется авторизация' });

  let uid: string;
  try {
    uid = await verifyIdToken(token);
  } catch {
    return json(401, { error: 'Неверный токен' });
  }

  const companyId = await getCompanyIdForUser(uid);
  if (!companyId) return json(403, { error: 'Доступ запрещён' });

  if (event.httpMethod === 'GET') {
    const row = await getVoiceIntegration(companyId);
    const num = await getDefaultNumberStatus(companyId);
    const connected = !!(row?.enabled && row.accountSid && row.authToken);
    const ready = connected && num.hasDefaultOutbound;
    return json(200, {
      provider: 'twilio',
      configured: !!row,
      enabled: row?.enabled === true,
      accountSidMasked: row?.accountSidMasked ?? null,
      connectionStatus: row?.connectionStatus ?? 'not_connected',
      connectionError: row?.connectionError ?? null,
      lastCheckedAt: row?.lastCheckedAt?.toDate?.()?.toISOString?.() ?? null,
      hasDefaultOutbound: num.hasDefaultOutbound,
      defaultNumberId: num.defaultNumberId,
      voiceReady: ready
    });
  }

  let body: {
    accountSid?: string;
    authToken?: string;
    enabled?: boolean;
    testOnly?: boolean;
  } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as typeof body) : {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const accountSid = (body.accountSid ?? '').trim();
  const authToken = (body.authToken ?? '').trim();
  const testOnly = body.testOnly === true;
  const enabled = body.enabled !== false;

  if (!testOnly && (!accountSid || !authToken)) {
    return json(400, { error: 'Укажите Account SID и Auth Token' });
  }

  if (accountSid || authToken) {
    try {
      if (!accountSid || !authToken) return json(400, { error: 'Для проверки нужны и Account SID, и Auth Token' });
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Проверка Twilio не пройдена';
      if (testOnly) return json(400, { ok: false, error: message });
      await setVoiceIntegration(companyId, {
        enabled: false,
        connectionStatus: 'invalid_config',
        connectionError: message,
        lastCheckedAt: Timestamp.now()
      });
      return json(400, { ok: false, error: message });
    }
  }

  if (testOnly) {
    return json(200, { ok: true, message: 'Twilio подключение успешно проверено' });
  }

  await setVoiceIntegration(companyId, {
    provider: 'twilio',
    enabled,
    accountSid,
    authToken,
    connectionStatus: 'connected',
    connectionError: null,
    lastCheckedAt: Timestamp.now()
  });
  return json(200, { ok: true, message: 'Voice интеграция сохранена' });
};
