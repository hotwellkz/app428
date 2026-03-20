/**
 * Подколлекция voiceCallSessions/{callId}/events — аудит и нормализованные события.
 * Запись с клиента закрыта rules; запись с сервера — Admin SDK.
 */
import { addDoc, getDocs, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import type { VoiceCallEvent } from '../../types/voice';
import { getVoiceCallSession, voiceCallEventsCollection } from './voiceCallSessions';

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function docToVoiceCallEvent(id: string, data: Record<string, unknown>): VoiceCallEvent {
  return {
    id,
    callId: str(data.callId) ?? '',
    companyId: str(data.companyId) ?? '',
    type: str(data.type) ?? 'unknown',
    providerEventType: str(data.providerEventType),
    providerCallId: str(data.providerCallId),
    fromStatus: str(data.fromStatus),
    toStatus: str(data.toStatus),
    at: (data.at as Timestamp | Date | null) ?? null,
    payload: (data.payload as Record<string, unknown> | undefined) ?? undefined,
    seq: typeof data.seq === 'number' ? data.seq : null,
    createdAt: (data.createdAt as Timestamp | Date | null) ?? null
  };
}

export type VoiceCallEventAppendInput = Omit<VoiceCallEvent, 'id' | 'createdAt'> & {
  at?: Timestamp | Date | null;
};

export async function appendVoiceCallEvent(
  companyId: string,
  callId: string,
  input: VoiceCallEventAppendInput
): Promise<{ eventId: string }> {
  const session = await getVoiceCallSession(companyId, callId);
  if (!session) throw new Error('VoiceCallSession not found');
  const col = voiceCallEventsCollection(callId);
  const ref = await addDoc(col, {
    callId,
    companyId,
    type: input.type,
    providerEventType: input.providerEventType ?? null,
    providerCallId: input.providerCallId ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    at: input.at ?? serverTimestamp(),
    payload: input.payload ?? {},
    seq: input.seq ?? null,
    createdAt: serverTimestamp()
  });
  return { eventId: ref.id };
}

export async function listVoiceCallEventsForCall(
  companyId: string,
  callId: string
): Promise<VoiceCallEvent[]> {
  const session = await getVoiceCallSession(companyId, callId);
  if (!session) return [];
  const q = query(voiceCallEventsCollection(callId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVoiceCallEvent(d.id, d.data() as Record<string, unknown>));
}
