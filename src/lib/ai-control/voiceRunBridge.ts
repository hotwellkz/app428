/**
 * Чтение voice-bridge полей из whatsappAiBotRuns (extras + корень документа).
 */
import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import type { VoicePostCallResultMetadata } from '../../types/voice';

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
  return {
    callStatus: typeof o.callStatus === 'string' ? o.callStatus : undefined,
    outcome: o.outcome != null ? String(o.outcome) : null,
    postCallStatus: o.postCallStatus != null ? String(o.postCallStatus) : null,
    providerCallId: o.providerCallId != null ? String(o.providerCallId) : null,
    provider: o.provider != null ? String(o.provider) : null,
    fromE164: o.fromE164 != null ? String(o.fromE164) : null,
    toE164: o.toE164 != null ? String(o.toE164) : null,
    followUpStatus: o.followUpStatus != null ? String(o.followUpStatus) : null,
    followUpError: o.followUpError != null ? String(o.followUpError) : null
  };
}

export function getVoiceCallSessionIdFromRun(run: WhatsAppAiBotRunRecord): string | null {
  const id = run.extras?.voiceCallSessionId;
  if (typeof id === 'string' && id.trim()) return id.trim();
  return null;
}

/** Компактная строка статусов звонка для списка. */
export function formatVoiceRunStatusLine(run: WhatsAppAiBotRunRecord): string {
  const snap = getVoiceCallSnapshotFromRun(run);
  const vp = getVoicePostCallFromRun(run);
  const parts: string[] = [];
  if (snap?.callStatus) parts.push(snap.callStatus);
  if (snap?.outcome) parts.push(`outcome:${snap.outcome}`);
  if (snap?.postCallStatus) parts.push(`post:${snap.postCallStatus}`);
  else if (vp?.lightweight) parts.push('post:light');
  if (snap?.followUpStatus && snap.followUpStatus !== 'skipped') parts.push(`WA:${snap.followUpStatus}`);
  return parts.length ? parts.join(' · ') : 'voice';
}
