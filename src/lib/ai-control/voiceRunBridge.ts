/**
 * Чтение voice-bridge полей из whatsappAiBotRuns (extras + корень документа).
 */
import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import type { VoicePostCallResultMetadata, VoiceQaSnapshot } from '../../types/voice';

export type VoiceCallSnapshotForAiRun = {
  callStatus?: string;
  outcome?: string | null;
  postCallStatus?: string | null;
  providerCallId?: string | null;
  provider?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
  followUpStatus?: string | null;
  followUpError?: string | null;
  twilioFinalStatus?: string | null;
  twilioSipResponseCode?: number | null;
  twilioErrorCode?: number | null;
  twilioErrorMessage?: string | null;
  twilioWarningCode?: number | null;
  twilioWarningMessage?: string | null;
  twilioProviderReason?: string | null;
  voiceFailureReasonCode?: string | null;
  voiceFailureReasonMessage?: string | null;
  durationSec?: number | null;
  hadInProgress?: boolean | null;
  callbackTimeline?: Array<Record<string, unknown>> | null;
  lifecycle?: Record<string, unknown> | null;
};

export function getVoicePostCallFromRun(run: WhatsAppAiBotRunRecord): VoicePostCallResultMetadata | null {
  const raw = run.extras?.voicePostCall;
  if (!raw || typeof raw !== 'object') return null;
  return raw as VoicePostCallResultMetadata;
}

export function getVoiceCallSnapshotFromRun(run: WhatsAppAiBotRunRecord): VoiceCallSnapshotForAiRun | null {
  const raw = run.extras?.voiceCallSnapshot;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
    return null;
  };
  return {
    callStatus: typeof o.callStatus === 'string' ? o.callStatus : undefined,
    outcome: o.outcome != null ? String(o.outcome) : null,
    postCallStatus: o.postCallStatus != null ? String(o.postCallStatus) : null,
    providerCallId: o.providerCallId != null ? String(o.providerCallId) : null,
    provider: o.provider != null ? String(o.provider) : null,
    fromE164: o.fromE164 != null ? String(o.fromE164) : null,
    toE164: o.toE164 != null ? String(o.toE164) : null,
    followUpStatus: o.followUpStatus != null ? String(o.followUpStatus) : null,
    followUpError: o.followUpError != null ? String(o.followUpError) : null,
    twilioFinalStatus: o.twilioFinalStatus != null ? String(o.twilioFinalStatus) : null,
    twilioSipResponseCode: num(o.twilioSipResponseCode),
    twilioErrorCode: num(o.twilioErrorCode),
    twilioErrorMessage: o.twilioErrorMessage != null ? String(o.twilioErrorMessage) : null,
    twilioWarningCode: num(o.twilioWarningCode),
    twilioWarningMessage: o.twilioWarningMessage != null ? String(o.twilioWarningMessage) : null,
    twilioProviderReason: o.twilioProviderReason != null ? String(o.twilioProviderReason) : null,
    voiceFailureReasonCode: o.voiceFailureReasonCode != null ? String(o.voiceFailureReasonCode) : null,
    voiceFailureReasonMessage: o.voiceFailureReasonMessage != null ? String(o.voiceFailureReasonMessage) : null,
    durationSec: num(o.durationSec),
    hadInProgress: o.hadInProgress === true ? true : o.hadInProgress === false ? false : null,
    callbackTimeline: Array.isArray(o.callbackTimeline) ? (o.callbackTimeline as Array<Record<string, unknown>>) : null,
    lifecycle: o.lifecycle && typeof o.lifecycle === 'object' ? (o.lifecycle as Record<string, unknown>) : null
  };
}

export function getVoiceCallSessionIdFromRun(run: WhatsAppAiBotRunRecord): string | null {
  const id = run.extras?.voiceCallSessionId;
  if (typeof id === 'string' && id.trim()) return id.trim();
  return null;
}

export type VoiceRetryForAiRun = {
  retryStatus?: string | null;
  retryReason?: string | null;
  nextRetryAt?: string | null;
  autoDispatchCount?: number;
  maxAutoDispatches?: number;
  manualRedialCount?: number;
  callbackAt?: string | null;
  callbackRequested?: boolean;
  rootCallId?: string | null;
  parentCallId?: string | null;
};

export function getVoiceQaFromRun(run: WhatsAppAiBotRunRecord): VoiceQaSnapshot | null {
  const raw = run.extras?.voiceQa;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    status: (o.status as VoiceQaSnapshot['status']) ?? 'pending',
    score: typeof o.score === 'number' ? o.score : null,
    band: (o.band as VoiceQaSnapshot['band']) ?? null,
    needsReview: o.needsReview === true,
    summary: typeof o.summary === 'string' ? o.summary : null,
    flags: Array.isArray(o.flags) ? o.flags.map((x) => String(x)) : [],
    warnings: Array.isArray(o.warnings) ? o.warnings.map((x) => String(x)) : [],
    failureReasons: Array.isArray(o.failureReasons) ? o.failureReasons.map((x) => String(x)) : [],
    nextStepCaptured: o.nextStepCaptured === true,
    clientIntentClear: o.clientIntentClear === true,
    outcomeConfidence: (o.outcomeConfidence as VoiceQaSnapshot['outcomeConfidence']) ?? 'low',
    reviewStatus: (o.reviewStatus as VoiceQaSnapshot['reviewStatus']) ?? 'none',
    reviewedBy: o.reviewedBy != null ? String(o.reviewedBy) : null,
    reviewNote: o.reviewNote != null ? String(o.reviewNote) : null,
    reviewDisposition: (o.reviewDisposition as VoiceQaSnapshot['reviewDisposition']) ?? null,
    needsPromptFix: o.needsPromptFix === true,
    needsOpsFix: o.needsOpsFix === true,
    needsRetryTuning: o.needsRetryTuning === true,
    needsHumanFollowup: o.needsHumanFollowup === true,
    reviewedAt: typeof o.reviewedAt === 'string' ? new Date(o.reviewedAt) : null,
    error: typeof o.error === 'string' ? o.error : null
  };
}

export function getVoiceRetryFromRun(run: WhatsAppAiBotRunRecord): VoiceRetryForAiRun | null {
  const raw = run.extras?.voiceRetry;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    retryStatus: o.retryStatus != null ? String(o.retryStatus) : null,
    retryReason: o.retryReason != null ? String(o.retryReason) : null,
    nextRetryAt: o.nextRetryAt != null ? String(o.nextRetryAt) : null,
    autoDispatchCount: typeof o.autoDispatchCount === 'number' ? o.autoDispatchCount : Number(o.autoDispatchCount ?? 0),
    maxAutoDispatches:
      typeof o.maxAutoDispatches === 'number' ? o.maxAutoDispatches : Number(o.maxAutoDispatches ?? 0) || undefined,
    manualRedialCount:
      typeof o.manualRedialCount === 'number' ? o.manualRedialCount : Number(o.manualRedialCount ?? 0),
    callbackAt: o.callbackAt != null ? String(o.callbackAt) : null,
    callbackRequested: o.callbackRequested === true,
    rootCallId: o.rootCallId != null ? String(o.rootCallId) : null,
    parentCallId: o.parentCallId != null ? String(o.parentCallId) : null
  };
}

/** Компактная строка статусов звонка для списка. */
export function formatVoiceRunStatusLine(run: WhatsAppAiBotRunRecord): string {
  const snap = getVoiceCallSnapshotFromRun(run);
  const vp = getVoicePostCallFromRun(run);
  const vr = getVoiceRetryFromRun(run);
  const parts: string[] = [];
  if (snap?.callStatus) parts.push(snap.callStatus);
  if (snap?.outcome) parts.push(`outcome:${snap.outcome}`);
  if (snap?.postCallStatus) parts.push(`post:${snap.postCallStatus}`);
  else if (vp?.lightweight) parts.push('post:light');
  if (snap?.voiceFailureReasonCode) parts.push(`reason:${snap.voiceFailureReasonCode}`);
  if (snap?.followUpStatus && snap.followUpStatus !== 'skipped') parts.push(`WA:${snap.followUpStatus}`);
  const qa = getVoiceQaFromRun(run);
  if (qa?.status === 'done') {
    parts.push(`QA:${qa.score ?? '—'}/${qa.band ?? '—'}`);
    if (qa.needsReview) parts.push('review');
    if (qa.reviewStatus && qa.reviewStatus !== 'none') parts.push(`rv:${qa.reviewStatus}`);
  } else if (qa?.status === 'failed') {
    parts.push('QA:failed');
  }
  if (vr?.retryStatus && vr.retryStatus !== 'none' && vr.retryStatus !== 'completed') {
    parts.push(`retry:${vr.retryStatus}`);
    if (vr.nextRetryAt) parts.push(`next:${vr.nextRetryAt.slice(0, 16)}`);
  }
  return parts.length ? parts.join(' · ') : 'voice';
}
