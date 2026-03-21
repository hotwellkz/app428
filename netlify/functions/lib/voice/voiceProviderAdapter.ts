import type { VoiceProviderRuntimeConfig } from './providerConfig';
import type { VoiceNormalizedWebhookEvent } from '../../../../src/types/voice';
import { getVoiceIntegration } from '../firebaseAdmin';
import { MockVoiceProvider } from './providers/mockVoiceProvider';
import { TwilioVoiceProvider } from './providers/twilioVoiceProvider';
import { TelnyxVoiceProvider } from './providers/telnyxVoiceProvider';
import { ZadarmaVoiceProvider } from './providers/zadarmaVoiceProvider';
import type { TwilioVoiceFriendlyCode } from './deriveTwilioVoiceFriendlyError';

/** Коды для UI: Twilio + общие + Telnyx (расширяйте по мере необходимости). */
export type VoiceCreateFailureFriendlyCode = TwilioVoiceFriendlyCode | string;

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
      friendlyCode?: VoiceCreateFailureFriendlyCode;
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

export type VoiceOutboundProviderChoice = 'twilio' | 'telnyx' | 'zadarma';

/**
 * Исходящий звонок: если у компании в Firestore включена Twilio-интеграция с ключами — всегда реальный Twilio,
 * даже при VOICE_PROVIDER=mock на сервере (иначе UI показывал бы «успех» без дозвона).
 *
 * @param opts.requestedProvider — явный выбор из UI (multi-provider). Если не задан — предпочтение компании в Firestore.
 */
export async function resolveVoiceProviderForCompany(
  companyId: string,
  config: VoiceProviderRuntimeConfig,
  opts?: { requestedProvider?: VoiceOutboundProviderChoice | null }
): Promise<VoiceProviderAdapter> {
  const row = await getVoiceIntegration(companyId);
  const pref: VoiceOutboundProviderChoice =
    row?.outboundVoiceProvider === 'telnyx'
      ? 'telnyx'
      : row?.outboundVoiceProvider === 'zadarma'
        ? 'zadarma'
        : 'twilio';

  const useCompanyTwilio =
    row?.enabled === true && !!(row.accountSid?.trim() && row.authToken?.trim());
  const useCompanyTelnyx =
    row?.telnyxEnabled === true &&
    !!(row.telnyxApiKey?.trim() && row.telnyxPublicKey?.trim());
  const useCompanyZadarma =
    row?.zadarmaEnabled === true && !!(row.zadarmaKey?.trim() && row.zadarmaSecret?.trim());

  const req = opts?.requestedProvider;
  const target: VoiceOutboundProviderChoice =
    req === 'twilio' || req === 'telnyx' || req === 'zadarma' ? req : pref;

  if (target === 'zadarma') {
    if (useCompanyZadarma) {
      return new ZadarmaVoiceProvider(config);
    }
    const msg =
      req === 'zadarma'
        ? 'Zadarma не настроена или выключена: сохраните Key, Secret и extension в разделе Интеграции.'
        : 'Выбран исходящий провайдер Zadarma, но интеграция не готова.';
    throw new Error(msg);
  }

  if (target === 'telnyx') {
    if (useCompanyTelnyx) {
      return new TelnyxVoiceProvider(config);
    }
    const msg =
      req === 'telnyx'
        ? 'Telnyx не настроен или выключен: сохраните API Key и Public Key в разделе Интеграции.'
        : 'Выбран исходящий провайдер Telnyx, но интеграция не готова: включите Telnyx, сохраните API Key и Public Key в разделе Интеграции.';
    throw new Error(msg);
  }

  if (useCompanyTwilio) {
    return new TwilioVoiceProvider(config);
  }

  if (req === 'twilio') {
    throw new Error('Twilio не настроен: сохраните Account SID и Auth Token в разделе Интеграции.');
  }

  if (config.mode === 'twilio') {
    if (!config.twilioAccountSid?.trim() || !config.twilioAuthToken?.trim()) {
      throw new Error('VOICE_PROVIDER=twilio: задайте TWILIO_ACCOUNT_SID и TWILIO_AUTH_TOKEN');
    }
    return new TwilioVoiceProvider(config);
  }

  return new MockVoiceProvider();
}
