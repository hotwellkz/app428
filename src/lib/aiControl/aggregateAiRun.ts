import type { Timestamp } from 'firebase/firestore';
import type { AiControlAggregatedStatus, AiRunResultFlags } from '../../types/aiControl';
import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';
import { deriveAiRunChannelFromRun } from '../ai-control/deriveAiRunChannel';
import { getVoiceCallSnapshotFromRun, getVoicePostCallFromRun } from '../ai-control/voiceRunBridge';

export function runCreatedAtMs(run: WhatsAppAiBotRunRecord): number {
  const t = run.createdAt;
  if (!t) return 0;
  if (typeof (t as Timestamp).toMillis === 'function') return (t as Timestamp).toMillis();
  if (t instanceof Date) return t.getTime();
  return 0;
}

export function computeRunResultFlags(run: WhatsAppAiBotRunRecord): AiRunResultFlags {
  const mode = (run.mode ?? '').toLowerCase();
  const applyOk = run.extractionApplyStatus === 'applied';
  const dealCreated =
    run.dealCreateStatus === 'created' ||
    (mode === 'deal_create' && run.status === 'success' && !!run.createdDealId);
  const taskCreated = run.taskCreateStatus === 'created';
  const hasReply = !!(run.generatedReply && String(run.generatedReply).trim());
  const isDraft = mode === 'draft';
  const isAuto = mode === 'auto';
  const isVoice = deriveAiRunChannelFromRun(run) === 'voice';
  const vSnap = isVoice ? getVoiceCallSnapshotFromRun(run) : null;
  const vPost = isVoice ? getVoicePostCallFromRun(run) : null;
  const voiceWarning =
    isVoice &&
    (vSnap?.postCallStatus === 'failed' ||
      !!vPost?.extractionError ||
      !!vPost?.summaryError ||
      vSnap?.followUpStatus === 'error');
  const hasWarning =
    (run.createUsedFallbacks?.length ?? 0) > 0 ||
    (run.dealRoutingWarnings?.length ?? 0) > 0 ||
    run.dealRoutingConfidence === 'low' ||
    run.extractionApplyStatus === 'error' ||
    !!run.extractionError ||
    voiceWarning;
  const isDuplicate =
    (typeof run.reason === 'string' && /duplicate|уже создана|дубл/i.test(run.reason)) ||
    run.taskCreateStatus === 'duplicate' ||
    run.dealCreateStatus === 'duplicate';

  return {
    hasCrmApply: applyOk,
    hasDealCreate: !!dealCreated,
    hasTaskCreate: taskCreated,
    hasAiReply: hasReply,
    isDraftMode: isDraft,
    isAutoMode: isAuto,
    hasWarningSignals: hasWarning,
    isDuplicate
  };
}

export function computeAggregatedStatus(run: WhatsAppAiBotRunRecord): AiControlAggregatedStatus {
  const reason = (run.reason ?? '').toLowerCase();
  if (reason.includes('паузе') || reason.includes('paused') || reason.includes('bot_paused')) return 'paused';
  if (run.runtimeMode === 'off' || reason.includes('выключ')) return 'off';

  if (run.status === 'error') return 'error';
  if (run.status === 'skipped') {
    const flags = computeRunResultFlags(run);
    if (flags.isDuplicate || reason.includes('duplicate') || reason.includes('уже создана')) return 'duplicate';
    return 'skipped';
  }

  if (run.status === 'success') {
    const flags = computeRunResultFlags(run);
    if (flags.hasWarningSignals) return 'warning';
    if (flags.hasAiReply && run.extractionApplyStatus === 'skipped' && !flags.hasCrmApply) return 'partial';
    return 'success';
  }

  return 'skipped';
}
