/**
 * Voice-specific operational alerts через существующий Telegram AI-control + internal notifications.
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';
import { sendAiControlTelegram } from '../telegramTransport';

const WHATSAPP_AI_BOT_RUNS = 'whatsappAiBotRuns';
const NOTIFICATIONS_COLLECTION = 'aiControlNotifications';

export async function emitVoiceOperationalAlertIfNew(params: {
  db?: Firestore;
  companyId: string;
  linkedRunId: string;
  kind: string;
  title: string;
  message: string;
  dedupKey: string;
}): Promise<{ sent: boolean }> {
  const db = params.db ?? getDb();
  const ref = db.collection(WHATSAPP_AI_BOT_RUNS).doc(params.linkedRunId);
  const snap = await ref.get();
  if (!snap.exists) return { sent: false };
  const row = snap.data() ?? {};
  if (String(row.companyId ?? '') !== params.companyId) return { sent: false };

  const prevExtras = (row.extras as Record<string, unknown>) ?? {};
  const prevVr = (prevExtras.voiceRetry as Record<string, unknown>) ?? {};
  const rawKeys = prevVr.operationalAlertKeys;
  const keys = Array.isArray(rawKeys) ? rawKeys.map((x) => String(x)) : [];
  if (keys.includes(params.dedupKey)) {
    return { sent: false };
  }
  const nextKeys = [...keys, params.dedupKey].slice(-40);

  const tg = await sendAiControlTelegram(`${params.title}\n${params.message}`);
  if (!tg.ok) {
    console.warn('[emitVoiceOperationalAlertIfNew] telegram failed', tg.error);
  }

  await db.collection(NOTIFICATIONS_COLLECTION).add({
    companyId: params.companyId,
    runId: params.linkedRunId,
    title: params.title,
    message: params.message,
    type: 'ai_control',
    voiceOperationalKind: params.kind,
    isRead: false,
    createdAt: FieldValue.serverTimestamp()
  });

  await ref.set(
    {
      extras: {
        ...prevExtras,
        voiceRetry: {
          ...prevVr,
          operationalAlertKeys: nextKeys
        }
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { sent: true };
}
