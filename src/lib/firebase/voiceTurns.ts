/**
 * Подколлекция voiceCallSessions/{callId}/turns — реплики для пост-обработки и отладки.
 */
import { addDoc, getDocs, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import type { VoiceSpeaker, VoiceTurn } from '../../types/voice';
import { getVoiceCallSession, voiceCallTurnsCollection } from './voiceCallSessions';

const SPEAKERS: VoiceSpeaker[] = ['bot', 'client', 'system'];

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseSpeaker(v: unknown): VoiceSpeaker {
  return SPEAKERS.includes(v as VoiceSpeaker) ? (v as VoiceSpeaker) : 'system';
}

export function docToVoiceTurn(id: string, data: Record<string, unknown>): VoiceTurn {
  return {
    id,
    callId: str(data.callId) ?? '',
    companyId: str(data.companyId) ?? '',
    turnIndex: typeof data.turnIndex === 'number' ? data.turnIndex : 0,
    speaker: parseSpeaker(data.speaker),
    text: str(data.text) ?? '',
    rawText: str(data.rawText),
    sttModel: str(data.sttModel),
    ttsVoiceId: str(data.ttsVoiceId),
    startedAt: (data.startedAt as Timestamp | Date | null) ?? null,
    endedAt: (data.endedAt as Timestamp | Date | null) ?? null,
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
    createdAt: (data.createdAt as Timestamp | Date | null) ?? null
  };
}

export type VoiceTurnAppendInput = Omit<VoiceTurn, 'id' | 'createdAt'>;

export async function appendVoiceTurn(
  companyId: string,
  callId: string,
  input: VoiceTurnAppendInput
): Promise<{ turnDocId: string }> {
  const session = await getVoiceCallSession(companyId, callId);
  if (!session) throw new Error('VoiceCallSession not found');
  const col = voiceCallTurnsCollection(callId);
  const ref = await addDoc(col, {
    callId,
    companyId,
    turnIndex: input.turnIndex,
    speaker: input.speaker,
    text: input.text,
    rawText: input.rawText ?? null,
    sttModel: input.sttModel ?? null,
    ttsVoiceId: input.ttsVoiceId ?? null,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    confidence: input.confidence ?? null,
    createdAt: serverTimestamp()
  });
  return { turnDocId: ref.id };
}

export async function listVoiceTurnsForCall(companyId: string, callId: string): Promise<VoiceTurn[]> {
  const session = await getVoiceCallSession(companyId, callId);
  if (!session) return [];
  const q = query(voiceCallTurnsCollection(callId), orderBy('turnIndex', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVoiceTurn(d.id, d.data() as Record<string, unknown>));
}
