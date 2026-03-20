/**
 * Применение нормализованных событий к сессии + запись audit в подколлекцию events.
 */
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { VoiceCallStatus, VoiceNormalizedWebhookEvent } from '../../../../src/types/voice';
import { applyNormalizedVoiceEvent } from './applyVoiceCallEvent';
import {
  adminCreateVoiceCallEventIfAbsent,
  adminFindVoiceSessionByProviderCallId,
  adminUpdateVoiceCallSession,
  VOICE_CALL_SESSIONS_COLLECTION
} from './voiceFirestoreAdmin';
import { getDb } from '../firebaseAdmin';

function digest(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function dedupeDocId(ev: VoiceNormalizedWebhookEvent): string {
  if (ev.providerEventId?.trim()) {
    return digest(`${ev.providerCallId}|${ev.providerEventId.trim()}`);
  }
  const key = `${ev.type}|${ev.providerCallId}|${ev.occurredAt}|${ev.cause ?? ''}|${ev.durationSec ?? ''}`;
  return digest(key);
}

function parseSessionStatus(v: unknown): VoiceCallStatus {
  const s = String(v ?? 'queued');
  const allowed: VoiceCallStatus[] = [
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
  return allowed.includes(s as VoiceCallStatus) ? (s as VoiceCallStatus) : 'queued';
}

function patchToFirestoreUpdate(patch: ReturnType<typeof applyNormalizedVoiceEvent>['patch']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.status != null) out.status = patch.status;
  if (patch.connectedAtMs != null) {
    out.connectedAt = Timestamp.fromMillis(patch.connectedAtMs);
  }
  if (patch.endedAtMs != null) {
    out.endedAt = Timestamp.fromMillis(patch.endedAtMs);
  }
  if (patch.durationSec !== undefined) {
    out.durationSec = patch.durationSec;
  }
  if (patch.endReason !== undefined) {
    out.endReason = patch.endReason;
  }
  return out;
}

export type IngestOneResult =
  | { ok: true; callId: string; deduped: boolean; sessionUpdated: boolean }
  | { ok: false; reason: string; providerCallId: string };

export async function ingestNormalizedVoiceEvent(ev: VoiceNormalizedWebhookEvent): Promise<IngestOneResult> {
  const sessionRow = await adminFindVoiceSessionByProviderCallId(ev.providerCallId);
  if (!sessionRow?.id) {
    return { ok: false, reason: 'unknown_provider_call_id', providerCallId: ev.providerCallId };
  }

  const callId = sessionRow.id;
  const companyId = String(sessionRow.companyId ?? '');
  if (!companyId) {
    return { ok: false, reason: 'session_missing_company', providerCallId: ev.providerCallId };
  }

  const docId = dedupeDocId(ev);

  const currentStatus = parseSessionStatus(sessionRow.status);

  const applied = applyNormalizedVoiceEvent(currentStatus, ev);
  const fsPatch = patchToFirestoreUpdate(applied.patch);

  const eventPayload: Record<string, unknown> = {
    callId,
    companyId,
    type: ev.type,
    providerEventType: ev.providerEventType ?? null,
    providerCallId: ev.providerCallId,
    fromStatus: applied.fromStatus,
    toStatus: applied.toStatus,
    at: Timestamp.fromMillis(Number.isFinite(Date.parse(ev.occurredAt)) ? Date.parse(ev.occurredAt) : Date.now()),
    payload: {
      normalized: true,
      durationSec: ev.durationSec ?? null,
      cause: ev.cause ?? null,
      rawDigest: ev.rawDigest ?? null,
      dedupeKey: docId
    },
    seq: null
  };

  const inserted = await adminCreateVoiceCallEventIfAbsent(companyId, callId, docId, eventPayload);
  if (!inserted) {
    return { ok: true, callId, deduped: true, sessionUpdated: false };
  }

  if (applied.sessionChanged && Object.keys(fsPatch).length > 0) {
    await adminUpdateVoiceCallSession(companyId, callId, {
      ...fsPatch,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: true, callId, deduped: false, sessionUpdated: true };
  }

  return { ok: true, callId, deduped: false, sessionUpdated: false };
}

/** Для событий без providerCallId в теле (ошибка парсинга) — только логирование через optional collection — пропускаем. */
export async function ingestNormalizedVoiceEvents(
  events: VoiceNormalizedWebhookEvent[]
): Promise<{ results: IngestOneResult[]; unknownOrUnmatched: number }> {
  const results: IngestOneResult[] = [];
  let unknownOrUnmatched = 0;
  for (const ev of events) {
    if (!ev.providerCallId?.trim()) {
      unknownOrUnmatched += 1;
      continue;
    }
    const r = await ingestNormalizedVoiceEvent(ev);
    results.push(r);
    if (!r.ok) unknownOrUnmatched += 1;
  }
  return { results, unknownOrUnmatched };
}

/** Загрузить актуальный статус сессии после возможных гонок (опционально для отладки). */
export async function adminGetSessionRow(callId: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const snap = await db.collection(VOICE_CALL_SESSIONS_COLLECTION).doc(callId).get();
  if (!snap.exists) return null;
  return snap.data() ?? null;
}
