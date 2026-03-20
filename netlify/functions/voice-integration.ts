import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import twilio from 'twilio';
import {
  getCompanyIdForUser,
  getVoiceIntegration,
  setVoiceIntegration,
  getDb
} from './lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyIdToken } from './lib/firebaseAdmin';

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

async function getDefaultNumberStatus(companyId: string): Promise<{ hasDefaultOutbound: boolean; defaultNumberId: string | null }> {
  const db = getDb();
  const snap = await db
    .collection('voiceNumbers')
    .where('companyId', '==', companyId)
    .where('isDefault', '==', true)
    .limit(1)
    .get();
  if (snap.empty) return { hasDefaultOutbound: false, defaultNumberId: null };
  return { hasDefaultOutbound: true, defaultNumberId: snap.docs[0].id };
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

  if (event.httpMethod === 'GET') {
    const row = await getVoiceIntegration(companyId);
    const num = await getDefaultNumberStatus(companyId);
    const connected = !!(row?.enabled && row.accountSid && row.authToken);
    const ready = connected && num.hasDefaultOutbound;
    return json(200, {
      provider: 'twilio',
      configured: !!row,
      enabled: row?.enabled === true,
      accountSidMasked: row?.accountSidMasked ?? null,
      twilioAccountType: row?.twilioAccountType ?? null,
      twilioAccountStatus: row?.twilioAccountStatus ?? null,
      connectionStatus: row?.connectionStatus ?? 'not_connected',
      connectionError: row?.connectionError ?? null,
      lastCheckedAt: row?.lastCheckedAt?.toDate?.()?.toISOString?.() ?? null,
      hasDefaultOutbound: num.hasDefaultOutbound,
      defaultNumberId: num.defaultNumberId,
      voiceReady: ready
    });
  }

  let body: {
    accountSid?: string;
    authToken?: string;
    enabled?: boolean;
    testOnly?: boolean;
  } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as typeof body) : {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  const accountSid = (body.accountSid ?? '').trim();
  const authToken = (body.authToken ?? '').trim();
  const testOnly = body.testOnly === true;
  const enabled = body.enabled !== false;

  if (!testOnly && (!accountSid || !authToken)) {
    return json(400, { error: 'Укажите Account SID и Auth Token' });
  }

  async function probeTwilioAccount(sid: string, token: string) {
    const client = twilio(sid, token);
    const account = await client.api.accounts(sid).fetch();
    const acc = account as { status?: string; type?: string };
    let incomingVoiceCapable = 0;
    try {
      const nums = await client.incomingPhoneNumbers.list({ limit: 8 });
      incomingVoiceCapable = nums.filter((n) => n.capabilities?.voice === true).length;
    } catch {
      /* ignore — sanity only */
    }
    return {
      accountStatus: acc.status != null ? String(acc.status) : null,
      accountType: acc.type != null ? String(acc.type) : null,
      incomingVoiceCapable
    };
  }

  if (accountSid || authToken) {
    try {
      if (!accountSid || !authToken) return json(400, { error: 'Для проверки нужны и Account SID, и Auth Token' });
      const probe = await probeTwilioAccount(accountSid, authToken);
      const accountSidSuffix = accountSid.length >= 6 ? accountSid.slice(-6) : accountSid;
      const typeLabel =
        probe.accountType === 'Full'
          ? 'оплаченный (Full)'
          : probe.accountType === 'Trial'
            ? 'trial'
            : probe.accountType ?? 'неизвестно';

      if (testOnly) {
        return json(200, {
          ok: true,
          message: `Twilio: подключение OK. Тип аккаунта: ${typeLabel}. SID …${accountSidSuffix}`,
          accountSidMasked: accountSid.length > 4 ? `****${accountSid.slice(-4)}` : '****',
          accountSidSuffix,
          accountType: probe.accountType,
          accountStatus: probe.accountStatus,
          incomingVoiceCapable: probe.incomingVoiceCapable,
          voiceSanityOk: probe.incomingVoiceCapable > 0,
          voiceSanityHint:
            probe.incomingVoiceCapable === 0
              ? 'В этом Twilio-аккаунте не найдено входящих номеров с Voice — проверьте Phone Numbers в Console.'
              : null
        });
      }

      await setVoiceIntegration(companyId, {
        provider: 'twilio',
        enabled,
        accountSid,
        authToken,
        connectionStatus: 'connected',
        connectionError: null,
        lastCheckedAt: Timestamp.now(),
        twilioAccountType: probe.accountType,
        twilioAccountStatus: probe.accountStatus
      });
      return json(200, {
        ok: true,
        message: 'Voice интеграция сохранена',
        accountType: probe.accountType,
        accountStatus: probe.accountStatus,
        incomingVoiceCapable: probe.incomingVoiceCapable
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Проверка Twilio не пройдена';
      if (testOnly) return json(400, { ok: false, error: message });
      await setVoiceIntegration(companyId, {
        enabled: false,
        connectionStatus: 'invalid_config',
        connectionError: message,
        lastCheckedAt: Timestamp.now()
      });
      return json(400, { ok: false, error: message });
    }
  }

  if (testOnly) {
    return json(400, { ok: false, error: 'Укажите Account SID и Auth Token' });
  }

  return json(400, { error: 'Укажите Account SID и Auth Token' });
};
