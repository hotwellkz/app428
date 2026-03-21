import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getVoiceIntegration, mergeVoiceIntegrationZadarma } from '../firebaseAdmin';
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
  /** Явный исходящий провайдер (multi-provider UI). */
  outboundVoiceProvider?: 'twilio' | 'telnyx' | 'zadarma' | null;
  /** Алиас для outboundVoiceProvider */
  providerId?: 'twilio' | 'telnyx' | 'zadarma' | string | null;
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
  const rawProv = body.outboundVoiceProvider ?? body.providerId;
  const requestedProvider: 'twilio' | 'telnyx' | 'zadarma' | null =
    rawProv === 'telnyx' || rawProv === 'twilio' || rawProv === 'zadarma' ? rawProv : null;

  let adapter;
  try {
    adapter = await resolveVoiceProviderForCompany(companyId, config, { requestedProvider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: 'voice_provider_unavailable',
      message: msg,
      httpStatus: 400,
      friendlyCode: 'provider_connection_missing',
      hint: 'Включите нужного провайдера (Twilio / Telnyx / Zadarma) в Интеграциях или смените исходящий канал.'
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

  if (expectedProvider === 'zadarma' && integrationRow) {
    if (!integrationRow.zadarmaCallbackExtension?.trim()) {
      return {
        ok: false,
        code: 'zadarma_callback_extension_required',
        message:
          'Для Zadarma укажите внутренний номер АТС (extension) для первого вызова CallBack — см. поле в Интеграциях.',
        httpStatus: 400,
        friendlyCode: 'provider_connection_missing',
        hint: 'По документации Zadarma это параметр from в request/callback.'
      };
    }
    if (integrationRow.zadarmaConnectionStatus !== 'connected') {
      return {
        ok: false,
        code: 'zadarma_not_ready',
        message:
          'Zadarma не готова: нажмите «Проверить подключение» или сохраните корректные Key / Secret.',
        httpStatus: 400,
        friendlyCode: 'provider_auth_error',
        hint: integrationRow.zadarmaConnectionError ?? undefined
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
            : expectedProvider === 'zadarma'
              ? 'Нет номера Zadarma по умолчанию: синхронизируйте номера в Интеграциях и назначьте default.'
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

  const baseMeta =
    body.metadata && typeof body.metadata === 'object' ? (body.metadata as Record<string, unknown>) : {};
  const prevSel =
    baseMeta.voiceLaunchSelection && typeof baseMeta.voiceLaunchSelection === 'object'
      ? (baseMeta.voiceLaunchSelection as Record<string, unknown>)
      : {};
  const mergedMeta: Record<string, unknown> = {
    ...baseMeta,
    voiceLaunchSelection: {
      ...prevSel,
      selectedProviderId: expectedProvider,
      selectedFromNumberId: fromNumberId,
      selectedFromE164: fromE164
    }
  };

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
    metadata: mergedMeta,
    startedAt: FieldValue.serverTimestamp()
  });

  const lineageIn =
    mergedMeta.voiceLineage && typeof mergedMeta.voiceLineage === 'object'
      ? (mergedMeta.voiceLineage as Record<string, unknown>)
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
    metadata: mergedMeta,
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

    if (expectedProvider === 'zadarma') {
      try {
        await mergeVoiceIntegrationZadarma(companyId, {
          zadarmaLastOutboundAttemptAt: Timestamp.now(),
          zadarmaLastOutboundOk: false,
          zadarmaLastOutboundFriendlyCode: friendly ?? adapterResult.providerFailureCode ?? failCode
        });
      } catch {
        /* ignore merge telemetry */
      }
    }

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
    const telnyxUpstreamStatus =
      adapterResult.providerDebug && typeof adapterResult.providerDebug === 'object'
        ? (adapterResult.providerDebug as Record<string, unknown>).status
        : undefined;
    const telnyxSt = typeof telnyxUpstreamStatus === 'number' ? telnyxUpstreamStatus : null;

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
            ? telnyxSt != null && telnyxSt >= 400 && telnyxSt < 500
              ? telnyxSt === 401 || telnyxSt === 403
                ? 401
                : 400
              : 502
            : failCode === 'zadarma_api_error' || failCode.startsWith('zadarma_')
              ? 400
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
  if (expectedProvider === 'zadarma') {
    try {
      await mergeVoiceIntegrationZadarma(companyId, {
        zadarmaLastOutboundAttemptAt: Timestamp.now(),
        zadarmaLastOutboundOk: true,
        zadarmaLastOutboundFriendlyCode: null
      });
    } catch {
      /* ignore merge telemetry */
    }
  }
  await adminUpdateVoiceCallSession(companyId, callId, {
    providerCallId: adapterResult.providerCallId,
    metadata: {
      ...prevMeta,
      ...(expectedProvider === 'zadarma'
        ? {
            zadarmaCrmPendingProviderCallId: adapterResult.providerCallId,
            zadarmaCallbackExtensionUsed: integrationRow?.zadarmaCallbackExtension ?? null
          }
        : {}),
      voiceProviderDebug: {
        ...prevDebug,
        ...createDbg,
        outboundCreateAt: new Date().toISOString(),
        createProvider: adapter.providerId,
        createProviderCallId: adapterResult.providerCallId,
        createFrom: fromE164,
        createTo: toE164,
        createTwilioStatus: adapterResult.raw?.status ?? null,
        createResponse:
          expectedProvider === 'zadarma' && adapterResult.raw && typeof adapterResult.raw === 'object'
            ? {
                status: adapterResult.raw.status ?? null,
                keys: Object.keys(adapterResult.raw).slice(0, 40)
              }
            : adapterResult.raw ?? null
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
