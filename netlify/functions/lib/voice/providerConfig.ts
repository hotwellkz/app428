/**
 * Server-only конфиг voice provider. Секреты не для клиента.
 */
export type VoiceProviderMode = 'mock' | 'twilio';

export interface VoiceProviderRuntimeConfig {
  mode: VoiceProviderMode;
  /** Общий секрет входящего webhook (опционально). */
  webhookSecret: string | null;
  /** Доп. секрет только для mock/dev тел теле метки в заголовке (опционально). */
  mockWebhookSecret: string | null;
  /** Публичный базовый URL сайта для callback URL в провайдере (Netlify: URL). */
  publicSiteUrl: string | null;
}

function trimEnv(key: string): string | null {
  const v = process.env[key];
  if (v == null || !String(v).trim()) return null;
  return String(v).trim();
}

/**
 * Режим по умолчанию — mock, пока нет реальной телефонии.
 * Явно задайте VOICE_PROVIDER=twilio когда появится реализация адаптера.
 */
export function loadVoiceProviderRuntimeConfig(): VoiceProviderRuntimeConfig {
  const modeRaw = (trimEnv('VOICE_PROVIDER') ?? 'mock').toLowerCase();
  const mode: VoiceProviderMode = modeRaw === 'twilio' ? 'twilio' : 'mock';

  return {
    mode,
    webhookSecret: trimEnv('VOICE_WEBHOOK_SECRET'),
    mockWebhookSecret: trimEnv('VOICE_MOCK_WEBHOOK_SECRET'),
    publicSiteUrl: trimEnv('URL') ?? trimEnv('DEPLOY_PRIME_URL') ?? trimEnv('VOICE_PUBLIC_SITE_URL')
  };
}

export function buildVoiceProviderWebhookUrl(config: VoiceProviderRuntimeConfig): string {
  const base = config.publicSiteUrl?.replace(/\/$/, '') ?? '';
  if (!base) return '/.netlify/functions/voice-provider-webhook';
  return `${base}/.netlify/functions/voice-provider-webhook`;
}
