import type { HandlerEvent } from '@netlify/functions';
import { verifyIdToken, getCompanyIdForUser } from './firebaseAdmin';

export type CrmUserAuthResult =
  | { ok: true; uid: string; companyId: string }
  | { ok: false; statusCode: number; error: string };

/** Авторизация для CRM-действий без требования OpenAI-ключа. */
export async function getCrmUserAuthFromRequest(event: HandlerEvent): Promise<CrmUserAuthResult> {
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
  try {
    companyId = await getCompanyIdForUser(uid);
  } catch (e) {
    console.error('[crmUserAuth] getCompanyIdForUser failed', e);
    return { ok: false, statusCode: 503, error: 'Сервис временно недоступен' };
  }
  if (!companyId) {
    return { ok: false, statusCode: 403, error: 'Доступ запрещён' };
  }
  return { ok: true, uid, companyId };
}
