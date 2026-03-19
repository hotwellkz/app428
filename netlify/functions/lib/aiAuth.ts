import type { HandlerEvent } from '@netlify/functions';
import { verifyIdToken, getCompanyIdForUser, getOpenAIApiKeyForCompany } from './firebaseAdmin';

const AI_NOT_CONFIGURED_MESSAGE =
  'AI не подключен. Сохраните API ключ OpenAI в разделе Интеграции.';

export type AIAuthResult =
  | { ok: true; apiKey: string; companyId: string }
  | { ok: false; statusCode: number; error: string };

/**
 * Получить OpenAI API key компании текущего пользователя.
 * Только из БД (ключ компании). Fallback на env НЕ используется.
 */
export async function getAIApiKeyFromRequest(event: HandlerEvent): Promise<AIAuthResult> {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (!token) {
    return { ok: false, statusCode: 401, error: 'Требуется авторизация' };
  }

  let uid: string;
  try {
    uid = await verifyIdToken(token);
  } catch {
    return { ok: false, statusCode: 401, error: 'Неверный токен' };
  }

  let companyId: string | null = null;
  let apiKey: string | null = null;
  try {
    companyId = await getCompanyIdForUser(uid);
    if (!companyId) {
      return { ok: false, statusCode: 403, error: 'Доступ запрещён' };
    }
    apiKey = await getOpenAIApiKeyForCompany(companyId);
  } catch (e) {
    console.error('[aiAuth] getCompanyIdForUser/getOpenAIApiKeyForCompany failed:', e);
    return { ok: false, statusCode: 503, error: 'Сервис временно недоступен. Проверьте настройки деплоя (Firebase).' };
  }

  if (!apiKey) {
    return { ok: false, statusCode: 403, error: AI_NOT_CONFIGURED_MESSAGE };
  }

  return { ok: true, apiKey, companyId };
}
