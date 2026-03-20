/**
 * Post-call pipeline для голоса: транскрипт → summary → extraction → CRM → deal/task → WhatsApp (опц.) → сессия + linked run.
 * Не вызывать из Twilio TwiML hot path — только из dispatch / sweep / внутренних задач.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { buildAiDealRecommendationSnapshot } from '../../../../src/lib/autovoronki/aiDealRecommendation';
import { buildAiTaskRecommendationSnapshot } from '../../../../src/lib/autovoronki/aiTaskRecommendation';
import { emptyCrmAiBotExtraction, type CrmAiBotExtractionResult } from '../../../../src/types/crmAiBotExtraction';
import { parseCrmAiBotConfig, type CrmAiBotConfig } from '../../../../src/types/crmAiBotConfig';
import type { VoicePostCallResultMetadata } from '../../../../src/types/voice';
import { tryApplyWhatsappRuntimeExtraction } from '../applyWhatsappRuntimeCrmExtraction';
import { buildAiDealRoutingSnapshot } from '../aiDealRouting';
import { runCrmAiBotExtraction } from '../crmAiBotExtractionOpenAi';
import { applyVoiceTaskRecommendationToDealAdmin } from '../createAiTaskOnDealAdmin';
import { findClientByPhone, getDb } from '../firebaseAdmin';
import { resolveOpenAiKeyForVoice } from './generateVoiceReply';
import { generateVoicePostCallSummary } from './generateVoicePostCallSummary';
import { mergeVoicePostCallIntoLinkedRun, type VoiceCallSnapshotForRunMerge } from './updateVoiceRunResult';
import { sendVoicePostCallWhatsappFollowUp } from './voicePostCallWhatsApp';
import { createVoiceDealFromRecommendationSnapshot } from './voicePostCallDealAdmin';
import { buildVoiceTranscriptFromTurns } from './buildVoiceTranscript';
import { applyVoiceRetryAfterPostCall } from './applyVoiceRetryAfterPostCall';
import { runVoiceQaPipeline } from './runVoiceQaPipeline';
import { emitVoiceOperationalAlertIfNew } from './voiceRetryAlerts';
import {
  adminClaimVoicePostCallProcessing,
  adminGetVoiceCallSession,
  adminListVoiceTurnsOrdered,
  adminUpdateVoiceCallSession
} from './voiceFirestoreAdmin';
import { adminResolveCampaignItemByCall } from './voiceCampaignsAdmin';
import { voiceTurnsToExtractionTranscript } from './voicePostCallToExtractionInput';

const CRM_AI_BOTS = 'crmAiBots';
const PIPELINE_VERSION = 'voice_post_call_v1';

function mergeSessionPostCallMetadata(
  session: Record<string, unknown>,
  postCall: VoicePostCallResultMetadata
): Record<string, unknown> {
  const meta = (session.metadata && typeof session.metadata === 'object' ? session.metadata : {}) as Record<string, unknown>;
  const prev = (meta.postCall && typeof meta.postCall === 'object' ? meta.postCall : {}) as Record<string, unknown>;
  return { ...meta, postCall: { ...prev, ...postCall } };
}

function lightweightSummary(status: string, endReason: string | null): string {
  const r = endReason?.trim() ?? '';
  switch (status) {
    case 'busy':
      return 'Абонент занят, разговор не состоялся.';
    case 'no_answer':
      return 'Нет ответа, разговор не состоялся.';
    case 'failed':
      return `Технический сбой или ошибка звонка${r ? `: ${r}` : ''}.`;
    case 'canceled':
      return 'Звонок отменён.';
    case 'completed':
      return 'Звонок завершён без реплик клиента (нет данных для диалога).';
    default:
      return `Статус звонка: ${status}${r ? ` (${r})` : ''}.`;
  }
}

function isFullConversationPipeline(session: Record<string, unknown>, userTurnCount: number): boolean {
  return String(session.status ?? '') === 'completed' && userTurnCount >= 1;
}

export async function runVoicePostCallPipeline(params: {
  companyId: string;
  callId: string;
  force?: boolean;
}): Promise<{ ok: boolean; skippedReason?: string; error?: string }> {
  const { companyId, callId, force } = params;
  const claim = await adminClaimVoicePostCallProcessing(companyId, callId, force === true);
  if (!claim.claimed || !claim.session) {
    const s = claim.session;
    const ps = String(s?.postCallStatus ?? '');
    if (ps === 'processing') return { ok: true, skippedReason: 'already_processing' };
    if (ps === 'done' && !force) return { ok: true, skippedReason: 'already_done' };
    return { ok: true, skippedReason: 'not_claimed' };
  }

  const warnings: string[] = [];

  try {
    const session = (await adminGetVoiceCallSession(companyId, callId)) ?? claim.session;
    if (!session) {
      throw new Error('Session not found after claim');
    }

    const botId = String(session.botId ?? '').trim();
    const linkedRunId = String(session.linkedRunId ?? '').trim();
    const toE164 = String(session.toE164 ?? '').trim();
    const turnRows = await adminListVoiceTurnsOrdered(companyId, callId, 80);
    const transcript = buildVoiceTranscriptFromTurns(turnRows);
    const extractionMessages = voiceTurnsToExtractionTranscript(turnRows);
    const conversationId = `voice:${callId}`;
    const isFull = isFullConversationPipeline(session, transcript.userTurnCount);

    let summaryText: string | null = null;
    let summaryError: string | null = null;
    let extraction: CrmAiBotExtractionResult = emptyCrmAiBotExtraction();
    let extractionError: string | null = null;
    let extractionJson: string | null = null;
    let crmApplyJson: string | null = null;
    let dealRecommendationJson: string | null = null;
    let taskRecommendationJson: string | null = null;
    let crmApplyStatus: 'applied' | 'skipped' | 'error' | null = null;
    let crmApplyError: string | null = null;
    let dealRecommendationStatus: string | null = null;
    let dealRecommendationError: string | null = null;
    let taskRecommendationStatus: string | null = null;
    let taskRecommendationError: string | null = null;
    let linkedDealId: string | null = String(session.linkedDealId ?? '').trim() || null;
    let linkedTaskId: string | null = String(session.linkedTaskId ?? '').trim() || null;
    let followUpStatus: string | null = null;
    let followUpError: string | null = null;

    const apiKey = await resolveOpenAiKeyForVoice(companyId);

    if (!isFull) {
      summaryText = lightweightSummary(String(session.status ?? 'unknown'), (session.endReason as string) ?? null);
      if (String(session.status) === 'completed' && transcript.userTurnCount === 0 && apiKey) {
        const hint = await generateVoicePostCallSummary({
          apiKey,
          fullTranscript: transcript.fullText || '(нет реплик клиента)',
          toE164: toE164 || '—'
        });
        if ('summary' in hint) summaryText = hint.summary;
        else if ('error' in hint) warnings.push(`summary_hint:${hint.error}`);
      }
    } else {
      if (apiKey && transcript.fullText.trim()) {
        const sum = await generateVoicePostCallSummary({ apiKey, fullTranscript: transcript.fullText, toE164 });
        if ('summary' in sum) summaryText = sum.summary;
        else {
          summaryError = sum.error;
          summaryText = transcript.fullText.slice(0, 1200);
          warnings.push('summary_fallback_transcript');
        }
      } else {
        summaryText = transcript.fullText.slice(0, 1200) || null;
        if (!apiKey) warnings.push('no_openai_key_summary');
      }

      if (apiKey && extractionMessages.length > 0) {
        const ex = await runCrmAiBotExtraction(apiKey, extractionMessages);
        if (ex.ok) {
          extraction = ex.extracted;
          extractionJson = ex.raw;
        } else {
          extractionError = ex.error;
          warnings.push(`extraction:${ex.error}`);
        }
      } else {
        extractionError = extractionMessages.length === 0 ? 'Нет реплик для extraction' : 'Нет API-ключа';
        warnings.push('extraction_skipped');
      }
    }

    let config: CrmAiBotConfig | null = null;
    let botName = 'AI-бот';
    if (botId) {
      const botSnap = await getDb().collection(CRM_AI_BOTS).doc(botId).get();
      if (botSnap.exists) {
        const bd = botSnap.data() ?? {};
        botName = String((bd as { name?: string }).name ?? '').trim() || botName;
        try {
          config = parseCrmAiBotConfig((bd as { config?: unknown }).config);
          botName = config.persona?.botDisplayName?.trim() || botName;
        } catch (e) {
          warnings.push(`bot_config_parse:${e instanceof Error ? e.message : 'err'}`);
        }
      } else {
        warnings.push('bot_not_found');
      }
    }

    const crmActions: CrmAiBotConfig['crmActions'] =
      config?.crmActions ?? {
        autofillClientCard: false,
        autofillExtractedFields: false,
        autoDetectCity: false,
        autoQualifyLead: false,
        suggestCreateDeal: false,
        saveConversationSummary: false,
        saveNextStep: false
      };

    let crmClientId =
      (typeof session.crmClientId === 'string' && session.crmClientId.trim()) ||
      (typeof session.clientId === 'string' && session.clientId.trim()) ||
      null;
    if (!crmClientId && toE164) {
      const c = await findClientByPhone(toE164, companyId);
      crmClientId = c?.id ?? null;
    }

    if (isFull) {
      const apply = await tryApplyWhatsappRuntimeExtraction({
        companyId,
        clientId: crmClientId,
        channel: 'voice',
        extraction,
        crmActions
      });
      crmApplyStatus = apply.extractionApplyStatus;
      crmApplyJson = JSON.stringify(apply);
      if (apply.extractionApplyStatus === 'error') {
        crmApplyError = apply.extractionApplyReason;
      }

      let clientData: Record<string, unknown> = {};
      if (crmClientId) {
        const cs = await getDb().collection('clients').doc(crmClientId).get();
        if (cs.exists) clientData = cs.data() ?? {};
      }

      let routing;
      try {
        routing = await buildAiDealRoutingSnapshot({ companyId, clientData, extraction });
      } catch (e) {
        routing = undefined;
        warnings.push(`routing:${e instanceof Error ? e.message : 'err'}`);
      }

      let dealRecommendation;
      try {
        dealRecommendation = buildAiDealRecommendationSnapshot({
          extraction,
          crmActions,
          channel: 'voice',
          clientId: crmClientId,
          conversationId,
          botId: botId || 'unknown',
          botName,
          dealRecommendationForLog: apply.dealRecommendationForLog,
          routing
        });
        dealRecommendationJson = JSON.stringify(dealRecommendation);
        dealRecommendationStatus = dealRecommendation.status;
      } catch (e) {
        dealRecommendationError = e instanceof Error ? e.message : 'deal_rec_failed';
        dealRecommendation = buildAiDealRecommendationSnapshot({
          extraction: emptyCrmAiBotExtraction(),
          crmActions,
          channel: 'voice',
          clientId: crmClientId,
          conversationId,
          botId: botId || 'unknown',
          botName,
          dealRecommendationForLog: null
        });
        dealRecommendationJson = JSON.stringify(dealRecommendation);
        dealRecommendationStatus = 'error';
      }

      if (!linkedDealId && dealRecommendation.status === 'recommended' && crmActions.suggestCreateDeal) {
        const created = await createVoiceDealFromRecommendationSnapshot({
          companyId,
          voiceCallId: callId,
          snapshot: dealRecommendation
        });
        if (created.ok) {
          linkedDealId = created.dealId;
        } else {
          dealRecommendationError = dealRecommendationError
            ? `${dealRecommendationError}; ${created.message}`
            : created.message;
          warnings.push(`deal_create:${created.code}`);
        }
      }

      let dealContext: {
        dealId: string;
        responsibleUserId: string | null;
        responsibleNameSnapshot: string | null;
      } | null = null;
      if (linkedDealId) {
        const ds = await getDb().collection('deals').doc(linkedDealId).get();
        const dd = ds.data();
        if (ds.exists && dd && (dd.companyId as string) === companyId) {
          dealContext = {
            dealId: linkedDealId,
            responsibleUserId: (dd.responsibleUserId as string | null) ?? null,
            responsibleNameSnapshot: (dd.responsibleNameSnapshot as string | null) ?? null
          };
        }
      }

      let taskRecommendation;
      try {
        taskRecommendation = buildAiTaskRecommendationSnapshot({
          extraction,
          dealRecommendation,
          conversationId,
          botId: botId || 'unknown',
          botName,
          triggerMessageId: `voice_${callId}`,
          channel: 'voice',
          dealContext
        });
        taskRecommendationJson = JSON.stringify(taskRecommendation);
        taskRecommendationStatus = taskRecommendation.status;
      } catch (e) {
        taskRecommendationError = e instanceof Error ? e.message : 'task_rec_failed';
        taskRecommendation = buildAiTaskRecommendationSnapshot({
          extraction: emptyCrmAiBotExtraction(),
          dealRecommendation: null,
          conversationId,
          botId: botId || 'unknown',
          botName,
          triggerMessageId: `voice_${callId}`,
          channel: 'voice',
          dealContext: null
        });
        taskRecommendationJson = JSON.stringify(taskRecommendation);
        taskRecommendationStatus = 'error';
      }

      if (
        linkedDealId &&
        taskRecommendation.canCreateTask &&
        crmActions.saveNextStep === true &&
        taskRecommendation.status !== 'skipped' &&
        taskRecommendation.status !== 'insufficient_data'
      ) {
        const tr = await applyVoiceTaskRecommendationToDealAdmin({
          companyId,
          dealId: linkedDealId,
          voiceCallId: callId,
          taskPayloadHash: taskRecommendation.payloadHash,
          taskSnapshot: taskRecommendation as unknown as Record<string, unknown>
        });
        if (tr.ok) {
          linkedTaskId = tr.taskId;
        } else if (tr.code !== 'duplicate') {
          taskRecommendationError = tr.message;
          warnings.push(`task_apply:${tr.code}`);
        }
      }
    }

    if (isFull && crmActions.saveConversationSummary === true && summaryText?.trim()) {
      const fu = await sendVoicePostCallWhatsappFollowUp({
        companyId,
        toE164,
        text: `Кратко по звонку:\n${summaryText}`.slice(0, 4000)
      });
      if (fu.ok) {
        followUpStatus = fu.status;
        if (fu.status === 'skipped') {
          followUpError = fu.reason;
        }
      } else {
        followUpStatus = 'error';
        followUpError = fu.message;
        warnings.push(`follow_up:${fu.message}`);
      }
    } else {
      followUpStatus = 'skipped';
      followUpError = null;
    }

    const postCall: VoicePostCallResultMetadata = {
      pipelineVersion: PIPELINE_VERSION,
      lightweight: !isFull,
      transcriptLineCount: transcript.lines.length,
      summary: summaryText,
      summaryError,
      extractionJson: extractionJson ?? undefined,
      extractionError: extractionError ?? undefined,
      dealSnapshotJson: dealRecommendationJson ?? undefined,
      taskSnapshotJson: taskRecommendationJson ?? undefined,
      dealCreateError: dealRecommendationError ?? undefined,
      taskApplyError: taskRecommendationError ?? undefined,
      followUpError: followUpError ?? undefined,
      warnings: warnings.length ? warnings : undefined,
      linkedRunUpdated: false
    };

    let linkedRunUpdated = false;
    if (linkedRunId) {
      const voiceCallSnapshot: VoiceCallSnapshotForRunMerge = {
        callStatus: String(session.status ?? ''),
        outcome: session.outcome != null ? String(session.outcome) : null,
        postCallStatus: 'done',
        providerCallId: session.providerCallId != null ? String(session.providerCallId) : null,
        provider: session.provider != null ? String(session.provider) : null,
        fromE164: session.fromE164 != null ? String(session.fromE164) : null,
        toE164: toE164 || null,
        followUpStatus: followUpStatus ?? null,
        followUpError: followUpError ?? null
      };
      const merge = await mergeVoicePostCallIntoLinkedRun({
        companyId,
        linkedRunId,
        callId,
        botId: botId || 'unknown',
        conversationIdSynthetic: conversationId,
        summary: summaryText,
        extractionJson,
        extractionApplySnapshotJson: crmApplyJson,
        dealRecommendationSnapshotJson: dealRecommendationJson,
        taskRecommendationSnapshotJson: taskRecommendationJson,
        postCall,
        extractionApplied: crmApplyStatus === 'applied',
        extractionApplyStatus: crmApplyStatus,
        crmClientId,
        phoneE164: toE164 || null,
        linkedDealId,
        linkedTaskId,
        voiceCallSnapshot
      });
      linkedRunUpdated = merge.ok;
      if (!merge.ok) warnings.push(`linked_run:${merge.error ?? 'merge_failed'}`);
      postCall.linkedRunUpdated = linkedRunUpdated;
    } else {
      warnings.push('missing_linked_run_id');
    }

    const extractionStatus: 'ok' | 'skipped' | 'error' =
      !isFull ? 'skipped' : extractionError ? 'error' : 'ok';

    await adminUpdateVoiceCallSession(companyId, callId, {
      postCallStatus: 'done',
      postCallCompletedAt: FieldValue.serverTimestamp(),
      postCallError: null,
      postCallSummary: summaryText,
      extractionStatus,
      extractionError: extractionError ?? null,
      crmApplyStatus: crmApplyStatus ?? (isFull ? 'skipped' : null),
      crmApplyError: crmApplyError ?? null,
      dealRecommendationStatus: dealRecommendationStatus ?? null,
      dealRecommendationError: dealRecommendationError ?? null,
      taskRecommendationStatus: taskRecommendationStatus ?? null,
      taskRecommendationError: taskRecommendationError ?? null,
      linkedDealId: linkedDealId ?? null,
      linkedTaskId: linkedTaskId ?? null,
      followUpChannel: isFull && crmActions.saveConversationSummary === true ? 'whatsapp' : null,
      followUpStatus: followUpStatus ?? null,
      followUpError: followUpError ?? null,
      metadata: mergeSessionPostCallMetadata(session, postCall)
    });

    const freshSession =
      (await adminGetVoiceCallSession(companyId, callId)) ?? { ...session, id: callId };
    try {
      const vcMeta =
        freshSession?.metadata && typeof freshSession.metadata === 'object'
          ? ((freshSession.metadata as Record<string, unknown>).voiceCampaign as Record<string, unknown> | undefined)
          : undefined;
      const campaignId = vcMeta?.campaignId != null ? String(vcMeta.campaignId) : '';
      const campaignItemId = vcMeta?.campaignItemId != null ? String(vcMeta.campaignItemId) : '';
      if (campaignId && campaignItemId) {
        await adminResolveCampaignItemByCall({
          companyId,
          campaignId,
          campaignItemId,
          callStatus: String(freshSession.status ?? ''),
          outcome: freshSession.outcome != null ? String(freshSession.outcome) : null
        });
      }
    } catch (ce) {
      console.error('[runVoicePostCallPipeline] campaign completion sync', ce);
    }
    try {
      await applyVoiceRetryAfterPostCall({
        companyId,
        callId,
        linkedRunId,
        session: freshSession,
        extraction: isFull ? extraction : null,
        summaryText
      });
    } catch (re) {
      console.error('[runVoicePostCallPipeline] applyVoiceRetryAfterPostCall', re);
    }
    try {
      await runVoiceQaPipeline({
        companyId,
        callId,
        linkedRunId,
        extraction: isFull ? extraction : null,
        userTurnCount: transcript.userTurnCount
      });
    } catch (qe) {
      console.error('[runVoicePostCallPipeline] runVoiceQaPipeline', qe);
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await adminUpdateVoiceCallSession(companyId, callId, {
        postCallStatus: 'failed',
        postCallCompletedAt: FieldValue.serverTimestamp(),
        postCallError: msg
      });
      const failSession = await adminGetVoiceCallSession(companyId, callId);
      const lr = String(failSession?.linkedRunId ?? '').trim();
      if (lr) {
        await emitVoiceOperationalAlertIfNew({
          companyId,
          linkedRunId: lr,
          kind: 'post_call_failed',
          title: 'Voice: post-call pipeline failed',
          message: `run ${lr.slice(0, 10)}… · call ${callId.slice(0, 8)}… · ${msg.slice(0, 200)}`,
          dedupKey: `voice:post_call_failed:${callId}`
        });
      }
    } catch (ee) {
      console.error('[runVoicePostCallPipeline] failed to write error state', ee);
    }
    return { ok: false, error: msg };
  }
}
