/**
 * Применение нормализованных событий к сессии + запись audit в подколлекцию events.
 */
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { VoiceCallStatus, VoiceNormalizedWebhookEvent } from '../../../../src/types/voice';
import { applyNormalizedVoiceEvent } from './applyVoiceCallEvent';
import {
  adminCreateVoiceCallEventIfAbsent,
  adminFindRecentZadarmaOutboundSession,
  adminFindVoiceSessionByProviderCallId,
  adminFindVoiceSessionByProviderCallIdCandidates,
  adminUpdateVoiceCallSession,
  VOICE_CALL_SESSIONS_COLLECTION
} from './voiceFirestoreAdmin';
import { voiceFriendlyMessageRu } from './voiceProviderFriendlyCodes';
import { getDb } from '../firebaseAdmin';
import { mergeVoiceLifecycleIntoLinkedRun, type VoiceCallSnapshotForRunMerge } from './updateVoiceRunResult';
import { deriveVoiceFailureReason } from './deriveVoiceFailureReason';

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

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}
function s(v: unknown, max = 280): string | null {
  if (v == null) return null;
  const out = String(v).trim();
  if (!out) return null;
  return out.slice(0, max);
}

function classifyProviderReason(status: string | null, sipCode: number | null, errMsg: string | null): string | null {
  if (status === 'busy') return 'busy';
  if (status === 'no-answer') return 'no_answer';
  if (status === 'failed') {
    const m = (errMsg ?? '').toLowerCase();
    if (m.includes('geo') || m.includes('permission') || m.includes('country')) return 'possible_geo_restriction';
    if ((sipCode ?? 0) >= 500) return 'possible_carrier_rejection';
    return 'failed';
  }
  return null;
}

function asIso(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (v && typeof v === 'object' && 'toDate' in (v as { toDate?: unknown })) {
    const toDate = (v as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') {
      const d = toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

export type IngestOneResult =
  | { ok: true; callId: string; deduped: boolean; sessionUpdated: boolean }
  | { ok: false; reason: string; providerCallId: string };

async function resolveVoiceSessionRowForIngest(ev: VoiceNormalizedWebhookEvent): Promise<{
  row: (Record<string, unknown> & { id: string }) | null;
  matchMethod: 'providerCallId' | 'zadarma_id_candidate' | 'zadarma_fallback_toE164' | 'none';
}> {
  let sessionRow = await adminFindVoiceSessionByProviderCallId(ev.providerCallId);
  if (sessionRow?.id) return { row: sessionRow, matchMethod: 'providerCallId' };

  const meta = (ev.providerMeta ?? {}) as Record<string, unknown>;
  const isLikelyZadarma =
    meta.provider === 'zadarma' ||
    (meta.zadarmaLookup && typeof meta.zadarmaLookup === 'object') ||
    String(ev.providerEventType ?? '').startsWith('NOTIFY_');

  if (!isLikelyZadarma) {
    return { row: null, matchMethod: 'none' };
  }

  const rawFlat = (meta.raw as Record<string, string> | undefined) ?? {};
  const candidates: string[] = [];
  const push = (x: string) => {
    const t = String(x ?? '').trim();
    if (t && !candidates.includes(t)) candidates.push(t);
  };
  push(ev.providerCallId);
  const alt = meta.zadarmaAlternateProviderCallIds;
  if (Array.isArray(alt)) {
    for (const x of alt) push(String(x ?? ''));
  }
  for (const k of ['pbx_call_id', 'call_id', 'id']) {
    const v = rawFlat[k];
    if (v) push(String(v));
  }

  const byCand = await adminFindVoiceSessionByProviderCallIdCandidates(candidates);
  if (byCand?.id) return { row: byCand, matchMethod: 'zadarma_id_candidate' };

  if (meta.zadarmaLookup && typeof meta.zadarmaLookup === 'object') {
    const z = meta.zadarmaLookup as { companyId?: string; toE164?: string };
    const cid = String(z.companyId ?? '').trim();
    const to = String(z.toE164 ?? '').trim();
    if (cid && to) {
      const { row: found, ambiguousOpenCount } = await adminFindRecentZadarmaOutboundSession(cid, to);
      if (ambiguousOpenCount > 1 && found?.id) {
        console.log(
          JSON.stringify({
            tag: 'voice.webhook.zadarma.ambiguous_fallback',
            companyId: cid,
            toE164: to,
            ambiguousOpenCount,
            pickedSessionId: found.id,
            webhookPbxCallId: ev.providerCallId
          })
        );
      }
      if (found?.id) return { row: found, matchMethod: 'zadarma_fallback_toE164' };
    }
  }

  return { row: null, matchMethod: 'none' };
}

export async function ingestNormalizedVoiceEvent(ev: VoiceNormalizedWebhookEvent): Promise<IngestOneResult> {
  const match = await resolveVoiceSessionRowForIngest(ev);
  let sessionRow = match.row;

  if (sessionRow?.id && match.matchMethod !== 'providerCallId') {
    const cid = String(sessionRow.companyId ?? '');
    const prevPcid = String(sessionRow.providerCallId ?? '').trim();
    const nextPcid = String(ev.providerCallId ?? '').trim();
    if (cid && nextPcid && prevPcid !== nextPcid) {
      await adminUpdateVoiceCallSession(cid, sessionRow.id, {
        providerCallId: nextPcid,
        'metadata.zadarmaLinkedPbxCallId': nextPcid,
        'metadata.zadarmaLinkAt': new Date().toISOString(),
        'metadata.zadarmaWebhookMatchMethod': match.matchMethod
      });
      sessionRow = { ...sessionRow, providerCallId: nextPcid };
    }
  }

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
      dedupeKey: docId,
      providerMeta: ev.providerMeta ?? null
    },
    seq: null
  };

  const inserted = await adminCreateVoiceCallEventIfAbsent(companyId, callId, docId, eventPayload);
  if (!inserted) {
    return { ok: true, callId, deduped: true, sessionUpdated: false };
  }

  const terminalStatuses = new Set(['completed', 'failed', 'busy', 'no_answer', 'canceled']);
  const postCallTerminal = String(sessionRow.postCallStatus ?? '');
  const shouldQueuePostCall =
    applied.patch.status != null &&
    terminalStatuses.has(String(applied.patch.status)) &&
    !['processing', 'done'].includes(postCallTerminal);

  const meta = (ev.providerMeta ?? {}) as Record<string, unknown>;
  const twilioFinalStatus = s(meta.callStatus, 64);
  const twilioSipResponseCode = n(meta.sipResponseCode) ?? n(meta.statusCode);
  const twilioErrorCode = n(meta.twilioErrorCode);
  const twilioWarningCode = n(meta.twilioWarningCode);
  const twilioErrorMessage = s(meta.twilioErrorMessage, 280);
  const twilioWarningMessage = s(meta.twilioWarningMessage, 280);
  const answeredByMeta = s(meta.answeredBy, 64);
  const fromE164 = s(meta.from, 64);
  const toE164 = s(meta.to, 64);
  const providerReason = classifyProviderReason(twilioFinalStatus, twilioSipResponseCode, twilioErrorMessage);
  const twilioConsoleSearchText =
    String(sessionRow.provider ?? '') === 'zadarma'
      ? `Zadarma pbx_call_id: ${ev.providerCallId}`
      : `Call SID: ${ev.providerCallId}`;
  const providerMetaRaw = (meta.raw as Record<string, unknown> | undefined) ?? null;

  const prevMeta = ((sessionRow.metadata as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const prevDebug = (prevMeta.voiceProviderDebug as Record<string, unknown> | undefined) ?? {};
  const prevTimeline = Array.isArray(prevDebug.callbackTimeline)
    ? (prevDebug.callbackTimeline as unknown[])
    : [];
  const timelineItem: Record<string, unknown> = {
    at: new Date().toISOString(),
    eventType: ev.type,
    providerCallStatus: twilioFinalStatus,
    crmStatusAfter: applied.toStatus,
    sip: twilioSipResponseCode,
    errCode: twilioErrorCode,
    warnCode: twilioWarningCode
  };
  const callbackTimeline = [...prevTimeline, timelineItem].slice(-20);
  const hadInProgress =
    currentStatus === 'in_progress' ||
    applied.fromStatus === 'in_progress' ||
    applied.toStatus === 'in_progress' ||
    prevDebug.hadInProgress === true ||
    !!asIso(sessionRow.connectedAt);
  const effectiveDurationSec =
    ev.durationSec ??
    n(meta.callDuration) ??
    n(sessionRow.durationSec) ??
    (asIso(sessionRow.connectedAt) && asIso(sessionRow.endedAt)
      ? Math.max(
          0,
          Math.floor((Date.parse(asIso(sessionRow.endedAt) ?? '') - Date.parse(asIso(sessionRow.connectedAt) ?? '')) / 1000)
        )
      : 0);
  const voiceProviderDebug: Record<string, unknown> = {
    ...prevDebug,
    lastStatus: twilioFinalStatus,
    lastSipCode: twilioSipResponseCode,
    lastErrorCode: twilioErrorCode,
    lastErrorMessage: twilioErrorMessage,
    lastCallbackAt: new Date().toISOString(),
    hadInProgress,
    durationSec: effectiveDurationSec,
    callbackTimeline,
    lifecycle: {
      createdAt: asIso(sessionRow.startedAt),
      connectedAt: asIso(sessionRow.connectedAt) ?? (applied.toStatus === 'in_progress' ? new Date().toISOString() : null),
      endedAt: asIso(sessionRow.endedAt) ?? (terminalStatuses.has(applied.toStatus) ? new Date().toISOString() : null)
    },
    ...(answeredByMeta ? { lastAnsweredBy: answeredByMeta } : {}),
    ...(s(meta.direction, 32) ? { lastDirection: s(meta.direction, 32) } : {}),
    ...(s(meta.disposition, 96) && String(sessionRow.provider ?? '') === 'zadarma'
      ? { lastZadarmaDisposition: s(meta.disposition, 96) }
      : {})
  };

  const mergedMetadata: Record<string, unknown> = {
    ...prevMeta,
    voiceProviderDebug,
    ...(providerMetaRaw ? { twilioLastCallbackRaw: providerMetaRaw } : {})
  };

  const isZadarmaRecord =
    ev.type === 'provider.unknown' &&
    ev.cause === 'record_ready' &&
    String(ev.providerEventType ?? '') === 'NOTIFY_RECORD';
  if (isZadarmaRecord && inserted) {
    const recUrl = s(meta.zadarmaRecordingUrl as string, 2048);
    if (recUrl) {
      mergedMetadata.zadarmaLastRecordingUrl = recUrl;
      mergedMetadata.zadarmaRecordingAt = new Date().toISOString();
    }
  }

  const durationTail = (ev.durationSec ?? 0) > 0 || (n(meta.callDuration) ?? 0) > 0;
  const failure = deriveVoiceFailureReason({
    crmStatus: applied.toStatus,
    twilioCallStatus: twilioFinalStatus,
    sipResponseCode: twilioSipResponseCode,
    twilioErrorCode,
    twilioErrorMessage,
    twilioWarningCode,
    twilioWarningMessage,
    toE164: toE164 ?? s(sessionRow.toE164, 64),
    durationSec: effectiveDurationSec,
    hadInProgress
  });

  const sessionUpdate: Record<string, unknown> = {
    twilioFinalStatus,
    twilioSipResponseCode,
    twilioErrorCode,
    twilioWarningCode,
    twilioErrorMessage,
    twilioWarningMessage,
    twilioProviderReason: providerReason,
    twilioConsoleSearchText,
    metadata: mergedMetadata,
    ...(fromE164 ? { fromE164 } : {}),
    ...(toE164 ? { toE164 } : {}),
    ...(shouldQueuePostCall ? { postCallStatus: 'pending' } : {})
  };

  if (applied.sessionChanged && Object.keys(fsPatch).length > 0) {
    Object.assign(sessionUpdate, fsPatch);
  }

  if (terminalStatuses.has(applied.toStatus)) {
    if (applied.toStatus === 'completed' && durationTail) {
      sessionUpdate.voiceFailureReasonCode = null;
      sessionUpdate.voiceFailureReasonMessage = null;
      sessionUpdate.providerFailureCode = null;
      sessionUpdate.providerFailureReason = null;
    } else if (applied.toStatus === 'failed' || applied.toStatus === 'busy' || applied.toStatus === 'no_answer') {
      const zfc = s(meta.zadarmaFriendlyFailureCode as string, 80);
      const isZad = String(sessionRow.provider ?? '') === 'zadarma';
      if (isZad && zfc) {
        sessionUpdate.voiceFailureReasonCode = zfc;
        sessionUpdate.voiceFailureReasonMessage = voiceFriendlyMessageRu(zfc);
        sessionUpdate.providerFailureCode = zfc;
        sessionUpdate.providerFailureReason = voiceFriendlyMessageRu(zfc);
      } else if (failure) {
        sessionUpdate.voiceFailureReasonCode = failure.code;
        sessionUpdate.voiceFailureReasonMessage = failure.messageRu;
        sessionUpdate.providerFailureCode = failure.code;
        sessionUpdate.providerFailureReason = failure.messageRu;
      } else {
        sessionUpdate.voiceFailureReasonCode = 'unknown_provider_failure';
        sessionUpdate.voiceFailureReasonMessage = `Исход звонка: ${applied.toStatus}`;
        sessionUpdate.providerFailureCode = 'unknown_provider_failure';
        sessionUpdate.providerFailureReason = sessionUpdate.voiceFailureReasonMessage as string;
      }
    } else if (applied.toStatus === 'completed') {
      sessionUpdate.voiceFailureReasonCode = null;
      sessionUpdate.voiceFailureReasonMessage = null;
      sessionUpdate.providerFailureCode = null;
      sessionUpdate.providerFailureReason = null;
    } else if (applied.toStatus === 'canceled') {
      sessionUpdate.voiceFailureReasonCode = 'unknown_provider_failure';
      sessionUpdate.voiceFailureReasonMessage = 'Звонок отменён.';
      sessionUpdate.providerFailureCode = 'canceled';
      sessionUpdate.providerFailureReason = 'Звонок отменён.';
    } else if (failure) {
      sessionUpdate.voiceFailureReasonCode = failure.code;
      sessionUpdate.voiceFailureReasonMessage = failure.messageRu;
      sessionUpdate.providerFailureCode = failure.code;
      sessionUpdate.providerFailureReason = failure.messageRu;
    }
  }

  if (ev.providerEventId?.trim()) {
    sessionUpdate.providerEventIds = FieldValue.arrayUnion(ev.providerEventId.trim());
  }

  await adminUpdateVoiceCallSession(companyId, callId, sessionUpdate);

  const linkedRunId = s(sessionRow.linkedRunId, 160);
  if (linkedRunId) {
    const voiceCallSnapshot: VoiceCallSnapshotForRunMerge = {
      callStatus: applied.toStatus,
      outcome: s(sessionRow.outcome, 80),
      postCallStatus: s(sessionRow.postCallStatus, 80),
      providerCallId: s(ev.providerCallId, 80),
      provider: s(sessionRow.provider, 80),
      fromE164: fromE164 ?? s(sessionRow.fromE164, 64),
      toE164: toE164 ?? s(sessionRow.toE164, 64),
      followUpStatus: s(sessionRow.followUpStatus, 80),
      followUpError: s(sessionRow.followUpError, 200),
      twilioFinalStatus,
      twilioSipResponseCode,
      twilioErrorCode,
      twilioErrorMessage,
      twilioWarningCode,
      twilioWarningMessage,
      twilioProviderReason: providerReason,
      durationSec: effectiveDurationSec,
      hadInProgress: hadInProgress ? true : null,
      callbackTimeline: callbackTimeline as Array<Record<string, unknown>>,
      lifecycle: (voiceProviderDebug.lifecycle as Record<string, unknown> | undefined) ?? null
    };
    if ('voiceFailureReasonCode' in sessionUpdate) {
      voiceCallSnapshot.voiceFailureReasonCode = sessionUpdate.voiceFailureReasonCode as string | null;
    }
    if ('voiceFailureReasonMessage' in sessionUpdate) {
      voiceCallSnapshot.voiceFailureReasonMessage = sessionUpdate.voiceFailureReasonMessage as string | null;
    }
    if ('providerFailureCode' in sessionUpdate) {
      voiceCallSnapshot.providerFailureCode = sessionUpdate.providerFailureCode as string | null;
    }
    if ('providerFailureReason' in sessionUpdate) {
      voiceCallSnapshot.providerFailureReason = sessionUpdate.providerFailureReason as string | null;
    }
    await mergeVoiceLifecycleIntoLinkedRun({
      companyId,
      linkedRunId,
      voiceCallSnapshot
    });
  }

  return { ok: true, callId, deduped: false, sessionUpdated: applied.sessionChanged };
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
