import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getCompanyIdForUser, verifyIdToken, getDb } from './lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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

function normalizeE164(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
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

  const db = getDb();
  const col = db.collection('voiceNumbers');

  if (event.httpMethod === 'GET') {
    const snap = await col.where('companyId', '==', companyId).get();
    const items = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        e164: String(x.e164 ?? ''),
        label: (x.label as string) ?? null,
        provider: (x.provider as string) ?? 'twilio',
        isDefault: x.isDefault === true,
        isActive: x.isActive !== false,
        readinessStatus: (x.readinessStatus as string) ?? 'ready'
      };
    });
    return json(200, { items });
  }

  let body: {
    action?: 'upsert' | 'set_default' | 'toggle_active';
    numberId?: string;
    e164?: string;
    label?: string | null;
    provider?: string;
    isActive?: boolean;
  } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as typeof body) : {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const action = body.action ?? 'upsert';
  if (action === 'set_default') {
    const numberId = String(body.numberId ?? '').trim();
    if (!numberId) return json(400, { error: 'numberId required' });
    const ref = col.doc(numberId);
    const snap = await ref.get();
    if (!snap.exists || String(snap.data()?.companyId ?? '') !== companyId) return json(404, { error: 'Номер не найден' });
    const batch = db.batch();
    const all = await col.where('companyId', '==', companyId).where('isDefault', '==', true).get();
    all.docs.forEach((d) => batch.update(d.ref, { isDefault: false, updatedAt: FieldValue.serverTimestamp() }));
    batch.update(ref, { isDefault: true, updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
    return json(200, { ok: true });
  }

  if (action === 'toggle_active') {
    const numberId = String(body.numberId ?? '').trim();
    if (!numberId) return json(400, { error: 'numberId required' });
    const ref = col.doc(numberId);
    const snap = await ref.get();
    if (!snap.exists || String(snap.data()?.companyId ?? '') !== companyId) return json(404, { error: 'Номер не найден' });
    await ref.update({ isActive: body.isActive !== false, updatedAt: FieldValue.serverTimestamp() });
    return json(200, { ok: true });
  }

  const e164 = normalizeE164(String(body.e164 ?? ''));
  if (!e164) return json(400, { error: 'Некорректный номер в формате E.164' });
  const numberId = String(body.numberId ?? '').trim() || `num_${Date.now().toString(36)}`;
  const ref = col.doc(numberId);
  const exists = await ref.get();
  await ref.set(
    {
      companyId,
      e164,
      label: body.label?.trim() || null,
      provider: (body.provider ?? 'twilio').trim(),
      isActive: body.isActive !== false,
      readinessStatus: 'ready',
      capabilities: { voice: true },
      updatedAt: FieldValue.serverTimestamp(),
      ...(exists.exists ? {} : { isDefault: false }),
      ...(exists.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
    },
    { merge: true }
  );
  return json(200, { ok: true, numberId });
};
