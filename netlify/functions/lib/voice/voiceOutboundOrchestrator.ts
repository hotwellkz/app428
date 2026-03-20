import { FieldValue } from 'firebase-admin/firestore';
import { getVoiceIntegration } from '../firebaseAdmin';
import {
  adminAppendVoiceCallEvent,
  adminCreateVoiceCallSession,
  adminGetDefaultVoiceNumberForCompany,
  adminGetVoiceCallSession,
  adminGetVoiceNumberForCompany,
  adminUpdateVoiceCallSession,
  voiceNumberRowProvider
} from './voiceFirestoreAdmin';
import { buildVoiceProviderWebhookUrl, loadVoiceProviderRuntimeConfig } from './providerConfig';
import { resolveVoiceProviderForCompany } from './voiceProviderAdapter';
import { ingestNormalizedVoiceEvent } from './voiceWebhookIngest';
import { mergeVoiceLifecycleIntoLinkedRun } from './updateVoiceRunResult';

export type VoiceOutboundRequestBody = {
  botId: string;
  linkedRunId: string;
  toE164: string;
  contactId?: string | null;
  clientId?: string | null;
  crmClientId?: string | null;
  fromNumberId?: string | null;
  metadata?: Record<string, unknown>;
};

export type VoiceOutboundSuccess = { ok: true; callId: string; providerCallId: string };
export type VoiceOutboundFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
  /** Сессия уже создана до вызова Twilio — для диагностики в UI */
  callId?: string;
  friendlyCode?: string | null;
  hint?: string | null;
  twilioCode?: number | null;
};

/** Простая проверка E.164: + и 8–15 цифр после кода страны. */
export function normalizeToE164(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/\s/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) return null;
  return digits;
}

export async function orchestrateVoiceOutbound(
  companyId: string,
  body: VoiceOutboundRequestBody
): Promise<VoiceOutboundSuccess | VoiceOutboundFailure> {
  const botId = String(body.botId ?? '').trim();
  const linkedRunId = String(body.linkedRunId ?? '').trim();
  if (!botId) {
    return { ok: false, code: 'bot_id_required', message: 'botId is required', httpStatus: 400 };
  }
  if (!linkedRunId) {
    return { ok: false, code: 'linked_run_id_required', message: 'linkedRunId is required', httpStatus: 400 };
  }

  const toE164 = normalizeToE164(body.toE164);
  if (!toE164) {
    return {
      ok: false,
      code: 'invalid_to_e164',
      message: 'Неверный номер клиента (To): нужен формат E.164',
      httpStatus: 400,
      friendlyCode: 'twilio_invalid_to',
      hint: 'Укажите номер в формате E.164, например +77001234567.'
    };
  }

  let fromE164: string;
  let fromNumberId: string | null = body.fromNumberId?.trim() || null;

  const config = loadVoiceProviderRuntimeConfig();
  let adapter;
  try {
    adapter = await resolveVoiceProviderForCompany(companyId, config);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: 'voice_provider_unavailable',
      message: msg,
      httpStatus: 400,
      friendlyCode: 'provider_connection_missing',
      hint: 'Включите Telnyx (API Key + Public Key) или выберите Twilio как исходящий провайдер в Интеграциях.'
    };
  }

  const expectedProvider = adapter.providerId;

  const integrationRow = await getVoiceIntegration(companyId);
  if (expectedProvider === 'telnyx' && integrationRow) {
    if (!integrationRow.telnyxConnectionId?.trim()) {
      return {
        ok: false,
        code: 'telnyx_connection_id_required',
        message:
          'Для исходящих через Telnyx укажите Connection / Application ID (Call Control) в разделе Интеграций.',
        httpStatus: 400,
        friendlyCode: 'provider_connection_missing',
        hint: 'Это поле нужно для Telnyx POST /v2/calls.'
      };
    }
    if (integrationRow.telnyxConnectionStatus !== 'connected') {
      return {
        ok: false,
        code: 'telnyx_not_ready',
        message:
          'Telnyx не готов к звонкам: сначала нажмите «Проверить подключение» или сохраните корректные ключи.',
        httpStatus: 400,
        friendlyCode: 'provider_auth_error',
        hint: integrationRow.telnyxConnectionError ?? undefined
      };
    }
  }

  if (fromNumberId) {
    const row = await adminGetVoiceNumberForCompany(companyId, fromNumberId);
    if (!row) {
      return {
        ok: false,
        code: 'voice_number_not_found',
        message: 'Указанный номер не найден или не принадлежит компании.',
        httpStatus: 400,
        friendlyCode: 'voice_number_not_found',
        hint: 'Выберите номер из списка Интеграций для текущего провайдера.'
      };
    }
    const numProv = voiceNumberRowProvider(row.data);
    if (numProv !== expectedProvider) {
      return {
        ok: false,
        code: 'voice_number_provider_mismatch',
        message: `Номер относится к «${numProv}», а исходящий канал — «${expectedProvider}». Выберите совместимый номер или смените провайдер в Интеграциях.`,
        httpStatus: 400,
        friendlyCode: 'voice_number_provider_mismatch',
        hint: 'Исходящий номер должен совпадать с выбранным outbound-провайдером.'
      };
    }
    fromE164 = row.e164;
  } else {
    const row = await adminGetDefaultVoiceNumberForCompany(companyId, expectedProvider);
    if (!row) {
      return {
        ok: false,
        code: 'no_voice_number',
        message:
          expectedProvider === 'telnyx'
            ? 'Нет исходящего номера Telnyx по умолчанию: синхронизируйте номера в Интеграциях и назначьте default.'
            : 'Нет исходящего номера Twilio по умолчанию: добавьте номер в Интеграциях и назначьте default.',
        httpStatus: 400,
        friendlyCode: 'provider_default_number_missing',
        hint: 'Либо передайте fromNumberId явно при запуске звонка.'
      };
    }
    fromE164 = row.e164;
    fromNumberId = row.id;
  }

  const webhookUrl = buildVoiceProviderWebhookUrl(config);

  const callId = await adminCreateVoiceCallSession({
    companyId,
    botId,
    channel: 'voice',
    direction: 'outbound',
    status: 'queued',
    provider: adapter.providerId,
    providerCallId: null,
    toE164,
    fromE164,
    fromNumberId,
    linkedRunId,
    contactId: body.contactId ?? null,
    clientId: body.clientId ?? null,
    crmClientId: body.crmClientId ?? null,
    conversationId: null,
    postCallStatus: 'pending',
    metadata: body.metadata ?? {},
    startedAt: FieldValue.serverTimestamp()
  });

  const lineageIn =
    body.metadata?.voiceLineage && typeof body.metadata.voiceLineage === 'object'
      ? (body.metadata.voiceLineage as Record<string, unknown>)
      : {};
  const rootCallId = lineageIn.rootCallId != null ? String(lineageIn.rootCallId) : callId;
  const parentCallId = lineageIn.parentCallId != null ? String(lineageIn.parentCallId) : null;
  await adminUpdateVoiceCallSession(companyId, callId, {
    'metadata.voiceLineage.rootCallId': rootCallId,
    'metadata.voiceLineage.parentCallId': parentCallId
  });

  await adminAppendVoiceCallEvent(companyId, callId, {
    type: 'enqueue',
    providerEventType: 'orchestrator.enqueue',
    providerCallId: null,
    fromStatus: null,
    toStatus: 'queued',
    at: FieldValue.serverTimestamp(),
    payload: { source: 'voice-outbound-call' },
    seq: null
  });

  const adapterResult = await adapter.createOutboundCall({
    companyId,
    botId,
    callId,
    linkedRunId,
    toE164,
    fromE164,
    fromNumberId,
    webhookUrl,
    metadata: body.metadata,
    config
  });

  if (!adapterResult.ok) {
    const friendly = adapterResult.friendlyCode ?? null;
    const hint = adapterResult.hint ?? null;
    const failCode = adapterResult.code ?? 'adapter_reject';

    console.log(
      JSON.stringify({
        tag: 'voice.outbound',
        ok: false,
        companyId,
        callId,
        linkedRunId,
        toE164,
        fromE164,
        fromNumberId,
        adapterCode: failCode,
        friendlyCode: friendly,
        twilioCode: adapterResult.twilioCode ?? null,
        twilioStatus: adapterResult.twilioStatus ?? null
      })
    );

    await adminUpdateVoiceCallSession(companyId, callId, {
      status: 'failed',
      endReason: friendly ?? failCode,
      providerCreateFailed: true,
      providerCreateFriendlyCode: friendly,
      providerCreateTwilioCode: adapterResult.twilioCode ?? null,
      providerCreateTwilioStatus: adapterResult.twilioStatus ?? null,
      providerCreateUserMessage: adapterResult.error,
      providerCreateRawMessage: adapterResult.rawProviderMessage ?? null,
      providerFailureCode: adapterResult.providerFailureCode ?? failCode,
      providerFailureReason: adapterResult.providerFailureReason ?? adapterResult.error,
      voiceProviderId: expectedProvider,
      providerDebug: adapterResult.providerDebug ?? null,
      endedAt: FieldValue.serverTimestamp(),
      postCallStatus: 'pending'
    });
    await adminAppendVoiceCallEvent(companyId, callId, {
      type: 'provider.failed',
      providerEventType: 'adapter.create_failed',
      providerCallId: null,
      fromStatus: 'queued',
      toStatus: 'failed',
      at: FieldValue.serverTimestamp(),
      payload: {
        error: adapterResult.error,
        code: failCode,
        friendlyCode: friendly,
        twilioCode: adapterResult.twilioCode ?? null,
        twilioStatus: adapterResult.twilioStatus ?? null,
        hint,
        rawMessage: adapterResult.rawProviderMessage ?? null
      },
      seq: null
    });
    const configHttp =
      failCode === 'twilio_config' ||
      failCode === 'twilio_public_url' ||
      failCode === 'twilio_company_config_incomplete' ||
      failCode === 'telnyx_company_config_incomplete' ||
      failCode === 'telnyx_connection_id_required' ||
      failCode === 'telnyx_public_url'
        ? 400
        : failCode === 'twilio_api_error'
          ? friendly === 'twilio_auth_error'
            ? 401
            : 400
          : failCode === 'telnyx_api_error'
            ? 502
            : 502;
    return {
      ok: false,
      code: failCode,
      message: adapterResult.error,
      httpStatus: configHttp,
      callId,
      friendlyCode: friendly ?? adapterResult.providerFailureCode ?? null,
      hint,
      twilioCode: adapterResult.twilioCode ?? null
    };
  }

  console.log(
    JSON.stringify({
      tag: 'voice.outbound',
      ok: true,
      companyId,
      callId,
      linkedRunId,
      toE164,
      fromE164,
      fromNumberId,
      providerCallId: adapterResult.providerCallId
    })
  );

  const sessAfterCreate = await adminGetVoiceCallSession(companyId, callId);
  const prevMeta = ((sessAfterCreate?.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const prevDebug = (prevMeta.voiceProviderDebug as Record<string, unknown> | undefined) ?? {};
  const createDbg = adapterResult.providerDebug ?? {};
  await adminUpdateVoiceCallSession(companyId, callId, {
    providerCallId: adapterResult.providerCallId,
    metadata: {
      ...prevMeta,
      voiceProviderDebug: {
        ...prevDebug,
        ...createDbg,
        outboundCreateAt: new Date().toISOString(),
        createProvider: adapter.providerId,
        createProviderCallId: adapterResult.providerCallId,
        createFrom: fromE164,
        createTo: toE164,
        createTwilioStatus: adapterResult.raw?.status ?? null,
        createResponse: adapterResult.raw ?? null
      }
    }
  });
  await mergeVoiceLifecycleIntoLinkedRun({
    companyId,
    linkedRunId,
    voiceCallSnapshot: {
      callStatus: 'dialing',
      outcome: null,
      postCallStatus: 'pending',
      providerCallId: adapterResult.providerCallId,
      provider: adapter.providerId,
      fromE164,
      toE164,
      followUpStatus: null,
      followUpError: null,
      durationSec: 0,
      hadInProgress: false
    }
  });

  await ingestNormalizedVoiceEvent({
    type: 'provider.accepted',
    providerCallId: adapterResult.providerCallId,
    occurredAt: new Date().toISOString(),
    cause: null,
    providerEventType: 'adapter.createOutboundCall',
    durationSec: null,
    rawDigest: `outbound:accept:${callId}`,
    providerEventId: `outbound:provider.accepted:${adapterResult.providerCallId}`
  });

  return { ok: true, callId, providerCallId: adapterResult.providerCallId };
}
