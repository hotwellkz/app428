import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';
import { verifyIdToken } from './lib/firebaseAdmin';

const COMPANY_USERS = 'company_users';
const WAZZUP_API_BASE = 'https://api.wazzup24.com';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const snap = await db.collection(COMPANY_USERS).doc(uid).get();
  if (!snap.exists) return null;
  return (snap.data()?.companyId as string) ?? null;
}

/**
 * Проверка подключения Wazzup: валидация API ключа через запрос к API.
 * Пробуем GET /v3/channels или /v3/account — при 401/403 ключ неверный.
 */
export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
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

  let body: { apiKey?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body ?? {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) return json(400, { error: 'Укажите API ключ' });

  try {
    const res = await fetch(`${WAZZUP_API_BASE}/v3/channels`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      return json(200, {
        ok: false,
        error: 'Неверный API ключ. Проверьте ключ в личном кабинете Wazzup.'
      });
    }

    if (res.status >= 200 && res.status < 300) {
      let whatsappChannelId: string | null = null;
      let instagramChannelId: string | null = null;
      try {
        const data = await res.json();
        const channels = Array.isArray(data?.channels) ? data.channels : [];
        for (const c of channels) {
          const type = String(c?.type ?? c?.transport ?? '').toLowerCase().trim();
          const id = (c?.channelId ?? c?.id ?? '').trim();
          if (!id || typeof id !== 'string') continue;
          if (type === 'whatsapp') whatsappChannelId = id;
          else if (type === 'instagram' || type === 'instagram_direct' || type === 'ig') instagramChannelId = id;
        }
      } catch {
        /* ignore */
      }
      return json(200, {
        ok: true,
        message: 'Подключение успешно. Каналы доступны.',
        ...(whatsappChannelId ? { whatsappChannelId } : {}),
        ...(instagramChannelId ? { instagramChannelId } : {})
      });
    }

    const text = await res.text();
    let detail: string | null = null;
    try {
      const data = text ? JSON.parse(text) : {};
      detail = data.message || data.error || data.description || null;
    } catch {
      detail = text.slice(0, 200) || null;
    }
    return json(200, {
      ok: false,
      error: detail || `Ошибка API Wazzup (код ${res.status}). Проверьте ключ и настройки канала.`
    });
  } catch (e) {
    console.error('[wazzup-verify] request failed:', e);
    return json(200, {
      ok: false,
      error: 'Не удалось связаться с сервером Wazzup. Проверьте ключ и повторите позже.'
    });
  }
};
