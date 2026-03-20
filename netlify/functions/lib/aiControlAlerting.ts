import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { sendAiControlTelegram } from './telegramTransport';

type Priority = 'critical' | 'high' | 'normal' | 'low';
type Status = 'new' | 'in_progress' | 'resolved' | 'ignored' | 'escalated';
type AlertType =
  | 'new_critical_unassigned'
  | 'new_overdue'
  | 'still_overdue_reminder'
  | 'escalation_required'
  | 'assigned_to_me'
  | 'manual_resend';

const WORKFLOW_COLLECTION = 'whatsappAiRunWorkflow';
const NOTIFICATIONS_COLLECTION = 'aiControlNotifications';
const COMPANY_USERS_COLLECTION = 'company_users';

function toMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return null;
}

function reminderCooldownMinutes(priority: Priority): number | null {
  if (priority === 'critical') return 15;
  if (priority === 'high') return 60;
  if (priority === 'normal') return 240;
  return null;
}

function escalationThresholdMinutes(priority: Priority): number | null {
  if (priority === 'critical') return 30;
  if (priority === 'high') return 240;
  if (priority === 'normal') return 1440;
  return null;
}

async function createInternalNotification(
  db: Firestore,
  companyId: string,
  runId: string,
  title: string,
  message: string,
  targetUserId: string | null
) {
  await db.collection(NOTIFICATIONS_COLLECTION).add({
    companyId,
    runId,
    title,
    message,
    targetUserId,
    type: 'ai_control',
    isRead: false,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function getSupervisorUsers(db: Firestore, companyId: string): Promise<string[]> {
  const snap = await db.collection(COMPANY_USERS_COLLECTION).where('companyId', '==', companyId).get();
  return snap.docs
    .filter((d) => {
      const role = String(d.data()?.role ?? '');
      return role === 'owner' || role === 'admin' || role === 'global_admin';
    })
    .map((d) => d.id);
}

async function pushNotificationEvent(
  db: Firestore,
  runId: string,
  event: {
    type: AlertType;
    target?: string | null;
    channel: 'internal' | 'telegram';
    status: 'sent' | 'skipped' | 'muted' | 'deduped' | 'failed';
    key?: string;
    error?: string;
  }
) {
  await db.collection(WORKFLOW_COLLECTION).doc(runId).set(
    {
      notificationHistory: FieldValue.arrayUnion({
        ...event,
        sentAt: Timestamp.now()
      })
    },
    { merge: true }
  );
}

export async function processAiControlAlertsForCompany(
  db: Firestore,
  companyId: string,
  options?: { runId?: string; forceManualResend?: boolean }
) {
  const now = Date.now();
  const ref = db.collection(WORKFLOW_COLLECTION);
  const snap = options?.runId
    ? await ref.where('companyId', '==', companyId).where('runId', '==', options.runId).limit(1).get()
    : await ref.where('companyId', '==', companyId).get();

  const supervisorIds = await getSupervisorUsers(db, companyId);
  const results: Array<{ runId: string; action: string }> = [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const runId = String(data.runId ?? doc.id);
    const status = String(data.status ?? 'new') as Status;
    const priority = String(data.priority ?? 'normal') as Priority;
    const dueAtMs = toMs(data.dueAt);
    const assigneeId = (data.assigneeId ? String(data.assigneeId) : null) as string | null;
    const alertState = (data.alertState ?? {}) as Record<string, unknown>;
    const sentKeysRaw = Array.isArray(alertState.sentKeys) ? alertState.sentKeys.map((x) => String(x)) : [];
    const sentKeys = new Set(sentKeysRaw);
    const firstAlertAtMs = toMs(alertState.firstAlertAt);
    const lastReminderAtMs = toMs(alertState.lastReminderAt);
    const lastEscalationAtMs = toMs(alertState.lastEscalationAt);
    const mutedUntilMs = toMs(alertState.mutedUntil);
    const snoozedUntilMs = toMs(alertState.snoozedUntil);

    const closed = status === 'resolved' || status === 'ignored';
    const isMuted = !!(mutedUntilMs && mutedUntilMs > now);
    const isSnoozed = !!(snoozedUntilMs && snoozedUntilMs > now);
    const isOverdue = !!(dueAtMs && dueAtMs < now && !closed);
    const overdueMinutes = dueAtMs ? Math.floor((now - dueAtMs) / 60000) : 0;

    if (closed) continue;
    if (isMuted || isSnoozed) {
      await pushNotificationEvent(db, runId, {
        type: 'still_overdue_reminder',
        channel: 'internal',
        status: isMuted ? 'muted' : 'skipped',
        key: `muted:${runId}`
      });
      continue;
    }

    let shouldSendType: AlertType | null = null;
    if (options?.forceManualResend) {
      shouldSendType = 'manual_resend';
    } else if (priority === 'critical' && status === 'new' && !assigneeId && !firstAlertAtMs) {
      shouldSendType = 'new_critical_unassigned';
    } else if (isOverdue && !sentKeys.has('new_overdue:v1')) {
      shouldSendType = 'new_overdue';
    } else if (isOverdue) {
      const cooldown = reminderCooldownMinutes(priority);
      if (cooldown && (!lastReminderAtMs || now - lastReminderAtMs >= cooldown * 60000)) {
        shouldSendType = 'still_overdue_reminder';
      }
    }

    const escThreshold = escalationThresholdMinutes(priority);
    if (!shouldSendType && isOverdue && escThreshold && overdueMinutes > escThreshold && !lastEscalationAtMs) {
      shouldSendType = 'escalation_required';
    }
    if (!shouldSendType) continue;

    const keyBase =
      shouldSendType === 'still_overdue_reminder'
        ? `reminder:${priority}:${Math.floor(now / 60000 / Math.max(1, reminderCooldownMinutes(priority) || 1))}`
        : `${shouldSendType}:v1`;
    if (!options?.forceManualResend && sentKeys.has(keyBase)) {
      await pushNotificationEvent(db, runId, {
        type: shouldSendType,
        channel: 'internal',
        status: 'deduped',
        key: keyBase
      });
      continue;
    }

    const targetUserIds =
      shouldSendType === 'new_critical_unassigned' || shouldSendType === 'escalation_required' || !assigneeId
        ? supervisorIds
        : [assigneeId];

    const title = shouldSendType === 'escalation_required' ? 'SLA эскалация AI-run' : 'Требует реакции AI-run';
    const message = `run ${runId.slice(0, 8)} · ${shouldSendType} · priority ${priority}${isOverdue ? ' · overdue' : ''}`;

    for (const uid of targetUserIds) {
      await createInternalNotification(db, companyId, runId, title, message, uid || null);
      await pushNotificationEvent(db, runId, {
        type: shouldSendType,
        target: uid || null,
        channel: 'internal',
        status: 'sent',
        key: keyBase
      });
    }

    if (shouldSendType === 'new_critical_unassigned' || shouldSendType === 'escalation_required') {
      const tg = await sendAiControlTelegram(`${title}\n${message}`);
      await pushNotificationEvent(db, runId, {
        type: shouldSendType,
        target: process.env.AI_CONTROL_TELEGRAM_CHAT_ID ?? null,
        channel: 'telegram',
        status: tg.ok ? 'sent' : 'failed',
        key: keyBase,
        error: tg.error
      });
    }

    await db.collection(WORKFLOW_COLLECTION).doc(runId).set(
      {
        alertState: {
          firstAlertAt: firstAlertAtMs ? Timestamp.fromMillis(firstAlertAtMs) : Timestamp.now(),
          lastAlertAt: Timestamp.now(),
          lastAlertKey: keyBase,
          lastReminderAt: shouldSendType === 'still_overdue_reminder' ? Timestamp.now() : alertState.lastReminderAt ?? null,
          lastEscalationAt: shouldSendType === 'escalation_required' ? Timestamp.now() : alertState.lastEscalationAt ?? null,
          reminderCount:
            shouldSendType === 'still_overdue_reminder'
              ? Number(alertState.reminderCount ?? 0) + 1
              : Number(alertState.reminderCount ?? 0),
          escalationCount:
            shouldSendType === 'escalation_required'
              ? Number(alertState.escalationCount ?? 0) + 1
              : Number(alertState.escalationCount ?? 0),
          sentKeys: Array.from(new Set([...sentKeysRaw, keyBase])).slice(-50)
        }
      },
      { merge: true }
    );
    results.push({ runId, action: shouldSendType });
  }

  return { processed: snap.size, actions: results };
}
