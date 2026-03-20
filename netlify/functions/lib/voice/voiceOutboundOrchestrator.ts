import { FieldValue } from 'firebase-admin/firestore';
import {
  adminAppendVoiceCallEvent,
  adminCreateVoiceCallSession,
  adminGetDefaultVoiceNumberForCompany,
  adminGetVoiceNumberForCompany,
  adminUpdateVoiceCallSession
} from './voiceFirestoreAdmin';
import { buildVoiceProviderWebhookUrl, loadVoiceProviderRuntimeConfig } from './providerConfig';
import { getVoiceProviderAdapter } from './voiceProviderAdapter';
import { ingestNormalizedVoiceEvent } from './voiceWebhookIngest';

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
export type VoiceOutboundFailure = { ok: false; code: string; message: string; httpStatus: number };

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
      message: 'toE164 must be E.164 (+country...) 8–15 digits',
      httpStatus: 400
    };
  }

  let fromE164: string;
  let fromNumberId: string | null = body.fromNumberId?.trim() || null;

  if (fromNumberId) {
    const row = await adminGetVoiceNumberForCompany(companyId, fromNumberId);
    if (!row) {
      return {
        ok: false,
        code: 'voice_number_not_found',
        message: 'fromNumberId not found or wrong company',
        httpStatus: 400
      };
    }
    fromE164 = row.e164;
  } else {
    const row = await adminGetDefaultVoiceNumberForCompany(companyId);
    if (!row) {
      return {
        ok: false,
        code: 'no_voice_number',
        message:
          'No default voice number: add voiceNumbers with isDefault, or pass fromNumberId (Firestore Admin / seed).',
        httpStatus: 400
      };
    }
    fromE164 = row.e164;
    fromNumberId = row.id;
  }

  const config = loadVoiceProviderRuntimeConfig();
  let adapter;
  try {
    adapter = getVoiceProviderAdapter(config);
  } catch (e) {
    const msg = String(e);
    return {
      ok: false,
      code: 'voice_provider_unavailable',
      message: msg,
      httpStatus: 501
    };
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
    await adminUpdateVoiceCallSession(companyId, callId, {
      status: 'failed',
      endReason: adapterResult.error,
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
      payload: { error: adapterResult.error, code: adapterResult.code ?? null },
      seq: null
    });
    const code = adapterResult.code ?? 'adapter_reject';
    const configHttp =
      code === 'twilio_config' || code === 'twilio_public_url' ? 400 : code === 'twilio_api_error' ? 502 : 502;
    return {
      ok: false,
      code,
      message: adapterResult.error,
      httpStatus: configHttp
    };
  }

  await adminUpdateVoiceCallSession(companyId, callId, {
    providerCallId: adapterResult.providerCallId
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
