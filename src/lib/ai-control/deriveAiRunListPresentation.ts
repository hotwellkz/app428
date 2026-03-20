import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import type { AiControlAggregatedStatus } from '../../types/aiControl';
import { humanizeFallbackReason } from './fallbackReasonLabels';
import { channelBadgeLabel, deriveAiRunChannelFromRun, type AiControlDerivedChannel } from './deriveAiRunChannel';
import {
  formatVoiceRunStatusLine,
  getVoiceCallSnapshotFromRun,
  getVoicePostCallFromRun,
  getVoiceRetryFromRun,
  getVoiceQaFromRun
} from './voiceRunBridge';

export type RunSourceType = 'snapshot' | 'fallback' | 'unknown';

export interface AiRunListPresentation {
  source: RunSourceType;
  sourceLabel: string;
  answerPreview: string | null;
  summaryPreview: string | null;
  summaryLine: string;
  runStatus: 'success' | 'skipped' | 'duplicate' | 'error';
  crmLabel: 'CRM applied' | 'CRM skipped' | 'CRM no changes' | 'CRM error';
  dealLabel: 'deal created' | 'deal recommended' | null;
  taskLabel: 'task created' | 'task recommended' | null;
  hasApply: boolean;
  hasDeal: boolean;
  hasTask: boolean;
  isFallback: boolean;
  hasSnapshot: boolean;
  requiresAttention: boolean;
  attentionReasons: string[];
  badges: string[];
  /** Канал для UI (voice / whatsapp / …) */
  derivedChannel: AiControlDerivedChannel;
  /** Voice: компактная операционная строка (статусы звонка / post-call) */
  voiceOperationalLine: string | null;
}

function preview(text: string | null | undefined, max = 140): string | null {
  if (!text || !text.trim()) return null;
  const one = text.trim().replace(/\s+/g, ' ');
  return one.length <= max ? one : one.slice(0, max) + '…';
}

export function deriveAiRunListPresentation(
  run: WhatsAppAiBotRunRecord,
  aggregated: AiControlAggregatedStatus
): AiRunListPresentation {
  const derivedChannel = deriveAiRunChannelFromRun(run);
  const isVoice = derivedChannel === 'voice';
  const voiceSnap = getVoiceCallSnapshotFromRun(run);
  const voicePost = getVoicePostCallFromRun(run);
  const voiceQa = getVoiceQaFromRun(run);
  const voiceOperationalLine = isVoice ? formatVoiceRunStatusLine(run) : null;

  const hasSnapshot = !!(
    run.answerSnapshot ||
    run.summarySnapshot ||
    run.extractedSnapshotJson ||
    run.extractionApplySnapshotJson ||
    run.dealRecommendationSnapshotJson ||
    run.taskRecommendationSnapshotJson
  );

  const hasLegacySignals = !!(
    run.generatedReply ||
    run.extractedSummary ||
    run.extractionApplyStatus ||
    run.dealRecommendationStatus ||
    run.taskRecommendationStatus
  );
  const source: RunSourceType = hasSnapshot ? 'snapshot' : hasLegacySignals ? 'fallback' : 'unknown';
  const sourceLabel = source === 'snapshot' ? 'snapshot' : source === 'fallback' ? 'fallback' : 'unknown';

  const answerPreview = preview(run.answerSnapshot || run.generatedReply, 160);
  const summaryPreview = preview(run.summarySnapshot || run.extractedSummary, 140);
  const hasExtraction = !!(run.extractedSnapshotJson || run.extractedSummary || run.summarySnapshot);
  const hasReply = !!answerPreview;
  const hasApply = run.extractionApplyStatus === 'applied';
  const hasDealCreate = run.dealCreateStatus === 'created' || !!run.createdDealId;
  const hasDealRec = run.dealRecommendationStatus === 'recommended' && !hasDealCreate;
  const hasTaskCreate = run.taskCreateStatus === 'created';
  const hasTaskRec = run.taskRecommendationStatus === 'recommended' && !hasTaskCreate;

  let crmLabel: AiRunListPresentation['crmLabel'] = 'CRM no changes';
  if (run.extractionApplyStatus === 'applied') crmLabel = 'CRM applied';
  else if (run.extractionApplyStatus === 'error') crmLabel = 'CRM error';
  else if (run.extractionApplyStatus === 'skipped') crmLabel = 'CRM skipped';

  const dealLabel = hasDealCreate ? 'deal created' : hasDealRec ? 'deal recommended' : null;
  const taskLabel = hasTaskCreate ? 'task created' : hasTaskRec ? 'task recommended' : null;

  const runStatus: AiRunListPresentation['runStatus'] =
    aggregated === 'error'
      ? 'error'
      : aggregated === 'duplicate'
        ? 'duplicate'
        : aggregated === 'skipped' || aggregated === 'paused' || aggregated === 'off'
          ? 'skipped'
          : 'success';

  const reason = (run.reason ?? '').toLowerCase();
  const attentionReasons: string[] = [];
  if (runStatus === 'error') attentionReasons.push('Ошибка runtime/API');
  if (runStatus === 'skipped') attentionReasons.push(run.reason ? `Skipped: ${run.reason}` : 'Run пропущен');
  if (source === 'fallback') attentionReasons.push('Использован fallback');
  if (!hasExtraction && !(isVoice && voicePost?.lightweight)) {
    attentionReasons.push('Extraction не получен');
  }
  if (crmLabel === 'CRM error') attentionReasons.push('Ошибка при записи в CRM');
  if (run.extractionApplyStatus === 'skipped' && !(isVoice && voicePost?.lightweight)) {
    attentionReasons.push('CRM apply пропущен');
  }
  if (hasDealRec && !hasDealCreate) attentionReasons.push('Сделка рекомендована, но не создана');
  if (hasTaskRec && !hasTaskCreate) attentionReasons.push('Задача рекомендована, но не создана');
  if (runStatus === 'duplicate') attentionReasons.push('Обнаружен duplicate');
  if (reason.includes('пауз') || reason.includes('paused')) attentionReasons.push('Бот на паузе');

  if (isVoice) {
    const reviewClosed =
      voiceQa?.reviewStatus === 'reviewed' ||
      voiceQa?.reviewStatus === 'false_positive' ||
      voiceQa?.reviewStatus === 'ignored';
    if (voiceSnap?.postCallStatus === 'failed') attentionReasons.push('Голос: post-call pipeline завершился с ошибкой');
    if (voicePost?.extractionError) attentionReasons.push(`Голос: extraction — ${voicePost.extractionError}`);
    if (voicePost?.summaryError) attentionReasons.push(`Голос: summary — ${voicePost.summaryError}`);
    if (voicePost?.dealCreateError) attentionReasons.push(`Голос: сделка — ${voicePost.dealCreateError}`);
    if (voicePost?.taskApplyError) attentionReasons.push(`Голос: задача — ${voicePost.taskApplyError}`);
    if (voiceSnap?.followUpStatus === 'error' || (voicePost?.followUpError && voiceSnap?.followUpStatus !== 'skipped')) {
      attentionReasons.push(`Голос: follow-up WhatsApp — ${voiceSnap?.followUpError || voicePost?.followUpError || 'ошибка'}`);
    }
    if (
      voiceSnap?.callStatus === 'completed' &&
      voiceSnap.outcome === 'unknown' &&
      !(run.summarySnapshot || run.extractedSummary || voicePost?.summary)?.toString().trim()
    ) {
      attentionReasons.push('Голос: завершён, outcome unknown и нет сводки');
    }
    if (isVoice && !run.extras?.voiceCallSessionId && !voiceSnap) {
      attentionReasons.push('Голос: нет привязки к voiceCallSession в extras');
    }
    const vr = getVoiceRetryFromRun(run);
    if (vr?.retryStatus === 'exhausted') {
      attentionReasons.push('Голос: исчерпаны авто-повторы (retry exhausted)');
    }
    if (vr?.retryStatus === 'scheduled' && vr.nextRetryAt) {
      const t = Date.parse(vr.nextRetryAt);
      if (Number.isFinite(t) && t < Date.now()) {
        attentionReasons.push('Голос: запланированный retry просрочен (ждёт sweep)');
      }
    }
    if (voiceQa?.status === 'failed') attentionReasons.push('Голос QA: pipeline failed');
    if (voiceSnap?.voiceFailureReasonCode === 'telecom_route_uncertain') {
      attentionReasons.push('Голос: вероятное ограничение маршрута/оператора (telecom route)');
    }
    if (!reviewClosed && voiceQa?.needsReview) attentionReasons.push('Голос QA: требуется ручной review');
    if (!reviewClosed && voiceQa?.flags?.includes('missing_next_step')) {
      attentionReasons.push('Голос QA: не зафиксирован next step');
    }
    if (!reviewClosed && voiceQa?.flags?.includes('unknown_outcome')) {
      attentionReasons.push('Голос QA: outcome неясен');
    }
  }

  const requiresAttention = attentionReasons.length > 0;

  const summaryParts: string[] = [];
  summaryParts.push(hasReply ? 'Ответ есть' : 'Ответа нет');
  summaryParts.push(hasExtraction ? 'extraction есть' : 'extraction нет');
  summaryParts.push(crmLabel.replace('CRM ', 'CRM '));
  if (hasDealCreate) summaryParts.push('сделка создана');
  else if (hasDealRec) summaryParts.push('сделка рекомендована');
  if (hasTaskCreate) summaryParts.push('задача создана');
  else if (hasTaskRec) summaryParts.push('задача рекомендована');
  if (runStatus === 'skipped' && run.reason) return {
    source,
    sourceLabel,
    answerPreview,
    summaryPreview,
    summaryLine: `Skipped: ${run.reason}`,
    runStatus,
    crmLabel,
    dealLabel,
    taskLabel,
    hasApply,
    hasDeal: !!dealLabel,
    hasTask: !!taskLabel,
    isFallback: source === 'fallback',
    hasSnapshot,
    requiresAttention,
    attentionReasons,
    badges: [],
    derivedChannel,
    voiceOperationalLine
  };
  if (isVoice && voiceOperationalLine) summaryParts.unshift(voiceOperationalLine);
  if (isVoice && voiceQa?.status === 'done') {
    summaryParts.push(`QA ${voiceQa.score ?? '—'}/${voiceQa.band ?? '—'}`);
  } else if (isVoice && voiceQa?.status === 'failed') {
    summaryParts.push('QA failed');
  }
  if (runStatus === 'duplicate') summaryParts.unshift(`Duplicate: ${run.reason || 'уже применено'}`);
  if (runStatus === 'error') summaryParts.unshift(`Error: ${run.reason || 'runtime'}`);
  if ((run.createUsedFallbacks?.length ?? 0) > 0) {
    const firstFallback = humanizeFallbackReason(run.createUsedFallbacks?.[0] ?? '');
    summaryParts.push(`Fallback: ${firstFallback}`);
  }

  const runtimeMode = (run.runtimeMode || run.mode || '').toLowerCase();
  const badges: string[] = [];
  if (isVoice) badges.push(channelBadgeLabel(derivedChannel));
  if (isVoice && voiceQa?.status === 'done') {
    badges.push(`QA ${voiceQa.band ?? '—'}`);
    if (voiceQa.needsReview) badges.push('QA review');
    if (voiceQa.reviewStatus && voiceQa.reviewStatus !== 'none') badges.push(`review:${voiceQa.reviewStatus}`);
  }
  if (isVoice && voiceQa?.status === 'failed') badges.push('QA failed');
  if (runStatus === 'error') badges.push('Ошибка');
  if ((run.createUsedFallbacks?.length ?? 0) > 0 || source === 'fallback') badges.push('Fallback');
  if (hasExtraction) badges.push('Extraction');
  if (run.extractionApplyStatus === 'applied') badges.push('CRM apply');
  if (hasDealCreate || hasDealRec) badges.push('Сделка');
  if (hasTaskCreate || hasTaskRec) badges.push('Задача');
  if (runtimeMode === 'draft') badges.push('Draft');
  if (runtimeMode === 'auto') badges.push('Auto');
  if (runStatus === 'skipped' || reason.includes('пауз') || reason.includes('paused')) badges.push('Paused/Skipped');
  if (runStatus === 'duplicate' || run.dealCreateStatus === 'duplicate' || run.taskCreateStatus === 'duplicate') {
    badges.push('Duplicate');
  }

  return {
    source,
    sourceLabel,
    answerPreview,
    summaryPreview,
    summaryLine: summaryParts.join(' • '),
    runStatus,
    crmLabel,
    dealLabel,
    taskLabel,
    hasApply,
    hasDeal: !!dealLabel,
    hasTask: !!taskLabel,
    isFallback: source === 'fallback',
    hasSnapshot,
    requiresAttention,
    attentionReasons,
    badges,
    derivedChannel,
    voiceOperationalLine
  };
}
