import twilio from 'twilio';
import type { VoiceNormalizedWebhookEvent } from '../../../../../src/types/voice';
import type {
  CreateOutboundVoiceCallInput,
  CreateOutboundVoiceCallResult,
  VoiceProviderAdapter,
  VoiceWebhookParseInput
} from '../voiceProviderAdapter';
import {
  assertTwilioOutboundConfig,
  assertTwilioPublicUrls,
  buildTwilioStatusCallbackValidationUrl,
  buildVoiceTwilioTwimlUrl,
  resolveTwilioWebhookRequestUrl,
  type VoiceProviderRuntimeConfig
} from '../providerConfig';
import { getVoiceIntegration } from '../../firebaseAdmin';
import { mapTwilioVoiceCreateError } from '../deriveTwilioVoiceFriendlyError';

const PROVIDER_ID = 'twilio';

function parseFormBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function metadataToStringRecord(meta?: Record<string, unknown>): Record<string, string> | null {
  if (!meta || typeof meta !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (!s.trim() || s.length > 800) continue;
    out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Стабильный ключ дедупа: один статус на звонок (повтор webhook → тот же id).
 */
function twilioProviderEventId(callSid: string, callStatus: string): string {
  return `twilio:${callSid}:${callStatus}`;
}

function mapTwilioCallStatusToEvent(
  callSid: string,
  status: string,
  duration: string | undefined,
  timestamp: string | undefined
): VoiceNormalizedWebhookEvent | null {
  /** После REST create оркестратор уже пишет provider.accepted — дубли не нужны. */
  if (status === 'initiated' || status === 'queued' || status === 'initiating') {
    return null;
  }

  const occurredAt =
    timestamp?.trim() && Number.isFinite(Date.parse(timestamp))
      ? new Date(Date.parse(timestamp)).toISOString()
      : new Date().toISOString();

  const durRaw = duration != null && duration !== '' ? Number(duration) : undefined;
  const dur = Number.isFinite(durRaw) ? durRaw : undefined;

  const providerEventId = twilioProviderEventId(callSid, status);
  const base: VoiceNormalizedWebhookEvent = {
    providerCallId: callSid,
    occurredAt,
    rawDigest: providerEventId,
    providerEventId,
    providerEventType: `twilio.CallStatus.${status}`
  };

  switch (status) {
    case 'ringing':
      return { ...base, type: 'provider.ringing' };
    case 'in-progress':
      return { ...base, type: 'provider.answered' };
    case 'completed':
      return {
        ...base,
        type: 'provider.completed',
        durationSec: dur,
        cause: null
      };
    case 'busy':
      return { ...base, type: 'provider.busy', cause: null };
    case 'no-answer':
      return { ...base, type: 'provider.no_answer', cause: null };
    case 'failed':
      return { ...base, type: 'provider.failed', cause: null };
    case 'canceled':
      return { ...base, type: 'user.cancel', cause: null };
    default:
      return { ...base, type: 'provider.unknown', cause: status };
  }
}

export class TwilioVoiceProvider implements VoiceProviderAdapter {
  readonly providerId = PROVIDER_ID;

  private readonly config: VoiceProviderRuntimeConfig;

  constructor(config: VoiceProviderRuntimeConfig) {
    this.config = config;
  }

  async createOutboundCall(input: CreateOutboundVoiceCallInput): Promise<CreateOutboundVoiceCallResult> {
    const companyIntegration = await getVoiceIntegration(input.companyId);
    const companyEnabled = companyIntegration?.enabled === true;
    const companySid = companyIntegration?.accountSid?.trim() ?? '';
    const companyToken = companyIntegration?.authToken?.trim() ?? '';

    let accountSid: string | null = null;
    let authToken: string | null = null;
    let credentialSource: 'company_firestore' | 'server_env';

    if (companyEnabled) {
      if (!companySid || !companyToken) {
        return {
          ok: false,
          error:
            'В CRM включена Voice-интеграция, но не заданы Account SID и Auth Token компании. Сохраните их в настройках или отключите интеграцию.',
          code: 'twilio_company_config_incomplete'
        };
      }
      accountSid = companySid;
      authToken = companyToken;
      credentialSource = 'company_firestore';
    } else {
      accountSid = this.config.twilioAccountSid?.trim() || null;
      authToken = this.config.twilioAuthToken?.trim() || null;
      credentialSource = 'server_env';
      const envErr = assertTwilioOutboundConfig(this.config);
      if (envErr) {
        return { ok: false, error: envErr, code: 'twilio_config' };
      }
    }

    if (!accountSid || !authToken) {
      return { ok: false, error: 'Twilio credentials missing', code: 'twilio_config' };
    }

    const urlErr = assertTwilioPublicUrls(this.config);
    if (urlErr) {
      return { ok: false, error: urlErr, code: 'twilio_public_url' };
    }

    const twimlUrl = buildVoiceTwilioTwimlUrl(this.config);
    let statusCallback = buildTwilioStatusCallbackValidationUrl(this.config);

    if (!twimlUrl.startsWith('http') || !statusCallback.startsWith('http')) {
      return {
        ok: false,
        error:
          'Twilio: невозможно построить публичные URL TwiML/statusCallback (задайте URL / VOICE_PUBLIC_SITE_URL на Netlify или TWILIO_WEBHOOK_PUBLIC_URL)',
        code: 'twilio_public_url'
      };
    }

    const metaStr = metadataToStringRecord(input.metadata);
    if (metaStr && Object.keys(metaStr).length > 0) {
      const u = new URL(statusCallback);
      for (const [k, v] of Object.entries(metaStr)) {
        u.searchParams.set(k, v);
      }
      statusCallback = u.toString();
    }

    const accountSidSuffix = accountSid.length >= 6 ? accountSid.slice(-6) : accountSid;
    console.log(
      JSON.stringify({
        tag: 'voice.twilio.create',
        phase: 'request',
        companyId: input.companyId,
        botId: input.botId,
        callId: input.callId,
        credentialSource,
        accountSidSuffix,
        fromE164: input.fromE164,
        toE164: input.toE164
      })
    );

    try {
      const client = twilio(accountSid, authToken);
      const call = await client.calls.create({
        to: input.toE164,
        from: input.fromE164,
        url: twimlUrl,
        method: 'POST',
        statusCallback,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: [
          'initiated',
          'ringing',
          'answered',
          'completed',
          'busy',
          'no-answer',
          'failed',
          'canceled'
        ]
      });

      const sid = call.sid;
      console.log(
        JSON.stringify({
          tag: 'voice.twilio.create',
          phase: 'response',
          ok: true,
          companyId: input.companyId,
          callId: input.callId,
          credentialSource,
          accountSidSuffix,
          providerCallSid: sid,
          twilioStatus: call.status ?? null
        })
      );
      return {
        ok: true,
        providerCallId: sid,
        raw: {
          sid,
          status: call.status,
          direction: call.direction,
          to: call.to,
          from: call.from
        },
        initialNormalizedEvents: []
      };
    } catch (e: unknown) {
      const mapped = mapTwilioVoiceCreateError(e);
      console.log(
        JSON.stringify({
          tag: 'voice.twilio.create',
          phase: 'response',
          ok: false,
          companyId: input.companyId,
          callId: input.callId,
          credentialSource,
          accountSidSuffix,
          twilioCode: mapped.twilioCode,
          twilioStatus: mapped.twilioStatus,
          friendlyCode: mapped.friendlyCode
        })
      );
      return {
        ok: false,
        error: mapped.userMessageRu,
        code: 'twilio_api_error',
        twilioCode: mapped.twilioCode,
        twilioStatus: mapped.twilioStatus,
        friendlyCode: mapped.friendlyCode,
        hint: mapped.hintRu,
        rawProviderMessage: mapped.rawMessage
      };
    }
  }

  async handleWebhook(input: VoiceWebhookParseInput): Promise<VoiceNormalizedWebhookEvent[]> {
    const authToken = this.config.twilioAuthToken;
    if (!authToken) {
      throw new Error('Twilio: TWILIO_AUTH_TOKEN не задан');
    }

    const signature =
      input.headers['x-twilio-signature'] ?? input.headers['X-Twilio-Signature'] ?? undefined;
    const params = parseFormBody(input.rawBody);

    const validationUrl = resolveTwilioWebhookRequestUrl(input.requestUrl, this.config);

    if (!this.config.twilioSkipSignatureValidation) {
      if (!signature) {
        throw new Error('Twilio: отсутствует заголовок X-Twilio-Signature');
      }
      const ok = twilio.validateRequest(authToken, signature, validationUrl, params);
      if (!ok) {
        throw new Error('Twilio: неверная подпись webhook (проверьте TWILIO_WEBHOOK_PUBLIC_URL и точный URL)');
      }
    }

    const callSid = params.CallSid;
    const status = params.CallStatus;
    if (!callSid || !status) {
      return [];
    }

    const twilioTs = params.Timestamp;
    const ev = mapTwilioCallStatusToEvent(callSid, status, params.CallDuration, twilioTs);
    return ev ? [ev] : [];
  }

  async getCall(providerCallId: string): Promise<Record<string, unknown> | null> {
    const err = assertTwilioOutboundConfig(this.config);
    if (err) throw new Error(err);
    const client = twilio(this.config.twilioAccountSid!, this.config.twilioAuthToken!);
    const c = await client.calls(providerCallId).fetch();
    return JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
  }

  async hangup(_providerCallId: string): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'hangup_not_implemented' };
  }
}
