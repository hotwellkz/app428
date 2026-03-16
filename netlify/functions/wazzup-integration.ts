import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';
import { getWazzupIntegration, setWazzupIntegration, verifyIdToken } from './lib/firebaseAdmin';

const COLLECTION_COMPANY_USERS = 'company_users';

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

async function getCompanyIdForUser(uid: string): Promise<string | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTION_COMPANY_USERS).doc(uid).get();
  if (!snap.exists) return null;
  return (snap.data()?.companyId as string) ?? null;
}

/** Маскировать API key: показать только последние 4 символа */
function maskApiKey(key: string): string {
  if (!key || key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

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
    const integration = await getWazzupIntegration(companyId);
    if (!integration) {
      return json(200, {
        configured: false,
        apiKeyMasked: null,
        whatsappChannelId: null,
        instagramChannelId: null,
        connectionStatus: null,
        connectionError: null,
        lastCheckedAt: null
      });
    }
    return json(200, {
      configured: true,
      apiKeyMasked: integration.apiKey ? maskApiKey(integration.apiKey) : null,
      whatsappChannelId: integration.whatsappChannelId,
      instagramChannelId: integration.instagramChannelId,
      connectionStatus: integration.connectionStatus,
      connectionError: integration.connectionError,
      lastCheckedAt: integration.lastCheckedAt?.toDate?.()?.toISOString?.() ?? null
    });
  }

  // POST — сохранить настройки
  let body: { apiKey?: string; whatsappChannelId?: string | null; instagramChannelId?: string | null };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body ?? {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) return json(400, { error: 'Укажите API ключ Wazzup' });

  const rawWa = typeof body.whatsappChannelId === 'string' ? body.whatsappChannelId.trim() : '';
  const rawIg = typeof body.instagramChannelId === 'string' ? body.instagramChannelId.trim() : '';
  const looksLikeEmail = (s: string) => /@/.test(s);
  const whatsappChannelId = rawWa && !looksLikeEmail(rawWa) ? rawWa : null;
  const instagramChannelId = rawIg && !looksLikeEmail(rawIg) ? rawIg : null;
  if (rawWa && looksLikeEmail(rawWa)) {
    console.warn('[wazzup-integration] whatsappChannelId looks like email, saving as null:', rawWa);
  }
  if (rawIg && looksLikeEmail(rawIg)) {
    console.warn('[wazzup-integration] instagramChannelId looks like email, saving as null:', rawIg);
  }

  try {
    await setWazzupIntegration(companyId, {
      apiKey,
      whatsappChannelId,
      instagramChannelId
    });
    const msg =
      whatsappChannelId === null && rawWa
        ? 'Настройки сохранены. В поле ID канала был указан email — сохраняем как пусто; канал привяжется при первом входящем сообщении.'
        : 'Настройки сохранены. После первого входящего сообщения канал будет привязан к диалогам.';
    return json(200, {
      success: true,
      message: msg
    });
  } catch (e) {
    console.error('[wazzup-integration] save failed:', e);
    return json(500, { error: 'Не удалось сохранить настройки' });
  }
};
