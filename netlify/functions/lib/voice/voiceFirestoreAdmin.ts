/**
 * Voice: запись в Firestore через Admin SDK (webhook / оркестратор). Обходит client rules.
 * Не содержит логики провайдера.
 */
import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';

export const VOICE_CALL_SESSIONS_COLLECTION = 'voiceCallSessions';
export const VOICE_CALL_EVENTS_SUBCOLLECTION = 'events';
export const VOICE_CALL_TURNS_SUBCOLLECTION = 'turns';
export const VOICE_NUMBERS_COLLECTION = 'voiceNumbers';

export type VoiceCallSessionAdminWrite = Record<string, unknown>;

async function assertSessionCompany(db: Firestore, companyId: string, callId: string): Promise<void> {
  const snap = await db.collection(VOICE_CALL_SESSIONS_COLLECTION).doc(callId).get();
  if (!snap.exists) throw new Error('VoiceCallSession not found');
  const c = snap.data()?.companyId;
  if (String(c) !== companyId) throw new Error('VoiceCallSession company mismatch');
}

export async function adminCreateVoiceCallSession(data: VoiceCallSessionAdminWrite): Promise<string> {
  const db = getDb();
  const ref = db.collection(VOICE_CALL_SESSIONS_COLLECTION).doc();
  const callId = ref.id;
  await ref.set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return callId;
}

export async function adminUpdateVoiceCallSession(
  companyId: string,
  callId: string,
  patch: VoiceCallSessionAdminWrite
): Promise<void> {
  const db = getDb();
  await assertSessionCompany(db, companyId, callId);
  await db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .doc(callId)
    .set(
      {
        ...patch,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
}

export async function adminAppendVoiceCallEvent(
  companyId: string,
  callId: string,
  event: {
    type: string;
    providerEventType?: string | null;
    providerCallId?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    at?: Timestamp | Date | null;
    payload?: Record<string, unknown>;
    seq?: number | null;
  }
): Promise<string> {
  const db = getDb();
  await assertSessionCompany(db, companyId, callId);
  const col = db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .doc(callId)
    .collection(VOICE_CALL_EVENTS_SUBCOLLECTION);
  const ref = await col.add({
    callId,
    companyId,
    type: event.type,
    providerEventType: event.providerEventType ?? null,
    providerCallId: event.providerCallId ?? null,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    at: event.at ?? FieldValue.serverTimestamp(),
    payload: event.payload ?? {},
    seq: event.seq ?? null,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function adminAppendVoiceTurn(
  companyId: string,
  callId: string,
  turn: {
    turnIndex: number;
    speaker: string;
    text: string;
    rawText?: string | null;
    sttModel?: string | null;
    ttsVoiceId?: string | null;
    startedAt?: Timestamp | Date | null;
    endedAt?: Timestamp | Date | null;
    confidence?: number | null;
  }
): Promise<string> {
  const db = getDb();
  await assertSessionCompany(db, companyId, callId);
  const col = db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .doc(callId)
    .collection(VOICE_CALL_TURNS_SUBCOLLECTION);
  const ref = await col.add({
    callId,
    companyId,
    turnIndex: turn.turnIndex,
    speaker: turn.speaker,
    text: turn.text,
    rawText: turn.rawText ?? null,
    sttModel: turn.sttModel ?? null,
    ttsVoiceId: turn.ttsVoiceId ?? null,
    startedAt: turn.startedAt ?? null,
    endedAt: turn.endedAt ?? null,
    confidence: turn.confidence ?? null,
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function adminGetVoiceCallSession(
  companyId: string,
  callId: string
): Promise<Record<string, unknown> & { id: string } | null> {
  const db = getDb();
  const snap = await db.collection(VOICE_CALL_SESSIONS_COLLECTION).doc(callId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (String(d.companyId) !== companyId) return null;
  return { id: snap.id, ...d };
}

export async function adminUpsertVoiceNumber(
  numberId: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const ref = db.collection(VOICE_NUMBERS_COLLECTION).doc(numberId);
  const snap = await ref.get();
  await ref.set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
    },
    { merge: true }
  );
}

/** Одна сессия по providerCallId (P0: глобально уникальный id от провайдера). */
export async function adminFindVoiceSessionByProviderCallId(
  providerCallId: string
): Promise<(Record<string, unknown> & { id: string }) | null> {
  if (!providerCallId.trim()) return null;
  const db = getDb();
  const q = await db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .where('providerCallId', '==', providerCallId)
    .limit(1)
    .get();
  if (q.empty) return null;
  const d = q.docs[0];
  return { id: d.id, ...d.data() };
}

export async function adminGetDefaultVoiceNumberForCompany(
  companyId: string
): Promise<{ id: string; e164: string; data: Record<string, unknown> } | null> {
  const db = getDb();
  const q = await db
    .collection(VOICE_NUMBERS_COLLECTION)
    .where('companyId', '==', companyId)
    .where('isDefault', '==', true)
    .limit(1)
    .get();
  if (q.empty) return null;
  const d = q.docs[0];
  const e164 = String(d.data()?.e164 ?? '').trim();
  if (!e164) return null;
  return { id: d.id, e164, data: d.data() };
}

export async function adminGetVoiceNumberForCompany(
  companyId: string,
  numberId: string
): Promise<{ id: string; e164: string; data: Record<string, unknown> } | null> {
  const db = getDb();
  const snap = await db.collection(VOICE_NUMBERS_COLLECTION).doc(numberId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (String(d.companyId) !== companyId) return null;
  const e164 = String(d.e164 ?? '').trim();
  if (!e164) return null;
  return { id: snap.id, e164, data: d };
}

/**
 * Запись события с фиксированным id документа (идемпотентность webhook).
 * @returns true если документ создан, false если уже был.
 */
export async function adminCreateVoiceCallEventIfAbsent(
  companyId: string,
  callId: string,
  eventDocId: string,
  eventRow: Record<string, unknown>
): Promise<boolean> {
  const db = getDb();
  await assertSessionCompany(db, companyId, callId);
  const ref = db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .doc(callId)
    .collection(VOICE_CALL_EVENTS_SUBCOLLECTION)
    .doc(eventDocId);
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set({
    ...eventRow,
    createdAt: FieldValue.serverTimestamp()
  });
  return true;
}
