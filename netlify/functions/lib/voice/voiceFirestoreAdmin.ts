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

/** Поиск сессии по первому совпавшему providerCallId (Zadarma: pbx_call_id vs pending id). */
export async function adminFindVoiceSessionByProviderCallIdCandidates(
  candidateIds: string[]
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const uniq = [...new Set(candidateIds.map((x) => String(x ?? '').trim()).filter(Boolean))];
  for (const id of uniq) {
    const row = await adminFindVoiceSessionByProviderCallId(id);
    if (row?.id) return row;
  }
  return null;
}

function sessionStartedAtMs(row: Record<string, unknown>): number {
  const s = row.startedAt;
  if (s && typeof s === 'object' && 'toMillis' in s && typeof (s as { toMillis: () => number }).toMillis === 'function') {
    return (s as { toMillis: () => number }).toMillis();
  }
  if (s instanceof Date) return s.getTime();
  if (typeof s === 'string') {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/**
 * Zadarma: первый webhook приходит с pbx_call_id, а сессия создана с providerCallId zadarma:{companyId}:{callId}.
 * Ищем недавнюю исходящую сессию по companyId + toE164.
 */
export type ZadarmaRecentSessionLookup = {
  row: (Record<string, unknown> & { id: string }) | null;
  /** Сколько «открытых» сессий найдено (если больше 1 — неоднозначность). */
  ambiguousOpenCount: number;
};

export async function adminFindRecentZadarmaOutboundSession(
  companyId: string,
  toE164: string
): Promise<ZadarmaRecentSessionLookup> {
  const db = getDb();
  const to = String(toE164 ?? '').trim();
  if (!companyId.trim() || !to) return { row: null, ambiguousOpenCount: 0 };
  const q = await db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .where('companyId', '==', companyId)
    .where('provider', '==', 'zadarma')
    .where('toE164', '==', to)
    .limit(25)
    .get();
  const open = new Set(['queued', 'dialing', 'ringing', 'in_progress']);
  const rows = q.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => open.has(String(r.status ?? 'queued')));
  if (rows.length === 0) return { row: null, ambiguousOpenCount: 0 };
  rows.sort((a, b) => sessionStartedAtMs(b) - sessionStartedAtMs(a));
  return {
    row: rows[0] as Record<string, unknown> & { id: string },
    ambiguousOpenCount: rows.length
  };
}

/** Legacy документы без поля provider считаем twilio. */
export function voiceNumberRowProvider(data: Record<string, unknown> | undefined): string {
  const p = String(data?.provider ?? 'twilio').trim();
  return p || 'twilio';
}

export async function adminGetDefaultVoiceNumberForCompany(
  companyId: string,
  providerId: string = 'twilio'
): Promise<{ id: string; e164: string; data: Record<string, unknown> } | null> {
  const db = getDb();
  const q = await db
    .collection(VOICE_NUMBERS_COLLECTION)
    .where('companyId', '==', companyId)
    .where('isDefault', '==', true)
    .get();
  if (q.empty) return null;
  for (const doc of q.docs) {
    const row = doc.data();
    if (voiceNumberRowProvider(row) !== providerId) continue;
    const e164 = String(row?.e164 ?? '').trim();
    if (!e164) continue;
    return { id: doc.id, e164, data: row };
  }
  return null;
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

export type AdminVoiceTurnRow = {
  id: string;
  turnIndex: number;
  speaker: string;
  text: string;
  rawText?: string | null;
  confidence?: number | null;
};

/** Реплики сессии по turnIndex (голосовой loop / транскрипт). */
export async function adminListVoiceTurnsOrdered(
  companyId: string,
  callId: string,
  max: number
): Promise<AdminVoiceTurnRow[]> {
  const db = getDb();
  await assertSessionCompany(db, companyId, callId);
  const lim = Math.min(Math.max(max, 1), 80);
  const snap = await db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .doc(callId)
    .collection(VOICE_CALL_TURNS_SUBCOLLECTION)
    .orderBy('turnIndex', 'asc')
    .limit(lim)
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      turnIndex: Number(x.turnIndex ?? 0),
      speaker: String(x.speaker ?? ''),
      text: String(x.text ?? ''),
      rawText: x.rawText != null ? String(x.rawText) : null,
      confidence: typeof x.confidence === 'number' ? x.confidence : null
    };
  });
}

function voiceRetryNextAtToMillis(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && v && 'toMillis' in (v as { toMillis?: unknown })) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  return null;
}

/** Сессии с назначенным авто-retry, время наступило (scheduled sweep). */
export async function adminListVoiceSessionsDueRetry(max: number): Promise<Array<{ id: string; companyId: string }>> {
  const db = getDb();
  const lim = Math.min(Math.max(max, 1), 40);
  const now = Timestamp.now();
  const q = await db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .where('voiceRetryStatus', '==', 'scheduled')
    .where('voiceRetryNextAt', '<=', now)
    .limit(lim)
    .get();
  return q.docs
    .map((d) => ({
      id: d.id,
      companyId: String(d.data()?.companyId ?? '').trim()
    }))
    .filter((x) => x.companyId.length > 0);
}

/**
 * Идемпотентный claim: scheduled → dispatching, только если nextRetryAt наступил.
 */
export async function adminClaimVoiceRetryDispatch(
  companyId: string,
  callId: string,
  nowMs: number
): Promise<{ claimed: boolean; session: (Record<string, unknown> & { id: string }) | null }> {
  const db = getDb();
  const ref = db.collection(VOICE_CALL_SESSIONS_COLLECTION).doc(callId);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      return { claimed: false, session: null };
    }
    const d = snap.data()!;
    if (String(d.companyId ?? '') !== companyId) {
      return { claimed: false, session: { id: snap.id, ...d } };
    }
    const st = String(d.voiceRetryStatus ?? '');
    if (st !== 'scheduled') {
      return { claimed: false, session: { id: snap.id, ...d } };
    }
    const nextMs = voiceRetryNextAtToMillis(d.voiceRetryNextAt);
    if (nextMs != null && nextMs > nowMs) {
      return { claimed: false, session: { id: snap.id, ...d } };
    }
    transaction.update(ref, {
      voiceRetryStatus: 'dispatching',
      voiceRetryDispatchStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { claimed: true, session: { id: snap.id, ...d } };
  });
}

/** Сессии с postCallStatus=pending (для scheduled sweep). */
export async function adminListVoiceSessionsPendingPostCall(
  max: number
): Promise<Array<{ id: string; companyId: string }>> {
  const db = getDb();
  const lim = Math.min(Math.max(max, 1), 50);
  const q = await db
    .collection(VOICE_CALL_SESSIONS_COLLECTION)
    .where('postCallStatus', '==', 'pending')
    .limit(lim)
    .get();
  return q.docs
    .map((d) => ({
      id: d.id,
      companyId: String(d.data()?.companyId ?? '').trim()
    }))
    .filter((x) => x.companyId.length > 0);
}

/**
 * Атомарно: pending → processing. При force — повторный запуск с processing (не из processing).
 */
export async function adminClaimVoicePostCallProcessing(
  companyId: string,
  callId: string,
  force: boolean
): Promise<{ claimed: boolean; session: (Record<string, unknown> & { id: string }) | null }> {
  const db = getDb();
  const ref = db.collection(VOICE_CALL_SESSIONS_COLLECTION).doc(callId);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      return { claimed: false, session: null };
    }
    const d = snap.data()!;
    if (String(d.companyId ?? '') !== companyId) {
      return { claimed: false, session: { id: snap.id, ...d } };
    }
    const ps = String(d.postCallStatus ?? '');
    if (!force) {
      if (ps === 'processing') {
        return { claimed: false, session: { id: snap.id, ...d } };
      }
      if (ps !== 'pending') {
        return { claimed: false, session: { id: snap.id, ...d } };
      }
    } else if (ps === 'processing') {
      return { claimed: false, session: { id: snap.id, ...d } };
    }

    transaction.update(ref, {
      postCallStatus: 'processing',
      postCallStartedAt: FieldValue.serverTimestamp(),
      postCallError: null,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { claimed: true, session: { id: snap.id, ...d } };
  });
}
