/**
 * Общий контракт voice-провайдеров (server-side).
 * Реализации: Twilio, Telnyx, Mock — см. voiceProviderAdapter и providers/*.
 */
export type {
  VoiceProviderAdapter,
  VoiceProviderCapabilities,
  CreateOutboundVoiceCallInput,
  CreateOutboundVoiceCallResult,
  VoiceWebhookParseInput,
  VoiceProviderValidateConfigResult,
  VoiceProviderFailureCode,
  VoiceProviderDebug
} from './voiceProviderAdapter';
