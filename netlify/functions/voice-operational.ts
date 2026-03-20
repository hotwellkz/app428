/**
 * Ручные операции Voice: перезвон / назначить callback (тот же linkedRunId, новая сессия при redial).
 */
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyIdToken, getCompanyIdForUser, getDb } from './lib/firebaseAdmin';
import { orchestrateVoiceOutbound } from './lib/voice/voiceOutboundOrchestrator';
import { mergeVoiceRetryStateIntoLinkedRun } from './lib/voice/updateVoiceRunResult';
import { adminGetVoiceCallSession, adminUpdateVoiceCallSession } from './lib/voice/voiceFirestoreAdmin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const RUNS = 'whatsappAiBotRuns';
const MANUAL_COOLDOWN_MS = 60_000;

type Body = {
  action?: 'redial' | 'schedule_callback';
  runId?: string;
  force?: boolean;
  callbackAt?: string;
  callbackNote?: string | null;
};

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const uid = await verifyIdToken(token);
    const companyId = await getCompanyIdForUser(uid);
    if (!companyId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'No company access' }) };
    }

    let body: Body = {};
    try {
      body = event.body ? (JSON.parse(event.body) as Body) : {};
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const runId = String(body.runId ?? '').trim();
    if (!runId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'runId required' }) };
    }

    const db = getDb();
    const runRef = db.collection(RUNS).doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Run not found' }) };
    }
    const run = runSnap.data() ?? {};
    if (String(run.companyId ?? '') !== companyId) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Run company mismatch' }) };
    }

    const ex = (run.extras as Record<string, unknown>) ?? {};
    const vr = (ex.voiceRetry as Record<string, unknown>) ?? {};
    const voiceSnap = (ex.voiceCallSnapshot as Record<string, unknown>) ?? {};
    const sessionId = typeof ex.voiceCallSessionId === 'string' ? ex.voiceCallSessionId.trim() : '';

    const latestSession = sessionId ? await adminGetVoiceCallSession(companyId, sessionId) : null;

    const action = body.action === 'schedule_callback' ? 'schedule_callback' : 'redial';

    if (action === 'redial') {
      const outcome = voiceSnap.outcome != null ? String(voiceSnap.outcome) : '';
      if ((outcome === 'meeting_booked' || outcome === 'no_interest') && !body.force) {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Successful outcome — use force=true to redial' })
        };
      }

      const lastManual = vr.lastManualRedialAt != null ? Date.parse(String(vr.lastManualRedialAt)) : 0;
      if (Number.isFinite(lastManual) && Date.now() - lastManual < MANUAL_COOLDOWN_MS) {
        return {
          statusCode: 429,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Rate limited: wait before next manual redial' })
        };
      }

      const botId = String(run.botId ?? '').trim();
      const toE164 = String(
        run.phoneSnapshot ?? voiceSnap.toE164 ?? latestSession?.toE164 ?? ''
      ).trim();
      if (!botId || !toE164) {
        return {
          statusCode: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing botId or phone for redial' })
        };
      }

      let fromNumberId: string | null = null;
      if (latestSession?.fromNumberId) fromNumberId = String(latestSession.fromNumberId);

      const meta =
        latestSession?.metadata && typeof latestSession.metadata === 'object'
          ? (latestSession.metadata as Record<string, unknown>)
          : {};
      const lineage = (meta.voiceLineage && typeof meta.voiceLineage === 'object' ? meta.voiceLineage : {}) as Record<
        string,
        unknown
      >;
      const rootCallId = lineage.rootCallId != null ? String(lineage.rootCallId) : sessionId || runId;
      const parentCallId = sessionId || null;

      const out = await orchestrateVoiceOutbound(companyId, {
        botId,
        linkedRunId: runId,
        toE164,
        contactId: run.appliedClientId != null ? String(run.appliedClientId) : null,
        clientId: run.clientIdSnapshot != null ? String(run.clientIdSnapshot) : null,
        crmClientId: run.clientIdSnapshot != null ? String(run.clientIdSnapshot) : null,
        fromNumberId,
        metadata: {
          voiceLineage: {
            rootCallId,
            parentCallId,
            attemptOrdinal: Number(vr.manualRedialCount ?? 0) + 1
          },
          voiceRetry: { trigger: 'manual_redial', requestedByUid: uid }
        }
      });

      if (!out.ok) {
        return {
          statusCode: out.httpStatus,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: false, code: out.code, error: out.message })
        };
      }

      const manualCount = Number(vr.manualRedialCount ?? 0) + 1;
      const nextExtras = {
        ...ex,
        voiceCallSessionId: out.callId,
        voiceRetry: {
          ...vr,
          retryReason: 'manual',
          retryStatus: 'dispatched',
          lastManualRedialAt: new Date().toISOString(),
          manualRedialCount: manualCount,
          latestSessionId: out.callId,
          rootCallId,
          parentCallId
        }
      };
      await runRef.set({ extras: nextExtras, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, callId: out.callId, providerCallId: out.providerCallId })
      };
    }

    // schedule_callback
    const rawAt = String(body.callbackAt ?? '').trim();
    if (!rawAt) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'callbackAt ISO string required' }) };
    }
    const atMs = Date.parse(rawAt);
    if (!Number.isFinite(atMs)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid callbackAt' }) };
    }
    const maxFuture = Date.now() + 30 * 86400_000;
    if (atMs > maxFuture || atMs < Date.now() - 60_000) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'callbackAt must be within reasonable window' })
      };
    }

    if (!sessionId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No voiceCallSessionId on run' }) };
    }

    const schedSession = await adminGetVoiceCallSession(companyId, sessionId);
    if (!schedSession) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Voice session not found' }) };
    }
    const schedMeta =
      schedSession.metadata && typeof schedSession.metadata === 'object'
        ? (schedSession.metadata as Record<string, unknown>)
        : {};
    const schedPrevVr =
      schedMeta.voiceRetry && typeof schedMeta.voiceRetry === 'object'
        ? (schedMeta.voiceRetry as Record<string, unknown>)
        : {};

    await adminUpdateVoiceCallSession(companyId, sessionId, {
      voiceRetryStatus: 'scheduled',
      voiceRetryNextAt: Timestamp.fromMillis(atMs),
      voiceRetryCallbackAt: Timestamp.fromMillis(atMs),
      voiceRetryMaxAutoDispatches: 1,
      metadata: {
        ...schedMeta,
        voiceRetry: {
          ...schedPrevVr,
          callbackRequested: true,
          callbackAt: new Date(atMs).toISOString(),
          callbackNote: body.callbackNote ?? null,
          retryReason: 'callback_requested',
          retryStatus: 'scheduled',
          retryEligible: true
        }
      },
      updatedAt: FieldValue.serverTimestamp()
    });

    await mergeVoiceRetryStateIntoLinkedRun({
      companyId,
      linkedRunId: runId,
      voiceRetry: {
        retryStatus: 'scheduled',
        nextRetryAt: new Date(atMs).toISOString(),
        callbackAt: new Date(atMs).toISOString(),
        callbackNote: body.callbackNote ?? null,
        callbackRequested: true,
        retryReason: 'callback_requested',
        maxAutoDispatches: 1
      }
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, scheduledAt: new Date(atMs).toISOString() })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String(e) })
    };
  }
};
