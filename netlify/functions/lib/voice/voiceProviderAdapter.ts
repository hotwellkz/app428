import type { VoiceProviderRuntimeConfig } from './providerConfig';
import type { VoiceNormalizedWebhookEvent } from '../../../../src/types/voice';
import { MockVoiceProvider } from './providers/mockVoiceProvider';
import { TwilioVoiceProvider } from './providers/twilioVoiceProvider';

export type CreateOutboundVoiceCallInput = {
  companyId: string;
  botId: string;
  callId: string;
  linkedRunId: string;
  toE164: string;
  fromE164: string;
  fromNumberId?: string | null;
  webhookUrl: string;
  metadata?: Record<string, unknown>;
  config: VoiceProviderRuntimeConfig;
};

export type CreateOutboundVoiceCallResult =
  | {
      ok: true;
      providerCallId: string;
      raw?: Record<string, unknown>;
      initialNormalizedEvents?: VoiceNormalizedWebhookEvent[];
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export type VoiceWebhookParseInput = {
  rawBody: string;
  headers: Record<string, string | undefined>;
  queryParams: Record<string, string | undefined>;
  /** Полный URL запроса (Netlify: rawUrl) — для Twilio validateRequest. */
  requestUrl: string;
  config: VoiceProviderRuntimeConfig;
};

export interface VoiceProviderAdapter {
  readonly providerId: string;
  createOutboundCall(input: CreateOutboundVoiceCallInput): Promise<CreateOutboundVoiceCallResult>;
  handleWebhook(input: VoiceWebhookParseInput): Promise<VoiceNormalizedWebhookEvent[]>;
  getCall?(providerCallId: string): Promise<Record<string, unknown> | null>;
  hangup?(providerCallId: string): Promise<{ ok: boolean; error?: string }>;
}

export function getVoiceProviderAdapter(config: VoiceProviderRuntimeConfig): VoiceProviderAdapter {
  if (config.mode === 'twilio') {
    if (!config.twilioAccountSid?.trim() || !config.twilioAuthToken?.trim()) {
      throw new Error('VOICE_PROVIDER=twilio: задайте TWILIO_ACCOUNT_SID и TWILIO_AUTH_TOKEN');
    }
    return new TwilioVoiceProvider(config);
  }
  return new MockVoiceProvider();
}
