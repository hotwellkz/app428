import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import type { AiControlAggregatedStatus } from '../../types/aiControl';
import { humanizeFallbackReason } from './fallbackReasonLabels';

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
  badges: string[];
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
  const requiresAttention =
    runStatus === 'error' ||
    (runStatus === 'skipped' && (reason.includes('пауз') || reason.includes('missing') || reason.includes('permission'))) ||
    source === 'fallback' ||
    !hasExtraction ||
    crmLabel === 'CRM error' ||
    (!!dealLabel && !hasDealCreate) ||
    (!!taskLabel && !hasTaskCreate);

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
    badges: []
  };
  if (runStatus === 'duplicate') summaryParts.unshift(`Duplicate: ${run.reason || 'уже применено'}`);
  if (runStatus === 'error') summaryParts.unshift(`Error: ${run.reason || 'runtime'}`);
  if ((run.createUsedFallbacks?.length ?? 0) > 0) {
    const firstFallback = humanizeFallbackReason(run.createUsedFallbacks?.[0] ?? '');
    summaryParts.push(`Fallback: ${firstFallback}`);
  }

  const badges = [
    sourceLabel,
    hasReply ? 'answer' : 'no answer',
    hasExtraction ? 'extracted' : 'no extraction',
    crmLabel.toLowerCase(),
    dealLabel,
    taskLabel,
    runStatus,
    (run.mode || '').toLowerCase() === 'draft' && hasReply ? 'draft ready' : null
  ].filter(Boolean) as string[];

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
    badges
  };
}
