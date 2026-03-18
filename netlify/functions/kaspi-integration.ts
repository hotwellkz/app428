import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  getDb,
  getCompanyIdForUser,
  verifyIdToken,
  getKaspiIntegration,
  setKaspiIntegration,
  type KaspiSyncMode
} from './lib/firebaseAdmin';

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

const SYNC_MODE_VALUES: KaspiSyncMode[] = ['manual', 'four_times_daily', 'every_4h', 'every_2h'];

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
    const integration = await getKaspiIntegration(companyId);
    if (!integration) {
      return json(200, {
        configured: false,
        enabled: false,
        apiKeyMasked: null,
        merchantId: null,
        merchantName: null,
        syncMode: 'manual',
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncMessage: null,
        lastSyncOrdersCount: null
      });
    }
    return json(200, {
      configured: !!integration.apiKey?.trim(),
      enabled: integration.enabled,
      apiKeyMasked: integration.apiKey ? maskApiKey(integration.apiKey) : null,
      merchantId: integration.merchantId,
      merchantName: integration.merchantName,
      syncMode: integration.syncMode,
      lastSyncAt: integration.lastSyncAt?.toDate?.()?.toISOString?.() ?? null,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncMessage: integration.lastSyncMessage,
      lastSyncOrdersCount: integration.lastSyncOrdersCount
    });
  }

  // POST — сохранить настройки
  let body: {
    apiKey?: string;
    merchantId?: string | null;
    merchantName?: string | null;
    enabled?: boolean;
    syncMode?: KaspiSyncMode;
  };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as object) ?? {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const merchantId = typeof body.merchantId === 'string' ? body.merchantId.trim() || null : undefined;
  const merchantName = typeof body.merchantName === 'string' ? body.merchantName.trim() || null : undefined;
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;
  const syncMode =
    typeof body.syncMode === 'string' && SYNC_MODE_VALUES.includes(body.syncMode as KaspiSyncMode)
      ? (body.syncMode as KaspiSyncMode)
      : undefined;

  const existing = await getKaspiIntegration(companyId);
  const update: Parameters<typeof setKaspiIntegration>[1] = {};
  if (apiKey) update.apiKey = apiKey;
  if (merchantId !== undefined) update.merchantId = merchantId;
  if (merchantName !== undefined) update.merchantName = merchantName;
  if (enabled !== undefined) update.enabled = enabled;
  if (syncMode !== undefined) update.syncMode = syncMode;

  if (Object.keys(update).length === 0) {
    return json(400, { error: 'Нет данных для сохранения. Укажите API ключ или другие поля.' });
  }
  if (!existing && !apiKey) {
    return json(400, { error: 'Укажите API ключ Kaspi для первичной настройки.' });
  }

  try {
    await setKaspiIntegration(companyId, update);
    return json(200, { success: true, message: 'Настройки Kaspi сохранены.' });
  } catch (e) {
    console.error('[kaspi-integration] setKaspiIntegration failed:', e);
    return json(500, { error: 'Не удалось сохранить настройки' });
  }
};
