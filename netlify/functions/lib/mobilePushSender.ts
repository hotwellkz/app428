import { getMessaging } from 'firebase-admin/messaging';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
import { dedupeCollection, devicesCollection } from './mobilePushStore';

export interface SendChatPushInput {
  managerId: string;
  chatId?: string;
  phone?: string;
  clientName?: string;
  preview?: string;
  unreadCount?: number;
  targetUrl?: string;
  messageId?: string;
  type?: string;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

function buildDataPayload(input: SendChatPushInput): Record<string, string> {
  const data: Record<string, string> = {};
  const set = (k: string, v: unknown) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    data[k] = s;
  };
  set('type', input.type ?? 'message');
  set('chatId', input.chatId);
  set('phone', input.phone);
  set('clientName', input.clientName);
  set('preview', input.preview);
  if (typeof input.unreadCount === 'number' && Number.isFinite(input.unreadCount)) {
    set('unreadCount', Math.max(0, Math.floor(input.unreadCount)));
  }
  set('targetUrl', input.targetUrl);
  set('messageId', input.messageId);
  return data;
}

export async function sendChatPushToManager(input: SendChatPushInput): Promise<{
  ok: boolean;
  tokens: number;
  sent: number;
  failed: number;
  invalidTokens: number;
  deduped: boolean;
}> {
  // ensure app initialized (getDb initializes firebase-admin)
  getDb();
  const messaging = getMessaging();

  const now = Timestamp.now();
  const managerId = String(input.managerId ?? '').trim();
  if (!managerId) throw new Error('managerId is required');

  // Minimal dedupe: если messageId уже пушили этому менеджеру недавно — пропускаем повтор (5 минут).
  const messageId = (input.messageId ?? '').trim();
  if (messageId) {
    const dedupeId = `${managerId}:${messageId}`;
    const ref = dedupeCollection().doc(dedupeId);
    const snap = await ref.get();
    if (snap.exists) {
      const d = snap.data() as { createdAt?: Timestamp } | undefined;
      const createdAt = d?.createdAt;
      if (createdAt && now.toMillis() - createdAt.toMillis() < 5 * 60 * 1000) {
        return { ok: true, tokens: 0, sent: 0, failed: 0, invalidTokens: 0, deduped: true };
      }
    }
    await ref.set({ managerId, messageId, createdAt: now, updatedAt: now }, { merge: true });
  }

  const [androidSnap, iosSnap] = await Promise.all([
    devicesCollection()
      .where('managerId', '==', managerId)
      .where('platform', '==', 'android')
      .where('isActive', '==', true)
      .get(),
    devicesCollection()
      .where('managerId', '==', managerId)
      .where('platform', '==', 'ios')
      .where('isActive', '==', true)
      .get()
  ]);

  const tokens = [...androidSnap.docs, ...iosSnap.docs]
    .map((d) => (d.data() as { token?: string } | undefined)?.token)
    .filter((t): t is string => !!t && typeof t === 'string' && t.trim().length > 0);

  if (tokens.length === 0) {
    return { ok: true, tokens: 0, sent: 0, failed: 0, invalidTokens: 0, deduped: false };
  }

  const data = buildDataPayload(input);

  const alertTitle =
    String(input.clientName ?? '').trim() ||
    String(input.phone ?? '').trim() ||
    'Новое сообщение';
  const alertBody = String(input.preview ?? '').trim() || 'Новое сообщение';

  let sent = 0;
  let failed = 0;
  let invalidTokens = 0;

  // Multicast max 500 tokens
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  for (const chunk of chunks) {
    const resp = await messaging.sendEachForMulticast({
      tokens: chunk,
      data,
      android: { priority: 'high' },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title: alertTitle,
              body: alertBody
            },
            sound: 'default'
          }
        }
      }
    });
    sent += resp.successCount;
    failed += resp.failureCount;

    // Deactivate invalid tokens
    const batch = getDb().batch();
    let hasBatch = false;
    resp.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = (r.error as { code?: string } | undefined)?.code;
      if (code && INVALID_TOKEN_CODES.has(code)) {
        invalidTokens += 1;
        const token = chunk[idx];
        batch.update(devicesCollection().doc(token), {
          isActive: false,
          updatedAt: now,
          invalidatedAt: now,
          invalidatedReason: code
        });
        hasBatch = true;
      }
    });
    if (hasBatch) await batch.commit();
  }

  return { ok: true, tokens: tokens.length, sent, failed, invalidTokens, deduped: false };
}

