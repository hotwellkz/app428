import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  setDoc,
  getDoc,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';
import type {
  AiRunAlertEventType,
  AiRunWorkflowEventType,
  AiRunWorkflowPriority,
  AiRunWorkflowResolutionType,
  AiRunWorkflowStatus
} from '../../types/aiControl';

export const WHATSAPP_AI_RUN_WORKFLOW_COLLECTION = 'whatsappAiRunWorkflow';

export interface WhatsAppAiRunWorkflowRecord {
  id: string;
  companyId: string;
  runId: string;
  status: AiRunWorkflowStatus;
  assigneeId?: string | null;
  assigneeName?: string | null;
  lastComment?: string | null;
  updatedAt?: Timestamp | Date | null;
  updatedBy?: string | null;
  resolvedAt?: Timestamp | Date | null;
  resolutionType?: AiRunWorkflowResolutionType | null;
  firstAttentionAt?: Timestamp | Date | null;
  dueAt?: Timestamp | Date | null;
  slaMinutes?: number | null;
  priority?: AiRunWorkflowPriority | null;
  priorityReason?: string[] | null;
  history?: WhatsAppAiRunWorkflowEvent[] | null;
  alertState?: WhatsAppAiRunAlertState | null;
  notificationHistory?: WhatsAppAiRunNotificationEvent[] | null;
}

export interface WhatsAppAiRunWorkflowEvent {
  type: AiRunWorkflowEventType;
  at: Timestamp | Date | null;
  by?: string | null;
  byName?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface WhatsAppAiRunAlertState {
  firstAlertAt?: Timestamp | Date | null;
  lastAlertAt?: Timestamp | Date | null;
  lastReminderAt?: Timestamp | Date | null;
  lastEscalationAt?: Timestamp | Date | null;
  reminderCount?: number | null;
  escalationCount?: number | null;
  mutedUntil?: Timestamp | Date | null;
  snoozedUntil?: Timestamp | Date | null;
  lastAlertKey?: string | null;
  sentKeys?: string[] | null;
}

export interface WhatsAppAiRunNotificationEvent {
  type: AiRunAlertEventType;
  target?: string | null;
  channel: 'internal' | 'telegram';
  status: 'sent' | 'skipped' | 'muted' | 'deduped' | 'failed';
  sentAt: Timestamp | Date | null;
  key?: string | null;
  error?: string | null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseStatus(v: unknown): AiRunWorkflowStatus {
  return v === 'new' || v === 'in_progress' || v === 'resolved' || v === 'ignored' || v === 'escalated' ? v : 'new';
}

function parseResolution(v: unknown): AiRunWorkflowResolutionType | null {
  return v === 'fixed' || v === 'manual_apply' || v === 'manual_deal' || v === 'manual_task' || v === 'ignored' || v === 'escalated'
    ? v
    : null;
}

function parsePriority(v: unknown): AiRunWorkflowPriority | null {
  return v === 'critical' || v === 'high' || v === 'normal' || v === 'low' ? v : null;
}

function strArr(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x).trim()).filter(Boolean);
  return out.length ? out : null;
}

function parseHistory(v: unknown): WhatsAppAiRunWorkflowEvent[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .map((item) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const type = str(obj.type) as AiRunWorkflowEventType | null;
      if (!type) return null;
      return {
        type,
        at: (obj.at as Timestamp | Date | null) ?? null,
        by: str(obj.by),
        byName: str(obj.byName),
        payload: (obj.payload as Record<string, unknown> | null | undefined) ?? null
      } as WhatsAppAiRunWorkflowEvent;
    })
    .filter(Boolean) as WhatsAppAiRunWorkflowEvent[];
}

function parseAlertState(v: unknown): WhatsAppAiRunAlertState | null {
  const obj = (v ?? null) as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') return null;
  return {
    firstAlertAt: (obj.firstAlertAt as Timestamp | Date | null) ?? null,
    lastAlertAt: (obj.lastAlertAt as Timestamp | Date | null) ?? null,
    lastReminderAt: (obj.lastReminderAt as Timestamp | Date | null) ?? null,
    lastEscalationAt: (obj.lastEscalationAt as Timestamp | Date | null) ?? null,
    reminderCount: typeof obj.reminderCount === 'number' ? obj.reminderCount : null,
    escalationCount: typeof obj.escalationCount === 'number' ? obj.escalationCount : null,
    mutedUntil: (obj.mutedUntil as Timestamp | Date | null) ?? null,
    snoozedUntil: (obj.snoozedUntil as Timestamp | Date | null) ?? null,
    lastAlertKey: str(obj.lastAlertKey),
    sentKeys: strArr(obj.sentKeys)
  };
}

function parseNotificationHistory(v: unknown): WhatsAppAiRunNotificationEvent[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .map((item) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      const type = str(obj.type) as AiRunAlertEventType | null;
      const channel = str(obj.channel) as 'internal' | 'telegram' | null;
      const status = str(obj.status) as 'sent' | 'skipped' | 'muted' | 'deduped' | 'failed' | null;
      if (!type || !channel || !status) return null;
      return {
        type,
        target: str(obj.target),
        channel,
        status,
        sentAt: (obj.sentAt as Timestamp | Date | null) ?? null,
        key: str(obj.key),
        error: str(obj.error)
      } as WhatsAppAiRunNotificationEvent;
    })
    .filter(Boolean) as WhatsAppAiRunNotificationEvent[];
}

function docToWorkflow(id: string, data: Record<string, unknown>): WhatsAppAiRunWorkflowRecord {
  return {
    id,
    companyId: str(data.companyId) ?? '',
    runId: str(data.runId) ?? id,
    status: parseStatus(data.status),
    assigneeId: str(data.assigneeId),
    assigneeName: str(data.assigneeName),
    lastComment: str(data.lastComment),
    updatedAt: (data.updatedAt as Timestamp | Date | null) ?? null,
    updatedBy: str(data.updatedBy),
    resolvedAt: (data.resolvedAt as Timestamp | Date | null) ?? null,
    resolutionType: parseResolution(data.resolutionType),
    firstAttentionAt: (data.firstAttentionAt as Timestamp | Date | null) ?? null,
    dueAt: (data.dueAt as Timestamp | Date | null) ?? null,
    slaMinutes: typeof data.slaMinutes === 'number' ? data.slaMinutes : null,
    priority: parsePriority(data.priority),
    priorityReason: strArr(data.priorityReason),
    history: parseHistory(data.history),
    alertState: parseAlertState(data.alertState),
    notificationHistory: parseNotificationHistory(data.notificationHistory)
  };
}

export function subscribeWhatsappAiRunWorkflow(
  companyId: string,
  onList: (list: WhatsAppAiRunWorkflowRecord[]) => void,
  onError?: (e: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, WHATSAPP_AI_RUN_WORKFLOW_COLLECTION),
    where('companyId', '==', companyId)
  );
  return onSnapshot(
    q,
    (snap) => onList(snap.docs.map((d) => docToWorkflow(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err)
  );
}

export function subscribeWhatsappAiRunWorkflowByRunId(
  runId: string,
  onItem: (item: WhatsAppAiRunWorkflowRecord | null) => void,
  onError?: (e: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, WHATSAPP_AI_RUN_WORKFLOW_COLLECTION, runId),
    (snap) => onItem(snap.exists() ? docToWorkflow(snap.id, snap.data() as Record<string, unknown>) : null),
    (err) => onError?.(err)
  );
}

export async function upsertWhatsappAiRunWorkflow(
  companyId: string,
  runId: string,
  patch: Partial<Omit<WhatsAppAiRunWorkflowRecord, 'id' | 'companyId' | 'runId' | 'updatedAt'>>
): Promise<void> {
  await setDoc(
    doc(db, WHATSAPP_AI_RUN_WORKFLOW_COLLECTION, runId),
    {
      companyId,
      runId,
      ...patch,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function appendWhatsappAiRunWorkflowEvent(
  companyId: string,
  runId: string,
  event: Omit<WhatsAppAiRunWorkflowEvent, 'at'> & { at?: Date }
): Promise<void> {
  const ref = doc(db, WHATSAPP_AI_RUN_WORKFLOW_COLLECTION, runId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? docToWorkflow(snap.id, snap.data() as Record<string, unknown>) : null;
  const history = Array.isArray(current?.history) ? [...(current?.history ?? [])] : [];
  history.push({
    ...event,
    at: event.at ?? new Date()
  });
  const trimmed = history.slice(-20);
  await setDoc(
    ref,
    {
      companyId,
      runId,
      history: trimmed,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
