import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import twilio from 'twilio';
import {
  getCompanyIdForUser,
  getVoiceIntegration,
  setVoiceIntegration,
  getDb,
  mergeVoiceIntegrationTelnyx,
  setOutboundVoiceProviderPreference,
  verifyIdToken,
  type VoiceOutboundProviderPreference,
  type VoiceIntegrationRow
} from './lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { probeTelnyxApiKey } from './lib/voice/providers/telnyxVoiceProvider';
import { voiceFriendlyMessageRu } from './lib/voice/voiceProviderFriendlyCodes';

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

async function getDefaultNumberStatus(
  companyId: string,
  provider: 'twilio' | 'telnyx'
): Promise<{ hasDefaultOutbound: boolean; defaultNumberId: string | null }> {
  const db = getDb();
  const snap = await db.collection('voiceNumbers').where('companyId', '==', companyId).where('isDefault', '==', true).get();
  for (const doc of snap.docs) {
    const p = String(doc.data()?.provider ?? 'twilio').trim() || 'twilio';
    if (p === provider) {
      return { hasDefaultOutbound: true, defaultNumberId: doc.id };
    }
  }
  return { hasDefaultOutbound: false, defaultNumberId: null };
}

/** Нормализованный snapshot Telnyx для GET и вложения в общий ответ (лаунчер / UI). */
async function buildTelnyxReadinessSnapshot(
  companyId: string,
  row: VoiceIntegrationRow | null
): Promise<Record<string, unknown>> {
  const db = getDb();
  const allNums = await db.collection('voiceNumbers').where('companyId', '==', companyId).get();
  const hasAnyNumbers = allNums.docs.some(
    (d) => String(d.data()?.provider ?? 'twilio').trim() === 'telnyx'
  );
  const num = await getDefaultNumberStatus(companyId, 'telnyx');
  const hasKey = !!(row?.telnyxApiKey?.trim());
  const hasPub = !!(row?.telnyxPublicKey?.trim());
  const hasConnId = !!(row?.telnyxConnectionId?.trim());
  const connected = row?.telnyxConnectionStatus === 'connected';
  const enabled = row?.telnyxEnabled === true;
  const configured = !!(row && (hasKey || hasPub || hasConnId));

  const readinessMessages: string[] = [];
  if (!hasKey) readinessMessages.push('Сохраните API Key Telnyx.');
  if (!hasPub) readinessMessages.push('Сохраните Public Key (Ed25519) для проверки подписи webhook входящих событий.');
  if (!enabled) readinessMessages.push('Включите интеграцию Telnyx (переключатель «активна»).');
  if (row?.telnyxConnectionStatus === 'invalid_config') {
    readinessMessages.push(row?.telnyxConnectionError || 'Проверка API не пройдена — обновите ключи или нажмите «Проверить подключение».');
  }
  if (hasKey && hasPub && enabled && row?.telnyxConnectionStatus === 'not_connected') {
    readinessMessages.push('Нажмите «Проверить подключение» или сохраните интеграцию после ввода ключей.');
  }
  if (!hasConnId) {
    readinessMessages.push('Укажите Connection / Application ID (Call Control) для исходящих звонков.');
  }
  if (!hasAnyNumbers) {
    readinessMessages.push('Нет номеров Telnyx в CRM — нажмите «Синхронизировать номера» или добавьте номер вручную.');
  }
  if (!num.hasDefaultOutbound) {
    readinessMessages.push('Не выбран исходящий номер Telnyx по умолчанию.');
  }

  const webhookErr = row?.telnyxWebhookLastErrorCode ?? null;
  const webhookBlocksReady =
    webhookErr === 'provider_webhook_signature_invalid' ||
    webhookErr === 'provider_public_key_missing' ||
    webhookErr === 'provider_webhook_error';
  if (webhookErr && webhookBlocksReady) {
    readinessMessages.unshift(voiceFriendlyMessageRu(webhookErr));
  }

  const voiceReady =
    hasKey &&
    hasPub &&
    enabled &&
    connected &&
    hasConnId &&
    num.hasDefaultOutbound &&
    !webhookBlocksReady;

  const blockingReason: string | null = voiceReady
    ? null
    : webhookBlocksReady && webhookErr
      ? voiceFriendlyMessageRu(webhookErr)
      : readinessMessages[0] ?? 'Интеграция Telnyx не готова к исходящим звонкам.';

  const lastSyncedAt = row?.telnyxLastSyncedAt?.toDate?.()?.toISOString?.() ?? null;
  const lastCheckedAt = row?.telnyxLastCheckedAt?.toDate?.()?.toISOString?.() ?? null;
  const webhookLastErrorAt = row?.telnyxWebhookLastErrorAt?.toDate?.()?.toISOString?.() ?? null;

  return {
    provider: 'telnyx',
    providerId: 'telnyx',
    configured,
    enabled,
    connectionStatus: row?.telnyxConnectionStatus ?? 'not_connected',
    connectionError: row?.telnyxConnectionError ?? null,
    publicKeySet: hasPub,
    apiKeyMasked: row?.telnyxApiKeyMasked ?? null,
    connectionId: row?.telnyxConnectionId ?? null,
    hasAnyNumbers,
    hasDefaultOutbound: num.hasDefaultOutbound,
    defaultNumberId: num.defaultNumberId,
    voiceReady,
    readinessMessages,
    blockingReason,
    lastCheckedAt,
    lastSyncedAt,
    /** Последняя зафиксированная ошибка webhook (код нормализованный). */
    providerWebhookLastErrorCode: webhookErr,
    providerWebhookLastErrorAt: webhookLastErrorAt,
    webhookSignatureOk: !webhookBlocksReady,
    outboundVoiceProvider: row?.outboundVoiceProvider ?? 'twilio'
  };
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

  const providerQ = String(event.queryStringParameters?.provider ?? '').trim().toLowerCase();

  if (event.httpMethod === 'GET' && providerQ === 'telnyx') {
    const row = await getVoiceIntegration(companyId);
    const snapshot = await buildTelnyxReadinessSnapshot(companyId, row);
    return json(200, snapshot);
  }

  if (event.httpMethod === 'GET') {
    const row = await getVoiceIntegration(companyId);
    const num = await getDefaultNumberStatus(companyId, 'twilio');
    const telnyxSnap = await buildTelnyxReadinessSnapshot(companyId, row);
    const outbound: VoiceOutboundProviderPreference = row?.outboundVoiceProvider === 'telnyx' ? 'telnyx' : 'twilio';
    const connected = !!(row?.enabled && row.accountSid && row.authToken);
    const twilioReady = connected && num.hasDefaultOutbound;
    const activeOutboundVoiceReady =
      outbound === 'telnyx' ? telnyxSnap.voiceReady === true : twilioReady;
    return json(200, {
      provider: 'twilio',
      providerId: 'twilio',
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
      /** Готовность исходящих только для Twilio (обратная совместимость UI). */
      voiceReady: twilioReady,
      outboundVoiceProvider: outbound,
      telnyx: telnyxSnap,
      /** Активный outbound-провайдер: можно ли запускать исходящий звонок сейчас. */
      activeOutboundVoiceReady: activeOutboundVoiceReady
    });
  }

  let body: {
    accountSid?: string;
    authToken?: string;
    enabled?: boolean;
    testOnly?: boolean;
    provider?: string;
    apiKey?: string;
    publicKey?: string;
    connectionId?: string | null;
    outboundVoiceProvider?: VoiceOutboundProviderPreference;
    /** Только смена исходящего провайдера без сохранения секретов */
    action?: string;
  } = {};
  try {
    body = event.body ? (JSON.parse(event.body) as typeof body) : {};
  } catch {
    return json(400, { error: 'Неверный JSON' });
  }

  if (body.action === 'set_outbound_provider') {
    const pref = body.outboundVoiceProvider;
    if (pref !== 'twilio' && pref !== 'telnyx') {
      return json(400, { error: 'outboundVoiceProvider must be twilio or telnyx' });
    }
    await setOutboundVoiceProviderPreference(companyId, pref);
    return json(200, { ok: true, outboundVoiceProvider: pref });
  }

  if (String(body.provider ?? '').toLowerCase() === 'telnyx') {
    const apiKey = (body.apiKey ?? '').trim();
    const publicKey = (body.publicKey ?? '').trim();
    const testOnly = body.testOnly === true;
    const enabled = body.enabled !== false;
    const connectionId = body.connectionId != null ? String(body.connectionId).trim() || null : undefined;

    if (testOnly) {
      if (!apiKey) {
        return json(400, { ok: false, error: 'Для проверки Telnyx укажите API Key' });
      }
      const probe = await probeTelnyxApiKey(apiKey);
      if (!probe.ok) {
        await mergeVoiceIntegrationTelnyx(companyId, {
          telnyxConnectionStatus: 'invalid_config',
          telnyxConnectionError: probe.error,
          telnyxLastCheckedAt: Timestamp.now()
        });
        return json(400, { ok: false, error: probe.error });
      }
      await mergeVoiceIntegrationTelnyx(companyId, {
        telnyxConnectionStatus: 'connected',
        telnyxConnectionError: null,
        telnyxLastCheckedAt: Timestamp.now(),
        telnyxWebhookLastErrorCode: null,
        telnyxWebhookLastErrorAt: null,
        telnyxWebhookLastErrorDetail: null
      });
      return json(200, {
        ok: true,
        message: 'Telnyx: подключение по API Key проверено успешно'
      });
    }

    if (!apiKey || !publicKey) {
      return json(400, { error: 'Укажите API Key и Public Key Telnyx' });
    }

    const probe = await probeTelnyxApiKey(apiKey);
    if (!probe.ok) {
      await mergeVoiceIntegrationTelnyx(companyId, {
        telnyxEnabled: false,
        telnyxPublicKey: publicKey,
        telnyxConnectionStatus: 'invalid_config',
        telnyxConnectionError: probe.error,
        telnyxLastCheckedAt: Timestamp.now(),
        ...(connectionId !== undefined ? { telnyxConnectionId: connectionId } : {})
      });
      return json(400, { ok: false, error: probe.error });
    }

    await mergeVoiceIntegrationTelnyx(companyId, {
      telnyxEnabled: enabled,
      telnyxApiKey: apiKey,
      telnyxPublicKey: publicKey,
      telnyxConnectionStatus: 'connected',
      telnyxConnectionError: null,
      telnyxLastCheckedAt: Timestamp.now(),
      telnyxWebhookLastErrorCode: null,
      telnyxWebhookLastErrorAt: null,
      telnyxWebhookLastErrorDetail: null,
      ...(connectionId !== undefined ? { telnyxConnectionId: connectionId } : {}),
      ...(body.outboundVoiceProvider === 'twilio' || body.outboundVoiceProvider === 'telnyx'
        ? { outboundVoiceProvider: body.outboundVoiceProvider }
        : {})
    });
    return json(200, { ok: true, message: 'Telnyx интеграция сохранена' });
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
        twilioAccountStatus: probe.accountStatus,
        ...(body.outboundVoiceProvider === 'twilio' || body.outboundVoiceProvider === 'telnyx'
          ? { outboundVoiceProvider: body.outboundVoiceProvider }
          : {})
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
