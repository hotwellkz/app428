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

export type VoiceQaStatus = 'pending' | 'processing' | 'done' | 'failed';
export type VoiceQaBand = 'good' | 'warning' | 'bad';
export type VoiceQaOutcomeConfidence = 'low' | 'medium' | 'high';

/** Компактный снэпшот QA (для run extras и списков AI-control). */
export interface VoiceQaSnapshot {
  status: VoiceQaStatus;
  score: number | null;
  band: VoiceQaBand | null;
  needsReview: boolean;
  summary: string | null;
  flags: string[];
  warnings: string[];
  failureReasons: string[];
  nextStepCaptured: boolean;
  clientIntentClear: boolean;
  outcomeConfidence: VoiceQaOutcomeConfidence;
  reviewedAt?: Timestamp | Date | null;
  error?: string | null;
}

/** Авто/ручной retry и callback (оркестрация поверх сессии). */
export type VoiceRetryReason =
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'callback_requested'
  | 'outcome_unknown'
  | 'manual';

export type VoiceRetryOrchestrationStatus =
  | 'none'
  | 'pending'
  | 'scheduled'
  | 'dispatching'
  | 'dispatched'
  | 'completed'
  | 'exhausted'
  | 'canceled';

/** Состояние retry/callback на сессии + денормализация для sweep-запросов. */
export interface VoiceRetryState {
  retryEligible?: boolean;
  retryReason?: VoiceRetryReason | string | null;
  retryStatus?: VoiceRetryOrchestrationStatus | string | null;
  /** Успешные авто-dispatch из sweep (не считая исходящий первый звонок). */
  autoDispatchCount?: number;
  maxAutoDispatches?: number;
  nextRetryAt?: Timestamp | Date | null;
  lastRetryAt?: Timestamp | Date | null;
  callbackRequested?: boolean;
  callbackAt?: Timestamp | Date | null;
  callbackTimezone?: string | null;
  callbackNote?: string | null;
  parentCallId?: string | null;
  rootCallId?: string | null;
  /** Идемпотентность / дедуп алертов */
  lastAlertKeys?: string[];
}

export type VoiceSpeaker = 'bot' | 'client' | 'system';

/** Подполе metadata у voiceCallSessions для голосового loop (Twilio Say/Gather). */
export interface VoiceSessionVoiceLoopMetadata {
  conversationState?: 'active' | 'completed';
  twimlBootstrapped?: boolean;
  emptyGatherStreak?: number;
  endReason?: string | null;
  lastTurnAtMs?: number;
}

/** Результат post-call pipeline (в metadata.postCall). */
export interface VoicePostCallResultMetadata {
  pipelineVersion?: string;
  lightweight?: boolean;
  transcriptLineCount?: number;
  summary?: string | null;
  summaryError?: string | null;
  extractionJson?: string | null;
  extractionError?: string | null;
  dealSnapshotJson?: string | null;
  taskSnapshotJson?: string | null;
  dealCreateError?: string | null;
  taskApplyError?: string | null;
  followUpError?: string | null;
  warnings?: string[];
  linkedRunUpdated?: boolean;
}

/** QA результат пост-фактум анализа (в metadata.voiceQa). */
export interface VoiceQaResultMetadata extends VoiceQaSnapshot {
  pipelineVersion?: string;
  analyzedAt?: Timestamp | Date | null;
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
  /** Начало post-call pipeline (server) */
  postCallStartedAt?: Timestamp | Date | null;
  /** Завершение post-call pipeline */
  postCallCompletedAt?: Timestamp | Date | null;
  /** Краткая сводка для списков / CRM */
  postCallSummary?: string | null;
  /** Статусы этапов post-call (дублируют metadata.postCall при необходимости) */
  extractionStatus?: 'ok' | 'skipped' | 'error' | null;
  extractionError?: string | null;
  crmApplyStatus?: 'applied' | 'skipped' | 'error' | null;
  crmApplyError?: string | null;
  dealRecommendationStatus?: string | null;
  dealRecommendationError?: string | null;
  taskRecommendationStatus?: string | null;
  taskRecommendationError?: string | null;
  linkedDealId?: string | null;
  linkedTaskId?: string | null;
  followUpChannel?: string | null;
  followUpStatus?: string | null;
  followUpError?: string | null;
  /** Денормализация для scheduled sweep (индекс с voiceRetryNextAt). */
  voiceRetryStatus?: VoiceRetryOrchestrationStatus | string | null;
  voiceRetryNextAt?: Timestamp | Date | null;
  voiceRetryMaxAutoDispatches?: number | null;
  voiceRetryCallbackAt?: Timestamp | Date | null;
  voiceRetryCallbackOverdueAlertSent?: boolean | null;
  voiceRetryLastDispatchedChildId?: string | null;
  voiceQaStatus?: VoiceQaStatus | null;
  voiceQaScore?: number | null;
  voiceQaBand?: VoiceQaBand | null;
  voiceQaNeedsReview?: boolean | null;
  voiceQaSummary?: string | null;
  voiceQaOutcomeConfidence?: VoiceQaOutcomeConfidence | null;
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
