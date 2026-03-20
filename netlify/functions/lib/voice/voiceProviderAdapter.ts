import type { VoiceProviderRuntimeConfig } from './providerConfig';
import type { VoiceNormalizedWebhookEvent } from '../../../../src/types/voice';
import { getVoiceIntegration } from '../firebaseAdmin';
import { MockVoiceProvider } from './providers/mockVoiceProvider';
import { TwilioVoiceProvider } from './providers/twilioVoiceProvider';
import { TelnyxVoiceProvider } from './providers/telnyxVoiceProvider';
import type { TwilioVoiceFriendlyCode } from './deriveTwilioVoiceFriendlyError';

/** Унифицированные коды/типы провайдера (расширяйте строками при необходимости). */
export type VoiceProviderFailureCode = string;
export type VoiceProviderDebug = Record<string, unknown>;

export type VoiceProviderValidateConfigResult =
  | { ok: true; details?: Record<string, unknown> }
  | { ok: false; error: string; details?: Record<string, unknown> };

export type VoiceProviderCapabilities = {
  providerId: string;
  supportedCountries: string[];
  localCallerIdSupported: boolean;
  readiness: 'ready' | 'limited' | 'experimental';
};

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
      /** Диагностика создания звонка (без секретов). */
      providerDebug?: VoiceProviderDebug;
      initialNormalizedEvents?: VoiceNormalizedWebhookEvent[];
    }
  | {
      ok: false;
      error: string;
      code?: string;
      providerFailureCode?: VoiceProviderFailureCode;
      providerFailureReason?: string;
      providerDebug?: VoiceProviderDebug;
      twilioCode?: number | null;
      twilioStatus?: number | null;
      friendlyCode?: TwilioVoiceFriendlyCode;
      hint?: string | null;
      /** Оригинальное сообщение провайдера (для логов / событий, не для секретов). */
      rawProviderMessage?: string;
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
  /** Проверка конфигурации провайдера (опционально; UI может вызывать отдельные probe-функции). */
  validateConfig?(
    input: Record<string, unknown>
  ): Promise<VoiceProviderValidateConfigResult> | VoiceProviderValidateConfigResult;
  createOutboundCall(input: CreateOutboundVoiceCallInput): Promise<CreateOutboundVoiceCallResult>;
  handleWebhook(input: VoiceWebhookParseInput): Promise<VoiceNormalizedWebhookEvent[]>;
  getCall?(providerCallId: string): Promise<Record<string, unknown> | null>;
  hangup?(providerCallId: string): Promise<{ ok: boolean; error?: string }>;
  getCapabilities?(): VoiceProviderCapabilities;
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

/**
 * Исходящий звонок: если у компании в Firestore включена Twilio-интеграция с ключами — всегда реальный Twilio,
 * даже при VOICE_PROVIDER=mock на сервере (иначе UI показывал бы «успех» без дозвона).
 */
export async function resolveVoiceProviderForCompany(
  companyId: string,
  config: VoiceProviderRuntimeConfig
): Promise<VoiceProviderAdapter> {
  const row = await getVoiceIntegration(companyId);
  const pref = row?.outboundVoiceProvider === 'telnyx' ? 'telnyx' : 'twilio';

  const useCompanyTwilio =
    row?.enabled === true && !!(row.accountSid?.trim() && row.authToken?.trim());
  const useCompanyTelnyx =
    row?.telnyxEnabled === true &&
    !!(row.telnyxApiKey?.trim() && row.telnyxPublicKey?.trim());

  if (pref === 'telnyx') {
    if (useCompanyTelnyx) {
      return new TelnyxVoiceProvider(config);
    }
    throw new Error(
      'Выбран исходящий провайдер Telnyx, но интеграция не готова: включите Telnyx, сохраните API Key и Public Key в разделе Интеграции.'
    );
  }

  if (useCompanyTwilio) {
    return new TwilioVoiceProvider(config);
  }

  if (config.mode === 'twilio') {
    if (!config.twilioAccountSid?.trim() || !config.twilioAuthToken?.trim()) {
      throw new Error('VOICE_PROVIDER=twilio: задайте TWILIO_ACCOUNT_SID и TWILIO_AUTH_TOKEN');
    }
    return new TwilioVoiceProvider(config);
  }

  return new MockVoiceProvider();
}
