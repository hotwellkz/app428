/**
 * Server-only конфиг voice provider. Секреты не для клиента.
 */
export type VoiceProviderMode = 'mock' | 'twilio';

export interface VoiceProviderRuntimeConfig {
  mode: VoiceProviderMode;
  /** Общий секрет входящего webhook (опционально, в основном для mock JSON). */
  webhookSecret: string | null;
  /** Доп. секрет только для mock/dev — заголовок X-Voice-Mock-Secret. */
  mockWebhookSecret: string | null;
  /** Публичный базовый URL сайта (Netlify: URL / VOICE_PUBLIC_SITE_URL). */
  publicSiteUrl: string | null;

  /** Twilio Account SID (VOICE_PROVIDER=twilio). */
  twilioAccountSid: string | null;
  /** Twilio Auth Token для REST и validateRequest. */
  twilioAuthToken: string | null;
  /**
   * Полный публичный URL endpoint статус-колбэка, **как в Twilio** (важно для X-Twilio-Signature).
   * Пример: https://2wix.ru/api/voice/provider-webhook
   * Если не задан — собирается из publicSiteUrl + путь API.
   */
  twilioWebhookPublicUrl: string | null;
  /** Опционально: канонический URL TwiML entry (подпись X-Twilio-Signature). */
  twilioTwimlPublicUrl: string | null;
  /** Опционально: канонический URL Gather action. */
  twilioGatherPublicUrl: string | null;
  /** Локальная разработка: "1" — не проверять подпись Twilio (не для prod). */
  twilioSkipSignatureValidation: boolean;
}

function trimEnv(key: string): string | null {
  const v = process.env[key];
  if (v == null || !String(v).trim()) return null;
  return String(v).trim();
}

function truthyEnv(key: string): boolean {
  const v = trimEnv(key);
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Режим по умолчанию — mock. Для боевого исходящего: VOICE_PROVIDER=twilio + Twilio env.
 */
export function loadVoiceProviderRuntimeConfig(): VoiceProviderRuntimeConfig {
  const modeRaw = (trimEnv('VOICE_PROVIDER') ?? 'mock').toLowerCase();
  const mode: VoiceProviderMode = modeRaw === 'twilio' ? 'twilio' : 'mock';

  return {
    mode,
    webhookSecret: trimEnv('VOICE_WEBHOOK_SECRET'),
    mockWebhookSecret: trimEnv('VOICE_MOCK_WEBHOOK_SECRET'),
    publicSiteUrl: trimEnv('URL') ?? trimEnv('DEPLOY_PRIME_URL') ?? trimEnv('VOICE_PUBLIC_SITE_URL'),
    twilioAccountSid: trimEnv('TWILIO_ACCOUNT_SID'),
    twilioAuthToken: trimEnv('TWILIO_AUTH_TOKEN'),
    twilioWebhookPublicUrl: trimEnv('TWILIO_WEBHOOK_PUBLIC_URL'),
    twilioTwimlPublicUrl: trimEnv('TWILIO_TWIML_PUBLIC_URL'),
    twilioGatherPublicUrl: trimEnv('TWILIO_GATHER_PUBLIC_URL'),
    twilioSkipSignatureValidation: truthyEnv('TWILIO_SKIP_SIGNATURE_VALIDATION')
  };
}

/** Относительный путь к Netlify function (без домена). */
export const VOICE_WEBHOOK_FUNCTION_PATH = '/.netlify/functions/voice-provider-webhook';
export const VOICE_TWILIO_TWIML_FUNCTION_PATH = '/.netlify/functions/voice-twilio-twiml';
export const VOICE_TWILIO_GATHER_FUNCTION_PATH = '/.netlify/functions/voice-twilio-gather-action';

/** Публичный URL через редирект /api/voice/* (см. netlify.toml). */
export function buildVoiceProviderWebhookUrl(config: VoiceProviderRuntimeConfig): string {
  const base = config.publicSiteUrl?.replace(/\/$/, '') ?? '';
  if (!base) return VOICE_WEBHOOK_FUNCTION_PATH;
  return `${base}${VOICE_WEBHOOK_FUNCTION_PATH}`;
}

/**
 * URL для Twilio validateRequest — должен точно совпадать с тем, что Twilio подписывает.
 */
export function buildTwilioStatusCallbackValidationUrl(config: VoiceProviderRuntimeConfig): string {
  if (config.twilioWebhookPublicUrl?.trim()) {
    return config.twilioWebhookPublicUrl.trim().replace(/\/$/, '');
  }
  return buildVoiceProviderWebhookUrl(config);
}

export function buildVoiceTwilioTwimlUrl(config: VoiceProviderRuntimeConfig): string {
  const base = config.publicSiteUrl?.replace(/\/$/, '') ?? '';
  if (!base) return VOICE_TWILIO_TWIML_FUNCTION_PATH;
  return `${base}${VOICE_TWILIO_TWIML_FUNCTION_PATH}`;
}

export function buildVoiceTwilioGatherActionUrl(config: VoiceProviderRuntimeConfig): string {
  const base = config.publicSiteUrl?.replace(/\/$/, '') ?? '';
  if (!base) return VOICE_TWILIO_GATHER_FUNCTION_PATH;
  return `${base}${VOICE_TWILIO_GATHER_FUNCTION_PATH}`;
}

export type TwilioSignedEndpointKind = 'provider_webhook' | 'twiml' | 'gather';

/** Канонический URL для validateRequest по типу endpoint (override из env). */
export function resolveTwilioSignedRequestUrl(
  rawUrl: string,
  config: VoiceProviderRuntimeConfig,
  kind: TwilioSignedEndpointKind
): string {
  const overrideRaw =
    kind === 'provider_webhook'
      ? config.twilioWebhookPublicUrl
      : kind === 'twiml'
        ? config.twilioTwimlPublicUrl
        : config.twilioGatherPublicUrl;
  const canonical = overrideRaw?.trim().replace(/\/$/, '');
  if (!canonical) {
    return rawUrl;
  }
  try {
    const base = new URL(canonical.includes('://') ? canonical : `https://${canonical}`);
    const inc = new URL(rawUrl);
    if (inc.search) {
      base.search = inc.search;
    }
    return base.toString();
  } catch {
    return rawUrl;
  }
}

/** Публичные URL для TwiML/statusCallback (нужны и при credentials из Firestore). */
export function assertTwilioPublicUrls(config: VoiceProviderRuntimeConfig): string | null {
  if (!config.publicSiteUrl && !config.twilioWebhookPublicUrl) {
    return 'Twilio: задайте URL (Netlify) или VOICE_PUBLIC_SITE_URL / TWILIO_WEBHOOK_PUBLIC_URL для callback и TwiML';
  }
  return null;
}

export function assertTwilioOutboundConfig(config: VoiceProviderRuntimeConfig): string | null {
  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    return 'Twilio: задайте TWILIO_ACCOUNT_SID и TWILIO_AUTH_TOKEN';
  }
  return assertTwilioPublicUrls(config);
}

/** @deprecated alias — используйте resolveTwilioSignedRequestUrl(..., 'provider_webhook'). */
export function resolveTwilioWebhookRequestUrl(
  rawUrl: string,
  config: VoiceProviderRuntimeConfig
): string {
  return resolveTwilioSignedRequestUrl(rawUrl, config, 'provider_webhook');
}
