import type { Handler } from '@netlify/functions';
import { Timestamp } from 'firebase-admin/firestore';
import { devicesCollection, normalizeManagerId, normalizeToken } from './lib/mobilePushStore';

type Body = {
  managerId?: string;
  userId?: string;
  token?: string;
  platform?: string;
  deviceModel?: string;
  appVersion?: string;
  deviceId?: string;
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
  const platform = String(body.platform ?? '').trim().toLowerCase();

  if (!managerId) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'managerId is required' }) };
  }
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'token is required' }) };
  }
  if (platform !== 'android' && platform !== 'ios') {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'platform must be android or ios' }) };
  }

  const deviceModel = (body.deviceModel ?? '').trim() || null;
  const appVersion = (body.appVersion ?? '').trim() || null;
  const deviceId = (body.deviceId ?? '').trim() || null;

  const now = Timestamp.now();
  const ref = devicesCollection().doc(token);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      managerId,
      token,
      platform,
      deviceModel,
      appVersion,
      deviceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true, created: true }) };
  }

  await ref.update({
    managerId,
    deviceModel,
    appVersion,
    deviceId,
    platform,
    isActive: true,
    updatedAt: now,
    lastSeenAt: now
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true, created: false }) };
};

