import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getCompanyIdForUser, verifyIdToken, getKaspiIntegration } from './lib/firebaseAdmin';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

const KASPI_ORDERS_BASE = 'https://kaspi.kz/shop/api/v2';

function json(status: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(body)
  };
}

/**
 * Проверка подключения Kaspi: тестовый запрос к API заказов.
 * Если в body передан apiKey — используем его, иначе берём сохранённый для компании.
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
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as object) ?? {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  let apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) {
    const integration = await getKaspiIntegration(companyId);
    apiKey = integration?.apiKey?.trim() ?? '';
  }
  if (!apiKey) {
    return json(400, { error: 'Укажите API ключ Kaspi или сохраните его в настройках интеграции.' });
  }

  const nowMs = Date.now();
  const geMs = nowMs - 14 * 24 * 60 * 60 * 1000; // последние 14 дней (макс. диапазон API)
  const url = `${KASPI_ORDERS_BASE}/orders?page[number]=0&page[size]=1&filter[orders][state]=NEW&filter[orders][creationDate][$ge]=${geMs}&filter[orders][creationDate][$le]=${nowMs}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json;charset=UTF-8',
        'X-Auth-Token': apiKey
      }
    });

    if (res.status === 401 || res.status === 403) {
      return json(200, {
        ok: false,
        error: 'Неверный API ключ. Проверьте токен в личном кабинете Магазина на Kaspi.kz (Настройки → API).'
      });
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      return json(200, {
        ok: false,
        error: `Kaspi API вернул ошибку: ${res.status}. ${text || res.statusText}`
      });
    }

    const data = (await res.json().catch(() => null)) as { data?: unknown[]; content?: unknown[] } | null;
    const hasData = data && (Array.isArray((data as { data?: unknown[] }).data) || Array.isArray((data as { content?: unknown[] }).content));
    return json(200, {
      ok: true,
      message: 'Подключение успешно. Ключ действителен.',
      ...(hasData ? { ordersAvailable: true } : {})
    });
  } catch (e) {
    console.error('[kaspi-verify] request failed:', e);
    return json(200, {
      ok: false,
      error: 'Не удалось подключиться к Kaspi API. Проверьте сеть и повторите попытку.'
    });
  }
};
