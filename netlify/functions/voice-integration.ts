import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import twilio from 'twilio';
import {
  getCompanyIdForUser,
  getVoiceIntegration,
  setVoiceIntegration,
  getDb,
  mergeVoiceIntegrationTelnyx,
  mergeVoiceIntegrationZadarma,
  setOutboundVoiceProviderPreference,
  verifyIdToken,
  type VoiceOutboundProviderPreference,
  type VoiceIntegrationRow
} from './lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  probeTelnyxApiKey,
  fetchTelnyxCallControlApplication,
  validateTelnyxCallControlWebhookForCrm,
  normalizeTelnyxCallControlApplicationId
} from './lib/voice/providers/telnyxVoiceProvider';
import {
  fetchZadarmaPhoneNumbers,
  probeZadarmaCredentials
} from './lib/voice/providers/zadarmaVoiceProvider';
import { voiceFriendlyMessageRu } from './lib/voice/voiceProviderFriendlyCodes';
import { buildVoiceProviderWebhookUrl, loadVoiceProviderRuntimeConfig } from './lib/voice/providerConfig';

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

async function validateTelnyxCallControlId(
  apiKey: string,
  connectionIdRaw: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (connectionIdRaw == null) return { ok: true };
  const raw = String(connectionIdRaw).trim();
  if (!raw) return { ok: true };
  const cid = normalizeTelnyxCallControlApplicationId(raw);
  if (!cid) return { ok: true };
  const app = await fetchTelnyxCallControlApplication(apiKey, cid);
  if (!app.ok) return { ok: false, error: app.error };
  const wh = validateTelnyxCallControlWebhookForCrm(app.webhookEventUrl);
  if (!wh.ok) return { ok: false, error: wh.error };
  return { ok: true };
}

async function getDefaultNumberStatus(
  companyId: string,
  provider: 'twilio' | 'telnyx' | 'zadarma'
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

  /** Тот же базовый URL, что уходит в Telnyx POST /v2/calls (без ?companyId=&callId=). Его нужно указать в Mission Control → Call Control Application → Webhook. */
  const cfg = loadVoiceProviderRuntimeConfig();
  const whBuilt = buildVoiceProviderWebhookUrl(cfg);
  const outboundWebhookBaseUrl = whBuilt.startsWith('http') ? whBuilt : null;

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
    outboundVoiceProvider: row?.outboundVoiceProvider ?? 'twilio',
    outboundWebhookBaseUrl
  };
}

async function buildZadarmaReadinessSnapshot(
  companyId: string,
  row: VoiceIntegrationRow | null
): Promise<Record<string, unknown>> {
  const db = getDb();
  const allNums = await db.collection('voiceNumbers').where('companyId', '==', companyId).get();
  const hasAnyNumbers = allNums.docs.some(
    (d) => String(d.data()?.provider ?? 'twilio').trim() === 'zadarma'
  );
  const num = await getDefaultNumberStatus(companyId, 'zadarma');
  const hasKey = !!(row?.zadarmaKey?.trim());
  const hasSecret = !!(row?.zadarmaSecret?.trim());
  const hasExt = !!(row?.zadarmaCallbackExtension?.trim());
  const connected = row?.zadarmaConnectionStatus === 'connected';
  const enabled = row?.zadarmaEnabled === true;
  const configured = !!(row && (hasKey || hasSecret || hasExt));

  const readinessMessages: string[] = [];
  if (!hasKey) readinessMessages.push('Сохраните Zadarma API Key (user key).');
  if (!hasSecret) readinessMessages.push('Сохраните Zadarma Secret Key.');
  if (!enabled) readinessMessages.push('Включите интеграцию Zadarma.');
  if (row?.zadarmaConnectionStatus === 'invalid_config') {
    readinessMessages.push(row?.zadarmaConnectionError || 'Проверка не пройдена — нажмите «Проверить подключение».');
  }
  if (hasKey && hasSecret && enabled && row?.zadarmaConnectionStatus === 'not_connected') {
    readinessMessages.push('Нажмите «Проверить подключение» после ввода ключей.');
  }
  if (!hasExt) {
    readinessMessages.push(
      'Укажите внутренний номер АТС (extension) для CallBack — первый вызов request/callback (параметр from).'
    );
  }
  if (!hasAnyNumbers) {
    readinessMessages.push('Нет номеров Zadarma в CRM — нажмите «Синхронизировать номера».');
  }
  if (!num.hasDefaultOutbound) {
    readinessMessages.push('Не выбран исходящий номер Zadarma по умолчанию.');
  }

  const webhookErr = row?.zadarmaWebhookLastErrorCode ?? null;
  const webhookBlocksReady =
    webhookErr === 'provider_webhook_signature_invalid' ||
    webhookErr === 'webhook_signature_invalid' ||
    webhookErr === 'provider_webhook_error' ||
    webhookErr === 'webhook_match_failed';
  if (webhookErr && webhookBlocksReady) {
    readinessMessages.unshift(voiceFriendlyMessageRu(webhookErr));
  }

  const cfg = loadVoiceProviderRuntimeConfig();
  const whBuilt = buildVoiceProviderWebhookUrl(cfg);
  const outboundWebhookBaseUrl = whBuilt.startsWith('http') ? whBuilt : null;
  const webhookHint = outboundWebhookBaseUrl
    ? `${outboundWebhookBaseUrl}?companyId=${encodeURIComponent(companyId)}`
    : null;

  readinessMessages.push(
    'В личном кабинете Zadarma → Настройки → Уведомления АТС укажите URL webhook с параметром companyId (см. подсказку ниже) и включите NOTIFY_OUT_START / NOTIFY_OUT_END.'
  );

  const voiceReady =
    hasKey &&
    hasSecret &&
    enabled &&
    connected &&
    hasExt &&
    num.hasDefaultOutbound &&
    !webhookBlocksReady;

  const blockingReason: string | null = voiceReady
    ? null
    : webhookBlocksReady && webhookErr
      ? voiceFriendlyMessageRu(webhookErr)
      : readinessMessages[0] ?? 'Интеграция Zadarma не готова к исходящим звонкам.';

  return {
    provider: 'zadarma',
    providerId: 'zadarma',
    configured,
    enabled,
    connectionStatus: row?.zadarmaConnectionStatus ?? 'not_connected',
    connectionError: row?.zadarmaConnectionError ?? null,
    keyMasked: row?.zadarmaKeyMasked ?? null,
    secretMasked: row?.zadarmaSecretMasked ?? null,
    callbackExtension: row?.zadarmaCallbackExtension ?? null,
    predicted: row?.zadarmaPredicted === true,
    hasAnyNumbers,
    hasDefaultOutbound: num.hasDefaultOutbound,
    defaultNumberId: num.defaultNumberId,
    voiceReady,
    readinessMessages,
    blockingReason,
    lastCheckedAt: row?.zadarmaLastCheckedAt?.toDate?.()?.toISOString?.() ?? null,
    lastSyncedAt: row?.zadarmaLastSyncedAt?.toDate?.()?.toISOString?.() ?? null,
    providerWebhookLastErrorCode: webhookErr,
    providerWebhookLastErrorAt: row?.zadarmaWebhookLastErrorAt?.toDate?.()?.toISOString?.() ?? null,
    webhookSignatureOk: !webhookBlocksReady,
    outboundWebhookUrlHint: webhookHint,
    zdEchoNote:
      'Для проверки URL в Zadarma поддерживается GET ?zd_echo=… — endpoint voice-provider-webhook отвечает эхом.',
    apiKeySet: hasKey,
    apiSecretSet: hasSecret,
    extensionSet: hasExt,
    webhookUrlHintReady: !!webhookHint,
    defaultOutboundSelected: row?.outboundVoiceProvider === 'zadarma',
    lastWebhookReceivedAt: row?.zadarmaLastWebhookAt?.toDate?.()?.toISOString?.() ?? null,
    lastWebhookEventType: row?.zadarmaLastWebhookEventType ?? null,
    lastWebhookSignatureOk:
      row?.zadarmaLastWebhookSignatureOk === true || row?.zadarmaLastWebhookSignatureOk === false
        ? row.zadarmaLastWebhookSignatureOk
        : null,
    lastOutboundAttemptAt: row?.zadarmaLastOutboundAttemptAt?.toDate?.()?.toISOString?.() ?? null,
    lastOutboundOk:
      row?.zadarmaLastOutboundOk === true || row?.zadarmaLastOutboundOk === false ? row.zadarmaLastOutboundOk : null,
    lastOutboundFriendlyCode: row?.zadarmaLastOutboundFriendlyCode ?? null
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

  if (event.httpMethod === 'GET' && providerQ === 'zadarma') {
    const row = await getVoiceIntegration(companyId);
    const snapshot = await buildZadarmaReadinessSnapshot(companyId, row);
    return json(200, snapshot);
  }

  if (event.httpMethod === 'GET') {
    const row = await getVoiceIntegration(companyId);
    const num = await getDefaultNumberStatus(companyId, 'twilio');
    const telnyxSnap = await buildTelnyxReadinessSnapshot(companyId, row);
    const zadarmaSnap = await buildZadarmaReadinessSnapshot(companyId, row);
    const outbound: VoiceOutboundProviderPreference =
      row?.outboundVoiceProvider === 'telnyx'
        ? 'telnyx'
        : row?.outboundVoiceProvider === 'zadarma'
          ? 'zadarma'
          : 'twilio';
    const connected = !!(row?.enabled && row.accountSid && row.authToken);
    const twilioReady = connected && num.hasDefaultOutbound;
    const activeOutboundVoiceReady =
      outbound === 'telnyx'
        ? telnyxSnap.voiceReady === true
        : outbound === 'zadarma'
          ? zadarmaSnap.voiceReady === true
          : twilioReady;
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
      zadarma: zadarmaSnap,
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
    if (pref !== 'twilio' && pref !== 'telnyx' && pref !== 'zadarma') {
      return json(400, { error: 'outboundVoiceProvider must be twilio, telnyx or zadarma' });
    }
    await setOutboundVoiceProviderPreference(companyId, pref);
    return json(200, { ok: true, outboundVoiceProvider: pref });
  }

  if (String(body.provider ?? '').toLowerCase() === 'zadarma') {
    const existingRow = await getVoiceIntegration(companyId);
    const keyFromBody = (body as { zadarmaKey?: string }).zadarmaKey ?? '';
    const secretFromBody = (body as { zadarmaSecret?: string }).zadarmaSecret ?? '';
    const extFromBody = (body as { zadarmaCallbackExtension?: string | null }).zadarmaCallbackExtension;
    const predictedFromBody = (body as { zadarmaPredicted?: boolean }).zadarmaPredicted;

    const key = String(keyFromBody).trim() || existingRow?.zadarmaKey?.trim() || '';
    const secret = String(secretFromBody).trim() || existingRow?.zadarmaSecret?.trim() || '';
    const testOnly = body.testOnly === true;
    const enabled = body.enabled !== false;
    const callbackExtension =
      extFromBody !== undefined
        ? String(extFromBody ?? '')
            .trim()
            ? String(extFromBody).trim()
            : null
        : undefined;

    if (testOnly) {
      if (!key || !secret) {
        return json(400, {
          ok: false,
          error: 'Для проверки Zadarma укажите Key и Secret в полях или сохраните их ранее',
          code: 'zadarma_credentials_missing'
        });
      }
      const probe = await probeZadarmaCredentials(key, secret);
      if (!probe.ok) {
        await mergeVoiceIntegrationZadarma(companyId, {
          zadarmaConnectionStatus: 'invalid_config',
          zadarmaConnectionError: probe.error,
          zadarmaLastCheckedAt: Timestamp.now()
        });
        return json(400, { ok: false, error: probe.error, code: 'zadarma_auth_failed' });
      }
      const nums = await fetchZadarmaPhoneNumbers(key, secret);
      const numCount = nums.ok ? nums.numbers.length : 0;
      await mergeVoiceIntegrationZadarma(companyId, {
        zadarmaConnectionStatus: 'connected',
        zadarmaConnectionError: null,
        zadarmaLastCheckedAt: Timestamp.now(),
        zadarmaWebhookLastErrorCode: null,
        zadarmaWebhookLastErrorAt: null,
        zadarmaWebhookLastErrorDetail: null
      });
      return json(200, {
        ok: true,
        message:
          numCount > 0
            ? `Zadarma: ключи OK, в аккаунте найдено виртуальных номеров: ${numCount}`
            : 'Zadarma: ключи OK (виртуальные номера не найдены — проверьте раздел Numbers в Zadarma)',
        directNumbersCount: numCount
      });
    }

    if (!key || !secret) {
      return json(400, {
        error: 'Укажите Zadarma Key и Secret (при первом подключении) или выполните проверку после сохранения.',
        code: 'zadarma_credentials_missing'
      });
    }

    const probe = await probeZadarmaCredentials(key, secret);
    if (!probe.ok) {
      await mergeVoiceIntegrationZadarma(companyId, {
        zadarmaEnabled: false,
        zadarmaKey: key,
        zadarmaSecret: secret,
        zadarmaConnectionStatus: 'invalid_config',
        zadarmaConnectionError: probe.error,
        zadarmaLastCheckedAt: Timestamp.now(),
        ...(callbackExtension !== undefined ? { zadarmaCallbackExtension: callbackExtension } : {}),
        ...(predictedFromBody !== undefined ? { zadarmaPredicted: predictedFromBody === true } : {})
      });
      return json(400, { ok: false, error: probe.error, code: 'zadarma_auth_failed' });
    }

    await mergeVoiceIntegrationZadarma(companyId, {
      zadarmaEnabled: enabled,
      zadarmaKey: key,
      zadarmaSecret: secret,
      zadarmaConnectionStatus: 'connected',
      zadarmaConnectionError: null,
      zadarmaLastCheckedAt: Timestamp.now(),
      zadarmaWebhookLastErrorCode: null,
      zadarmaWebhookLastErrorAt: null,
      zadarmaWebhookLastErrorDetail: null,
      ...(callbackExtension !== undefined ? { zadarmaCallbackExtension: callbackExtension } : {}),
      ...(predictedFromBody !== undefined ? { zadarmaPredicted: predictedFromBody === true } : {}),
      ...(body.outboundVoiceProvider === 'twilio' ||
      body.outboundVoiceProvider === 'telnyx' ||
      body.outboundVoiceProvider === 'zadarma'
        ? { outboundVoiceProvider: body.outboundVoiceProvider }
        : {})
    });
    return json(200, { ok: true, message: 'Zadarma интеграция сохранена' });
  }

  if (String(body.provider ?? '').toLowerCase() === 'telnyx') {
    const existingRow = await getVoiceIntegration(companyId);
    const apiKeyFromBody = (body.apiKey ?? '').trim();
    const publicKeyFromBody = (body.publicKey ?? '').trim();
    /** Пустые поля после «Сохранить» на клиенте — подставляем уже сохранённые в Firestore. */
    const apiKey = apiKeyFromBody || existingRow?.telnyxApiKey?.trim() || '';
    const publicKey = publicKeyFromBody || existingRow?.telnyxPublicKey?.trim() || '';
    const testOnly = body.testOnly === true;
    const enabled = body.enabled !== false;
    const connectionId =
      body.connectionId != null
        ? String(body.connectionId).trim()
          ? normalizeTelnyxCallControlApplicationId(String(body.connectionId)) || null
          : null
        : undefined;

    if (testOnly) {
      if (!apiKey) {
        return json(400, {
          ok: false,
          error: 'Для проверки Telnyx укажите API Key в поле или сначала сохраните ключ в интеграции'
        });
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
      const ccCheck = await validateTelnyxCallControlId(apiKey, connectionId);
      if (!ccCheck.ok) {
        await mergeVoiceIntegrationTelnyx(companyId, {
          telnyxConnectionStatus: 'invalid_config',
          telnyxConnectionError: ccCheck.error,
          telnyxLastCheckedAt: Timestamp.now()
        });
        return json(400, { ok: false, error: ccCheck.error });
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
        message:
          connectionId
            ? 'Telnyx: API Key и Call Control Application (webhook) проверены успешно'
            : 'Telnyx: подключение по API Key проверено успешно (добавьте Connection ID для проверки приложения)'
      });
    }

    if (!apiKey || !publicKey) {
      return json(400, {
        error:
          'Укажите API Key и Public Key Telnyx в полях формы (при первом подключении) или сохраните их один раз — дальше можно менять только Connection ID и переключатель без повторного ввода ключей.'
      });
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

    const ccCheck = await validateTelnyxCallControlId(apiKey, connectionId);
    if (!ccCheck.ok) {
      await mergeVoiceIntegrationTelnyx(companyId, {
        telnyxEnabled: false,
        telnyxPublicKey: publicKey,
        telnyxConnectionStatus: 'invalid_config',
        telnyxConnectionError: ccCheck.error,
        telnyxLastCheckedAt: Timestamp.now(),
        ...(connectionId !== undefined ? { telnyxConnectionId: connectionId } : {})
      });
      return json(400, { ok: false, error: ccCheck.error });
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
      ...(body.outboundVoiceProvider === 'twilio' ||
      body.outboundVoiceProvider === 'telnyx' ||
      body.outboundVoiceProvider === 'zadarma'
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
        ...(body.outboundVoiceProvider === 'twilio' ||
        body.outboundVoiceProvider === 'telnyx' ||
        body.outboundVoiceProvider === 'zadarma'
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
