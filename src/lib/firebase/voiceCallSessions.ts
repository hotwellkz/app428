/**
 * Data access: voice call sessions (client SDK).
 * Запись с браузера закрыта firestore.rules — create/update для webhook/оркестратора через Admin SDK
 * (`netlify/functions/lib/voice/voiceFirestoreAdmin.ts`).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
  onSnapshot
} from 'firebase/firestore';
import { db } from './config';
import type {
  VoiceCallSession,
  VoiceCallSessionCreateInput,
  VoiceCallSessionUpdateInput,
  VoiceCallStatus,
  VoiceChannel,
  VoiceCallDirection,
  VoiceOutcome,
  VoicePostCallStatus,
  VoiceProviderId
} from '../../types/voice';

export const VOICE_CALL_SESSIONS_COLLECTION = 'voiceCallSessions';
export const VOICE_CALL_EVENTS_SUBCOLLECTION = 'events';
export const VOICE_CALL_TURNS_SUBCOLLECTION = 'turns';

export function voiceCallSessionRef(callId: string) {
  return doc(db, VOICE_CALL_SESSIONS_COLLECTION, callId);
}

export function voiceCallEventsCollection(callId: string) {
  return collection(db, VOICE_CALL_SESSIONS_COLLECTION, callId, VOICE_CALL_EVENTS_SUBCOLLECTION);
}

export function voiceCallTurnsCollection(callId: string) {
  return collection(db, VOICE_CALL_SESSIONS_COLLECTION, callId, VOICE_CALL_TURNS_SUBCOLLECTION);
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseChannel(v: unknown): VoiceChannel {
  return v === 'voice' ? 'voice' : 'voice';
}

function parseDirection(v: unknown): VoiceCallDirection {
  return v === 'outbound' ? 'outbound' : 'outbound';
}

const STATUSES: VoiceCallStatus[] = [
  'queued',
  'dialing',
  'ringing',
  'in_progress',
  'completed',
  'failed',
  'busy',
  'no_answer',
  'canceled'
];

function parseStatus(v: unknown): VoiceCallStatus {
  return STATUSES.includes(v as VoiceCallStatus) ? (v as VoiceCallStatus) : 'queued';
}

const OUTCOMES: VoiceOutcome[] = ['meeting_booked', 'callback', 'no_interest', 'unknown'];
function parseOutcome(v: unknown): VoiceOutcome | null {
  if (v == null || v === '') return null;
  return OUTCOMES.includes(v as VoiceOutcome) ? (v as VoiceOutcome) : null;
}

const POST: VoicePostCallStatus[] = ['pending', 'processing', 'done', 'failed'];
function parsePostCall(v: unknown): VoicePostCallStatus | undefined {
  if (v == null || v === '') return undefined;
  return POST.includes(v as VoicePostCallStatus) ? (v as VoicePostCallStatus) : undefined;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

export function docToVoiceCallSession(id: string, data: Record<string, unknown>): VoiceCallSession {
  return {
    id,
    companyId: str(data.companyId) ?? '',
    botId: str(data.botId) ?? '',
    channel: parseChannel(data.channel),
    direction: parseDirection(data.direction),
    status: parseStatus(data.status),
    provider: (str(data.provider) ?? 'unknown') as VoiceProviderId,
    providerCallId: str(data.providerCallId),
    providerAccountId: str(data.providerAccountId),
    fromNumberId: str(data.fromNumberId),
    fromE164: str(data.fromE164),
    toE164: str(data.toE164) ?? '',
    contactId: str(data.contactId),
    clientId: str(data.clientId),
    crmClientId: str(data.crmClientId),
    conversationId: str(data.conversationId),
    linkedRunId: str(data.linkedRunId) ?? '',
    startedAt: (data.startedAt as Timestamp | Date | null) ?? null,
    connectedAt: (data.connectedAt as Timestamp | Date | null) ?? null,
    endedAt: (data.endedAt as Timestamp | Date | null) ?? null,
    durationSec: num(data.durationSec),
    endReason: str(data.endReason),
    outcome: parseOutcome(data.outcome),
    postCallStatus: parsePostCall(data.postCallStatus),
    postCallError: str(data.postCallError),
    linkedDealId: str(data.linkedDealId),
    linkedTaskId: str(data.linkedTaskId),
    followUpChannel: str(data.followUpChannel),
    followUpStatus: str(data.followUpStatus),
    twilioFinalStatus: str(data.twilioFinalStatus),
    twilioSipResponseCode: num(data.twilioSipResponseCode),
    twilioErrorCode: num(data.twilioErrorCode),
    twilioErrorMessage: str(data.twilioErrorMessage),
    twilioWarningCode: num(data.twilioWarningCode),
    twilioWarningMessage: str(data.twilioWarningMessage),
    twilioProviderReason: str(data.twilioProviderReason),
    twilioConsoleSearchText: str(data.twilioConsoleSearchText),
    voiceFailureReasonCode: str(data.voiceFailureReasonCode),
    voiceFailureReasonMessage: str(data.voiceFailureReasonMessage),
    metadata: (data.metadata as Record<string, unknown> | undefined) ?? undefined,
    createdAt: (data.createdAt as Timestamp | Date | null) ?? null,
    updatedAt: (data.updatedAt as Timestamp | Date | null) ?? null
  };
}

function assertCompany(session: VoiceCallSession, companyId: string): void {
  if (session.companyId !== companyId) {
    throw new Error('VoiceCallSession company mismatch');
  }
}

/** Реплики звонка для AI-control / деталей run (read-only). */
export async function getVoiceCallTurnsOrdered(
  companyId: string,
  callId: string,
  max = 60
): Promise<Array<{ id: string; speaker: string; text: string; turnIndex: number }>> {
  const lim = Math.min(Math.max(max, 1), 80);
  const q = query(
    voiceCallTurnsCollection(callId),
    orderBy('turnIndex', 'asc'),
    limit(lim)
  );
  const snap = await getDocs(q);
  const out: Array<{ id: string; speaker: string; text: string; turnIndex: number }> = [];
  for (const d of snap.docs) {
    const x = d.data() as Record<string, unknown>;
    if (String(x.companyId ?? '') !== companyId) continue;
    out.push({
      id: d.id,
      speaker: String(x.speaker ?? ''),
      text: String(x.text ?? ''),
      turnIndex: Number(x.turnIndex ?? 0)
    });
  }
  return out;
}

export async function getVoiceCallSession(companyId: string, callId: string): Promise<VoiceCallSession | null> {
  const snap = await getDoc(voiceCallSessionRef(callId));
  if (!snap.exists()) return null;
  const row = docToVoiceCallSession(snap.id, snap.data() as Record<string, unknown>);
  assertCompany(row, companyId);
  return row;
}

export async function getVoiceCallSessionByLinkedRunId(
  companyId: string,
  linkedRunId: string
): Promise<VoiceCallSession | null> {
  const q = query(
    collection(db, VOICE_CALL_SESSIONS_COLLECTION),
    where('companyId', '==', companyId),
    where('linkedRunId', '==', linkedRunId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return docToVoiceCallSession(d.id, d.data() as Record<string, unknown>);
}

export type ListVoiceSessionsOptions = {
  status?: VoiceCallStatus;
  max?: number;
};

/**
 * Список сессий компании. С `status` — orderBy startedAt; без — orderBy createdAt.
 */
export async function listVoiceCallSessionsByCompany(
  companyId: string,
  options?: ListVoiceSessionsOptions
): Promise<VoiceCallSession[]> {
  const max = Math.min(Math.max(options?.max ?? 50, 1), 200);
  const base = collection(db, VOICE_CALL_SESSIONS_COLLECTION);
  let q;
  if (options?.status != null) {
    q = query(
      base,
      where('companyId', '==', companyId),
      where('status', '==', options.status),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
  } else {
    q = query(base, where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(max));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVoiceCallSession(d.id, d.data() as Record<string, unknown>));
}

export function subscribeVoiceCallSession(
  companyId: string,
  callId: string,
  onData: (session: VoiceCallSession | null) => void,
  onError?: (e: unknown) => void
): Unsubscribe {
  return onSnapshot(
    voiceCallSessionRef(callId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const row = docToVoiceCallSession(snap.id, snap.data() as Record<string, unknown>);
      try {
        assertCompany(row, companyId);
      } catch (e) {
        onError?.(e);
        onData(null);
        return;
      }
      onData(row);
    },
    (err) => onError?.(err)
  );
}

export type CreateVoiceCallSessionResult = { callId: string };

/**
 * Создание документа сессии. С клиента сработает только если rules разрешат (сейчас — нет).
 */
export async function createVoiceCallSession(
  input: VoiceCallSessionCreateInput
): Promise<CreateVoiceCallSessionResult> {
  const ref = doc(collection(db, VOICE_CALL_SESSIONS_COLLECTION));
  const callId = ref.id;
  const payload = {
    companyId: input.companyId,
    botId: input.botId,
    channel: input.channel ?? 'voice',
    direction: input.direction ?? 'outbound',
    status: input.status,
    provider: input.provider,
    providerCallId: input.providerCallId ?? null,
    providerAccountId: input.providerAccountId ?? null,
    fromNumberId: input.fromNumberId ?? null,
    fromE164: input.fromE164 ?? null,
    toE164: input.toE164,
    contactId: input.contactId ?? null,
    clientId: input.clientId ?? null,
    crmClientId: input.crmClientId ?? null,
    conversationId: input.conversationId ?? null,
    linkedRunId: input.linkedRunId,
    startedAt: input.startedAt ?? null,
    connectedAt: input.connectedAt ?? null,
    endedAt: input.endedAt ?? null,
    durationSec: input.durationSec ?? null,
    endReason: input.endReason ?? null,
    outcome: input.outcome ?? null,
    postCallStatus: input.postCallStatus ?? 'pending',
    postCallError: input.postCallError ?? null,
    linkedDealId: input.linkedDealId ?? null,
    linkedTaskId: input.linkedTaskId ?? null,
    followUpChannel: input.followUpChannel ?? null,
    followUpStatus: input.followUpStatus ?? null,
    metadata: input.metadata ?? {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload);
  return { callId };
}

export async function updateVoiceCallSession(
  companyId: string,
  callId: string,
  patch: VoiceCallSessionUpdateInput
): Promise<void> {
  const ref = voiceCallSessionRef(callId);
  const existing = await getVoiceCallSession(companyId, callId);
  if (!existing) throw new Error('VoiceCallSession not found');
  const { updatedAt: _u, ...rest } = patch;
  const cleaned = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  );
  await updateDoc(ref, {
    ...cleaned,
    updatedAt: serverTimestamp()
  });
}

/**
 * Частичное обновление / создание по известному callId (merge). Не перезаписывает createdAt, если документ уже есть.
 */
export async function upsertVoiceCallSession(
  companyId: string,
  callId: string,
  data: Record<string, unknown>
): Promise<void> {
  const ref = voiceCallSessionRef(callId);
  await setDoc(
    ref,
    {
      ...data,
      companyId,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
