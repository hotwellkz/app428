import { createHash } from 'node:crypto';
import type { VoiceNormalizedWebhookEvent } from '../../../../../src/types/voice';
import type {
  CreateOutboundVoiceCallInput,
  CreateOutboundVoiceCallResult,
  VoiceProviderCapabilities,
  VoiceProviderAdapter,
  VoiceProviderValidateConfigResult,
  VoiceWebhookParseInput
} from '../voiceProviderAdapter';

const PROVIDER_ID = 'mock';

function digest(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

/**
 * Mock: не выполняет реальный звонок. Генерирует стабильный synthetic providerCallId.
 * Webhook: JSON body (см. handleWebhook).
 */
export class MockVoiceProvider implements VoiceProviderAdapter {
  readonly providerId = PROVIDER_ID;

  async validateConfig(): Promise<VoiceProviderValidateConfigResult> {
    return { ok: true };
  }

  getCapabilities(): VoiceProviderCapabilities {
    return {
      providerId: this.providerId,
      supportedCountries: [],
      localCallerIdSupported: false,
      readiness: 'experimental'
    };
  }

  async createOutboundCall(input: CreateOutboundVoiceCallInput): Promise<CreateOutboundVoiceCallResult> {
    const providerCallId = `mock_${input.callId}_${digest(`${input.callId}:${input.toE164}:${Date.now()}`).slice(0, 12)}`;
    return {
      ok: true,
      providerCallId,
      raw: { mock: true, webhookUrl: input.webhookUrl },
      initialNormalizedEvents: []
    };
  }

  async handleWebhook(input: VoiceWebhookParseInput): Promise<VoiceNormalizedWebhookEvent[]> {
    const { rawBody, config } = input;
    if (!rawBody?.trim()) return [];

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return [];
    }

    if (config.mockWebhookSecret) {
      const h =
        input.headers['x-voice-mock-secret'] ??
        input.headers['X-Voice-Mock-Secret'] ??
        input.queryParams.secret;
      if (h !== config.mockWebhookSecret) {
        throw new Error('mock webhook secret mismatch');
      }
    }

    if (parsed.provider && String(parsed.provider) !== 'mock' && String(parsed.provider) !== PROVIDER_ID) {
      return [];
    }

    const providerCallId = String(parsed.providerCallId ?? '').trim();
    if (!providerCallId) {
      return [];
    }

    const eventsUnknown = parsed.events;
    if (Array.isArray(eventsUnknown) && eventsUnknown.length > 0) {
      return eventsUnknown
        .map((e) => normalizeOneMockEvent(providerCallId, e))
        .filter((x): x is VoiceNormalizedWebhookEvent => x != null);
    }

    const singleType = String(parsed.type ?? '').trim();
    if (singleType) {
      const ev = normalizeOneMockEvent(providerCallId, parsed);
      return ev ? [ev] : [];
    }

    return [];
  }
}

function normalizeOneMockEvent(
  fallbackProviderCallId: string,
  raw: unknown
): VoiceNormalizedWebhookEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = String(o.type ?? '').trim() as VoiceNormalizedWebhookEvent['type'];
  const allowed: VoiceNormalizedWebhookEvent['type'][] = [
    'enqueue',
    'provider.accepted',
    'provider.ringing',
    'provider.answered',
    'provider.completed',
    'provider.failed',
    'provider.busy',
    'provider.no_answer',
    'user.cancel',
    'provider.unknown'
  ];
  if (!allowed.includes(type)) return null;

  const providerCallId = String(o.providerCallId ?? fallbackProviderCallId).trim();
  const occurredAt =
    typeof o.occurredAt === 'string' && o.occurredAt.trim()
      ? o.occurredAt.trim()
      : new Date().toISOString();

  return {
    type,
    providerCallId,
    occurredAt,
    durationSec: typeof o.durationSec === 'number' ? o.durationSec : null,
    cause: o.cause != null ? String(o.cause) : null,
    rawDigest: o.rawDigest != null ? String(o.rawDigest) : null,
    providerEventType: o.providerEventType != null ? String(o.providerEventType) : null,
    providerEventId: o.providerEventId != null ? String(o.providerEventId) : null
  };
}
