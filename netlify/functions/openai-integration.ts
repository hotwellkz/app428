import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  getOpenAIIntegration,
  setOpenAIIntegration,
  getCompanyIdForUser,
  verifyIdToken
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

  let companyId: string | null = null;
  try {
    companyId = await getCompanyIdForUser(uid);
  } catch (e) {
    console.error('[openai-integration] getCompanyIdForUser failed:', e);
    return json(503, { error: 'Сервис временно недоступен. Проверьте настройки деплоя (Firebase).' });
  }
  if (!companyId) return json(403, { error: 'Доступ запрещён' });

  if (event.httpMethod === 'GET') {
    try {
      const integration = await getOpenAIIntegration(companyId);
      if (!integration) {
        return json(200, { configured: false, apiKeyMasked: null });
      }
      return json(200, {
        configured: true,
        apiKeyMasked: integration.apiKeyMasked ?? (integration.apiKey ? '****' + integration.apiKey.slice(-4) : null)
      });
    } catch (e) {
      console.error('[openai-integration] getOpenAIIntegration failed:', e);
      return json(503, { error: 'Сервис временно недоступен. Проверьте настройки деплоя (Firebase).' });
    }
  }

  // POST — сохранить API ключ
  let body: { apiKey?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as object) ?? {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) return json(400, { error: 'Укажите API ключ OpenAI' });

  try {
    await setOpenAIIntegration(companyId, apiKey);
    return json(200, { success: true, message: 'API ключ сохранён. AI-функции доступны.' });
  } catch (e) {
    console.error('[openai-integration] save failed:', e);
    return json(500, { error: 'Не удалось сохранить настройки' });
  }
};
