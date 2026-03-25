import type { Handler } from '@netlify/functions';
import { Timestamp } from 'firebase-admin/firestore';
import { devicesCollection, normalizeManagerId, normalizeToken } from './lib/mobilePushStore';

type Body = {
  managerId?: string;
  userId?: string;
  token?: string;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  let body: Body;
  try {
    body = JSON.parse(event.body || '{}') as Body;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const managerId = normalizeManagerId(String(body.managerId ?? body.userId ?? ''));
  const token = normalizeToken(String(body.token ?? ''));

  if (!managerId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'managerId is required' }) };
  }
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'token is required' }) };
  }

  const ref = devicesCollection().doc(token);
  const snap = await ref.get();
  if (!snap.exists) {
    // idempotent
    return { statusCode: 200, body: JSON.stringify({ ok: true, removed: false }) };
  }

  const data = snap.data() as { managerId?: string } | undefined;
  if (data?.managerId && data.managerId !== managerId) {
    // Не удаляем чужое устройство
    return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'managerId mismatch' }) };
  }

  await ref.update({
    isActive: false,
    updatedAt: Timestamp.now()
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true, removed: true }) };
};

