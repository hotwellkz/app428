import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';

export const WHATSAPP_AI_BOT_RUNS_COLLECTION = 'whatsappAiBotRuns';

export type WhatsAppAiBotRunStatus = 'success' | 'error' | 'skipped';

export interface WhatsAppAiBotRunLogInput {
  companyId: string;
  conversationId: string;
  botId: string;
  mode: string;
  triggerMessageId: string;
  startedAt: unknown;
  finishedAt: unknown;
  status: WhatsAppAiBotRunStatus;
  reason?: string | null;
  generatedReply?: string | null;
  extractedSummary?: string | null;
  /** Auto-apply extraction → CRM */
  extractionApplied?: boolean;
  extractionApplyStatus?: 'applied' | 'skipped' | 'error';
  extractionApplyReason?: string | null;
  extractionAppliedFields?: string[] | null;
  extractionAppliedLabels?: string[] | null;
  extractionAppliedFieldCount?: number | null;
  appliedClientId?: string | null;
  extractionAppliedAt?: string | null;
  dealRecommendationForLog?: string | null;
  dealRecommendationStatus?: string | null;
  dealRecommendationReason?: string | null;
  dealDraftTitle?: string | null;
  dealRoutingPipelineId?: string | null;
  dealRoutingPipelineName?: string | null;
  dealRoutingStageId?: string | null;
  dealRoutingStageName?: string | null;
  dealRoutingAssigneeId?: string | null;
  dealRoutingAssigneeName?: string | null;
  dealRoutingReason?: string[] | null;
  dealRoutingWarnings?: string[] | null;
  dealRoutingConfidence?: 'high' | 'medium' | 'low' | null;
  createUsedFallbacks?: string[] | null;
  finalPipelineId?: string | null;
  finalPipelineName?: string | null;
  finalStageId?: string | null;
  finalStageName?: string | null;
  finalAssigneeId?: string | null;
  finalAssigneeName?: string | null;
  /** Рекомендация задачи (следующий шаг) */
  taskRecommendationStatus?: string | null;
  taskRecommendationTitle?: string | null;
  taskRecommendationType?: string | null;
  taskRecommendationPriority?: string | null;
  taskRecommendationDueHint?: string | null;
  taskPayloadHash?: string | null;
  taskCreateStatus?: string | null;
  taskCreateReason?: string | null;
  taskId?: string | null;
  dealId?: string | null;
  finalNextActionAt?: string | null;
  /** Создание сделки (режим deal_create) */
  dealCreateStatus?: string | null;
  dealCreateReason?: string | null;
  createdDealId?: string | null;
  createdDealTitle?: string | null;
  /** Канал чата на момент run */
  channel?: string | null;
  /** Режим runtime: draft | auto | off или служебные */
  runtimeMode?: string | null;
  /** Ошибка extraction с сервера */
  extractionError?: string | null;
  /** Snapshot'ы конкретного run (чтобы не зависеть от текущего aiRuntime в чате). */
  answerSnapshot?: string | null;
  summarySnapshot?: string | null;
  extractedSnapshotJson?: string | null;
  extractionApplySnapshotJson?: string | null;
  dealRecommendationSnapshotJson?: string | null;
  taskRecommendationSnapshotJson?: string | null;
  resultFlagsSnapshotJson?: string | null;
  /** Служебные id/снимки для deep-link и поиска. */
  clientIdSnapshot?: string | null;
  phoneSnapshot?: string | null;
}

/** Документ журнала (чтение в AI-контроле) */
export interface WhatsAppAiBotRunRecord extends WhatsAppAiBotRunLogInput {
  id: string;
  createdAt: Timestamp | Date | null;
  /** Произвольные поля из будущих версий логгера */
  extras?: Record<string, unknown>;
}

/** Аудит запусков AI в WhatsApp (отладка и поддержка). */
export async function addWhatsAppAiBotRunLog(input: WhatsAppAiBotRunLogInput): Promise<string> {
  const ref = await addDoc(collection(db, WHATSAPP_AI_BOT_RUNS_COLLECTION), {
    ...input,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function strArr(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const o = v.map((x) => String(x).trim()).filter(Boolean);
  return o.length ? o : null;
}

export function docToWhatsappAiBotRun(id: string, data: Record<string, unknown>): WhatsAppAiBotRunRecord {
  const knownKeys = new Set([
    'companyId',
    'conversationId',
    'botId',
    'mode',
    'triggerMessageId',
    'startedAt',
    'finishedAt',
    'status',
    'reason',
    'generatedReply',
    'extractedSummary',
    'extractionApplied',
    'extractionApplyStatus',
    'extractionApplyReason',
    'extractionAppliedFields',
    'extractionAppliedLabels',
    'extractionAppliedFieldCount',
    'appliedClientId',
    'extractionAppliedAt',
    'dealRecommendationForLog',
    'dealRecommendationStatus',
    'dealRecommendationReason',
    'dealDraftTitle',
    'dealRoutingPipelineId',
    'dealRoutingPipelineName',
    'dealRoutingStageId',
    'dealRoutingStageName',
    'dealRoutingAssigneeId',
    'dealRoutingAssigneeName',
    'dealRoutingReason',
    'dealRoutingWarnings',
    'dealRoutingConfidence',
    'createUsedFallbacks',
    'finalPipelineId',
    'finalPipelineName',
    'finalStageId',
    'finalStageName',
    'finalAssigneeId',
    'finalAssigneeName',
    'taskRecommendationStatus',
    'taskRecommendationTitle',
    'taskRecommendationType',
    'taskRecommendationPriority',
    'taskRecommendationDueHint',
    'taskPayloadHash',
    'taskCreateStatus',
    'taskCreateReason',
    'taskId',
    'dealId',
    'finalNextActionAt',
    'dealCreateStatus',
    'dealCreateReason',
    'createdDealId',
    'createdDealTitle',
    'channel',
    'runtimeMode',
    'extractionError',
    'answerSnapshot',
    'summarySnapshot',
    'extractedSnapshotJson',
    'extractionApplySnapshotJson',
    'dealRecommendationSnapshotJson',
    'taskRecommendationSnapshotJson',
    'resultFlagsSnapshotJson',
    'clientIdSnapshot',
    'phoneSnapshot',
    'createdAt'
  ]);
  const extras: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(data)) {
    if (!knownKeys.has(k)) extras[k] = val;
  }

  return {
    id,
    companyId: str(data.companyId) ?? '',
    conversationId: str(data.conversationId) ?? '',
    botId: str(data.botId) ?? '',
    mode: str(data.mode) ?? '',
    triggerMessageId: str(data.triggerMessageId) ?? '',
    startedAt: data.startedAt ?? null,
    finishedAt: data.finishedAt ?? null,
    status: (data.status === 'success' || data.status === 'error' || data.status === 'skipped'
      ? data.status
      : 'skipped') as WhatsAppAiBotRunStatus,
    reason: str(data.reason),
    generatedReply: str(data.generatedReply),
    extractedSummary: str(data.extractedSummary),
    extractionApplied: data.extractionApplied === true,
    extractionApplyStatus:
      data.extractionApplyStatus === 'applied' ||
      data.extractionApplyStatus === 'skipped' ||
      data.extractionApplyStatus === 'error'
        ? data.extractionApplyStatus
        : null,
    extractionApplyReason: str(data.extractionApplyReason),
    extractionAppliedFields: strArr(data.extractionAppliedFields),
    extractionAppliedLabels: strArr(data.extractionAppliedLabels),
    extractionAppliedFieldCount:
      typeof data.extractionAppliedFieldCount === 'number' ? data.extractionAppliedFieldCount : null,
    appliedClientId: str(data.appliedClientId),
    extractionAppliedAt: str(data.extractionAppliedAt),
    dealRecommendationForLog: str(data.dealRecommendationForLog),
    dealRecommendationStatus: str(data.dealRecommendationStatus),
    dealRecommendationReason: str(data.dealRecommendationReason),
    dealDraftTitle: str(data.dealDraftTitle),
    dealRoutingPipelineId: str(data.dealRoutingPipelineId),
    dealRoutingPipelineName: str(data.dealRoutingPipelineName),
    dealRoutingStageId: str(data.dealRoutingStageId),
    dealRoutingStageName: str(data.dealRoutingStageName),
    dealRoutingAssigneeId: str(data.dealRoutingAssigneeId),
    dealRoutingAssigneeName: str(data.dealRoutingAssigneeName),
    dealRoutingReason: strArr(data.dealRoutingReason),
    dealRoutingWarnings: strArr(data.dealRoutingWarnings),
    dealRoutingConfidence:
      data.dealRoutingConfidence === 'high' ||
      data.dealRoutingConfidence === 'medium' ||
      data.dealRoutingConfidence === 'low'
        ? data.dealRoutingConfidence
        : null,
    createUsedFallbacks: strArr(data.createUsedFallbacks),
    finalPipelineId: str(data.finalPipelineId),
    finalPipelineName: str(data.finalPipelineName),
    finalStageId: str(data.finalStageId),
    finalStageName: str(data.finalStageName),
    finalAssigneeId: str(data.finalAssigneeId),
    finalAssigneeName: str(data.finalAssigneeName),
    taskRecommendationStatus: str(data.taskRecommendationStatus),
    taskRecommendationTitle: str(data.taskRecommendationTitle),
    taskRecommendationType: str(data.taskRecommendationType),
    taskRecommendationPriority: str(data.taskRecommendationPriority),
    taskRecommendationDueHint: str(data.taskRecommendationDueHint),
    taskPayloadHash: str(data.taskPayloadHash),
    taskCreateStatus: str(data.taskCreateStatus),
    taskCreateReason: str(data.taskCreateReason),
    taskId: str(data.taskId),
    dealId: str(data.dealId),
    finalNextActionAt: str(data.finalNextActionAt),
    dealCreateStatus: str(data.dealCreateStatus),
    dealCreateReason: str(data.dealCreateReason),
    createdDealId: str(data.createdDealId),
    createdDealTitle: str(data.createdDealTitle),
    channel: str(data.channel),
    runtimeMode: str(data.runtimeMode),
    extractionError: str(data.extractionError),
    answerSnapshot: str(data.answerSnapshot),
    summarySnapshot: str(data.summarySnapshot),
    extractedSnapshotJson: str(data.extractedSnapshotJson),
    extractionApplySnapshotJson: str(data.extractionApplySnapshotJson),
    dealRecommendationSnapshotJson: str(data.dealRecommendationSnapshotJson),
    taskRecommendationSnapshotJson: str(data.taskRecommendationSnapshotJson),
    resultFlagsSnapshotJson: str(data.resultFlagsSnapshotJson),
    clientIdSnapshot: str(data.clientIdSnapshot),
    phoneSnapshot: str(data.phoneSnapshot),
    createdAt: (data.createdAt as Timestamp | Date | null) ?? null,
    extras: Object.keys(extras).length ? extras : undefined
  };
}

const MAX_RUNS_SUBSCRIBE = 500;

export function subscribeWhatsappAiBotRuns(
  companyId: string,
  onList: (runs: WhatsAppAiBotRunRecord[]) => void,
  onError?: (e: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, WHATSAPP_AI_BOT_RUNS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(MAX_RUNS_SUBSCRIBE)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => docToWhatsappAiBotRun(d.id, d.data() as Record<string, unknown>));
      onList(list);
    },
    (err) => onError?.(err)
  );
}

export async function getWhatsappAiBotRunById(
  companyId: string,
  runId: string
): Promise<WhatsAppAiBotRunRecord | null> {
  const ref = doc(db, WHATSAPP_AI_BOT_RUNS_COLLECTION, runId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  if (str(data.companyId) !== companyId) return null;
  return docToWhatsappAiBotRun(snap.id, data);
}
