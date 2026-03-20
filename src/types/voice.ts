import type { Timestamp } from 'firebase/firestore';

/**
 * Voice MVP (bounded context): типы сессий звонка, событий, реплик и номеров.
 *
 * Связь с AI-control (без изменения схемы whatsappAiBotRuns на этом этапе):
 * `linkedRunId` — тот же идентификатор, что документ `whatsappAiBotRuns/{runId}`
 * и sidecar `whatsappAiRunWorkflow/{runId}`. Один операционный след для UI AI-control.
 */
export type VoiceChannel = 'voice';

export type VoiceCallDirection = 'outbound';

export type VoiceCallStatus =
  | 'queued'
  | 'dialing'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'canceled';

export type VoiceOutcome = 'meeting_booked' | 'callback' | 'no_interest' | 'unknown';

export type VoicePostCallStatus = 'pending' | 'processing' | 'done' | 'failed';

export type VoiceSpeaker = 'bot' | 'client' | 'system';

/** Подполе metadata у voiceCallSessions для голосового loop (Twilio Say/Gather). */
export interface VoiceSessionVoiceLoopMetadata {
  conversationState?: 'active' | 'completed';
  twimlBootstrapped?: boolean;
  emptyGatherStreak?: number;
  endReason?: string | null;
  lastTurnAtMs?: number;
}

/** P0: строковый идентификатор провайдера (например "twilio_v1"); без импорта SDK провайдера. */
export type VoiceProviderId = string;

export interface VoiceCallSession {
  id: string;
  companyId: string;
  botId: string;
  channel: VoiceChannel;
  direction: VoiceCallDirection;
  status: VoiceCallStatus;
  provider: VoiceProviderId;
  providerCallId?: string | null;
  providerAccountId?: string | null;
  fromNumberId?: string | null;
  fromE164?: string | null;
  toE164: string;
  contactId?: string | null;
  clientId?: string | null;
  crmClientId?: string | null;
  conversationId?: string | null;
  /** = runId в AI-control / whatsappAiBotRuns / whatsappAiRunWorkflow */
  linkedRunId: string;
  startedAt?: Timestamp | Date | null;
  connectedAt?: Timestamp | Date | null;
  endedAt?: Timestamp | Date | null;
  durationSec?: number | null;
  endReason?: string | null;
  outcome?: VoiceOutcome | null;
  postCallStatus?: VoicePostCallStatus;
  postCallError?: string | null;
  linkedDealId?: string | null;
  linkedTaskId?: string | null;
  followUpChannel?: string | null;
  followUpStatus?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface VoiceCallEvent {
  id: string;
  callId: string;
  companyId: string;
  type: string;
  providerEventType?: string | null;
  providerCallId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  at: Timestamp | Date | null;
  payload?: Record<string, unknown>;
  seq?: number | null;
  createdAt?: Timestamp | Date | null;
}

export interface VoiceTurn {
  id: string;
  callId: string;
  companyId: string;
  turnIndex: number;
  speaker: VoiceSpeaker;
  text: string;
  rawText?: string | null;
  sttModel?: string | null;
  ttsVoiceId?: string | null;
  startedAt?: Timestamp | Date | null;
  endedAt?: Timestamp | Date | null;
  confidence?: number | null;
  createdAt?: Timestamp | Date | null;
}

export interface VoiceNumberCapabilities {
  voice?: boolean;
}

export interface VoiceNumber {
  id: string;
  companyId: string;
  e164: string;
  provider: VoiceProviderId;
  providerSid?: string | null;
  label?: string | null;
  isDefault?: boolean;
  capabilities?: VoiceNumberCapabilities;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

/** Поля создания сессии (id генерируется отдельно). */
export type VoiceCallSessionCreateInput = Omit<VoiceCallSession, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<VoiceCallSession, 'createdAt' | 'updatedAt'>>;

/** Patch для update/upsert (без обязательного toE164 если merge). */
export type VoiceCallSessionUpdateInput = Partial<
  Omit<VoiceCallSession, 'id' | 'companyId' | 'linkedRunId' | 'createdAt'>
> & { updatedAt?: VoiceCallSession['updatedAt'] };

/** Нормализованные события lifecycle (server / webhook), не привязаны к payload провайдера. */
export type VoiceNormalizedEventType =
  | 'enqueue'
  | 'provider.accepted'
  | 'provider.ringing'
  | 'provider.answered'
  | 'provider.completed'
  | 'provider.failed'
  | 'provider.busy'
  | 'provider.no_answer'
  | 'user.cancel'
  | 'provider.unknown';

export interface VoiceNormalizedWebhookEvent {
  type: VoiceNormalizedEventType;
  providerCallId: string;
  /** ISO 8601 */
  occurredAt: string;
  durationSec?: number | null;
  cause?: string | null;
  /** Короткий отпечаток сырого payload для отладки */
  rawDigest?: string | null;
  providerEventType?: string | null;
  /**
   * Стабильный id события у провайдера (CallSid+status и т.п.) — для дедупа webhook.
   */
  providerEventId?: string | null;
}
