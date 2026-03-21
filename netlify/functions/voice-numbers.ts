import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import {
  getCompanyIdForUser,
  verifyIdToken,
  getDb,
  getVoiceIntegration,
  mergeVoiceIntegrationTelnyx,
  mergeVoiceIntegrationZadarma
} from './lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { fetchTelnyxPhoneNumbers } from './lib/voice/providers/telnyxVoiceProvider';
import { fetchZadarmaPhoneNumbers } from './lib/voice/providers/zadarmaVoiceProvider';

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
    const providerFilter = String(event.queryStringParameters?.provider ?? '').trim().toLowerCase();
    const snap = await col.where('companyId', '==', companyId).get();
    let items = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        e164: String(x.e164 ?? ''),
        label: (x.label as string) ?? null,
        provider: (x.provider as string) ?? 'twilio',
        externalNumberId: (x.externalNumberId as string) ?? null,
        countryCode: (x.countryCode as string) ?? null,
        isDefault: x.isDefault === true,
        isActive: x.isActive !== false,
        readinessStatus: (x.readinessStatus as string) ?? 'ready',
        capabilities: (x.capabilities as Record<string, unknown>) ?? null
      };
    });
    if (providerFilter === 'twilio' || providerFilter === 'telnyx' || providerFilter === 'zadarma') {
      items = items.filter((it) => String(it.provider ?? 'twilio') === providerFilter);
    }
    return json(200, { items });
  }

  let body: {
    action?: 'upsert' | 'set_default' | 'toggle_active' | 'sync_telnyx' | 'sync_zadarma';
    numberId?: string;
    e164?: string;
    label?: string | null;
    provider?: string;
    isActive?: boolean;
    externalNumberId?: string | null;
    countryCode?: string | null;
  } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as typeof body) : {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const action = body.action ?? 'upsert';

  if (action === 'sync_zadarma') {
    const row = await getVoiceIntegration(companyId);
    const key = row?.zadarmaKey?.trim() ?? '';
    const secret = row?.zadarmaSecret?.trim() ?? '';
    if (!key || !secret) {
      return json(400, {
        ok: false,
        error: 'Сохраните Zadarma Key и Secret в разделе Интеграций',
        code: 'provider_auth_error'
      });
    }
    const sync = await fetchZadarmaPhoneNumbers(key, secret);
    if (!sync.ok) {
      return json(400, {
        ok: false,
        error: sync.error,
        code: 'provider_api_error',
        imported: 0,
        updated: 0
      });
    }
    if (sync.numbers.length === 0) {
      await mergeVoiceIntegrationZadarma(companyId, { zadarmaLastSyncedAt: Timestamp.now() });
      return json(200, {
        ok: true,
        imported: 0,
        updated: 0,
        total: 0,
        empty: true,
        message: 'В Zadarma не найдено подключённых виртуальных номеров (direct_numbers)'
      });
    }
    let imported = 0;
    let updated = 0;
    for (const n of sync.numbers) {
      const safeExt = n.externalNumberId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const numberId = `zadarma_${safeExt}`;
      const ref = col.doc(numberId);
      const prev = await ref.get();
      const exists = prev.exists;
      await ref.set(
        {
          companyId,
          e164: n.e164,
          label: n.label,
          provider: 'zadarma',
          externalNumberId: n.externalNumberId,
          countryCode: n.countryCode,
          isActive: n.active,
          readinessStatus: n.readinessStatus,
          capabilities: n.capabilities,
          updatedAt: FieldValue.serverTimestamp(),
          ...(exists ? {} : { isDefault: false, createdAt: FieldValue.serverTimestamp() })
        },
        { merge: true }
      );
      if (exists) updated += 1;
      else imported += 1;
    }
    await mergeVoiceIntegrationZadarma(companyId, { zadarmaLastSyncedAt: Timestamp.now() });
    return json(200, {
      ok: true,
      imported,
      updated,
      total: sync.numbers.length,
      empty: false,
      message: `Синхронизировано номеров Zadarma: ${sync.numbers.length}`
    });
  }

  if (action === 'sync_telnyx') {
    const row = await getVoiceIntegration(companyId);
    const apiKey = row?.telnyxApiKey?.trim() ?? '';
    if (!apiKey) {
      return json(400, {
        ok: false,
        error: 'Сохраните Telnyx API Key в разделе Интеграций',
        code: 'provider_auth_error'
      });
    }
    const sync = await fetchTelnyxPhoneNumbers(apiKey);
    if (!sync.ok) {
      return json(400, {
        ok: false,
        error: sync.error,
        code: 'provider_api_error',
        imported: 0,
        updated: 0
      });
    }
    if (sync.numbers.length === 0) {
      await mergeVoiceIntegrationTelnyx(companyId, { telnyxLastSyncedAt: Timestamp.now() });
      return json(200, {
        ok: true,
        imported: 0,
        updated: 0,
        total: 0,
        empty: true,
        message: 'В аккаунте Telnyx не найдено номеров для импорта'
      });
    }
    let imported = 0;
    let updated = 0;
    for (const n of sync.numbers) {
      const safeExt = n.externalNumberId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const numberId = `telnyx_${safeExt}`;
      const ref = col.doc(numberId);
      const prev = await ref.get();
      const exists = prev.exists;
      await ref.set(
        {
          companyId,
          e164: n.e164,
          label: n.label,
          provider: 'telnyx',
          externalNumberId: n.externalNumberId,
          countryCode: n.countryCode,
          isActive: n.active,
          readinessStatus: n.readinessStatus,
          capabilities: n.capabilities,
          updatedAt: FieldValue.serverTimestamp(),
          ...(exists ? {} : { isDefault: false, createdAt: FieldValue.serverTimestamp() })
        },
        { merge: true }
      );
      if (exists) updated += 1;
      else imported += 1;
    }
    await mergeVoiceIntegrationTelnyx(companyId, { telnyxLastSyncedAt: Timestamp.now() });
    return json(200, {
      ok: true,
      imported,
      updated,
      total: sync.numbers.length,
      empty: false,
      message: `Синхронизировано номеров: ${sync.numbers.length}`
    });
  }

  if (action === 'set_default') {
    const numberId = String(body.numberId ?? '').trim();
    if (!numberId) return json(400, { error: 'numberId required' });
    const ref = col.doc(numberId);
    const snap = await ref.get();
    if (!snap.exists || String(snap.data()?.companyId ?? '') !== companyId) return json(404, { error: 'Номер не найден' });
    const targetProv = String(snap.data()?.provider ?? 'twilio').trim() || 'twilio';
    const batch = db.batch();
    const all = await col.where('companyId', '==', companyId).where('isDefault', '==', true).get();
    all.docs.forEach((d) => {
      const p = String(d.data()?.provider ?? 'twilio').trim() || 'twilio';
      if (p === targetProv) {
        batch.update(d.ref, { isDefault: false, updatedAt: FieldValue.serverTimestamp() });
      }
    });
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
  const prov = (body.provider ?? 'twilio').trim() || 'twilio';
  const extId = body.externalNumberId != null ? String(body.externalNumberId).trim() || null : null;
  const cc = body.countryCode != null ? String(body.countryCode).trim().slice(0, 8) || null : null;
  await ref.set(
    {
      companyId,
      e164,
      label: body.label?.trim() || null,
      provider: prov,
      externalNumberId: extId,
      countryCode: cc,
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
