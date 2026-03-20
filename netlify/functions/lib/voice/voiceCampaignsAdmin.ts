import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';

export const VOICE_CAMPAIGNS = 'voiceCampaigns';
export const VOICE_CAMPAIGN_ITEMS = 'voiceCampaignItems';
const RUNS = 'whatsappAiBotRuns';

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
export type CampaignItemStatus =
  | 'pending'
  | 'queued'
  | 'calling'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'callback'
  | 'skipped';

export async function adminCreateCampaign(input: {
  companyId: string;
  createdBy: string;
  name: string;
  botId: string;
  fromNumberId: string;
  sourceType: 'csv' | 'manual';
  phones: string[];
  maxConcurrentCalls: number;
  callsPerMinute: number;
  timezone?: string | null;
}): Promise<string> {
  const db = getDb();
  const campaignRef = db.collection(VOICE_CAMPAIGNS).doc();
  const campaignId = campaignRef.id;
  const normalized = [...new Set(input.phones.map((x) => String(x).trim()).filter(Boolean))];
  const total = normalized.length;
  await campaignRef.set({
    companyId: input.companyId,
    name: input.name,
    botId: input.botId,
    fromNumberId: input.fromNumberId,
    provider: 'twilio',
    sourceType: input.sourceType,
    status: 'draft',
    totalCount: total,
    queuedCount: total,
    dispatchedCount: 0,
    completedCount: 0,
    failedCount: 0,
    noAnswerCount: 0,
    busyCount: 0,
    callbackCount: 0,
    maxConcurrentCalls: Math.max(1, Math.min(10, input.maxConcurrentCalls || 2)),
    callsPerMinute: Math.max(1, Math.min(120, input.callsPerMinute || 20)),
    timezone: input.timezone ?? 'Asia/Almaty',
    createdBy: input.createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    metadata: {}
  });
  const batchSize = 350;
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = db.batch();
    for (const phone of normalized.slice(i, i + batchSize)) {
      const ref = db.collection(VOICE_CAMPAIGN_ITEMS).doc();
      batch.set(ref, {
        campaignId,
        companyId: input.companyId,
        phone,
        normalizedPhone: phone,
        status: 'pending',
        attemptsCount: 0,
        outcome: null,
        lastError: null,
        lastCallId: null,
        linkedRunId: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
  }
  return campaignId;
}

export async function adminCreateLinkedRunForCampaignItem(input: {
  companyId: string;
  campaignId: string;
  campaignItemId: string;
  botId: string;
  phone: string;
}): Promise<string> {
  const db = getDb();
  const runRef = db.collection(RUNS).doc();
  await runRef.set({
    companyId: input.companyId,
    channel: 'voice',
    botId: input.botId,
    phoneSnapshot: input.phone,
    status: 'processing',
    source: 'voice_campaign',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    extras: {
      voiceCampaign: {
        campaignId: input.campaignId,
        campaignItemId: input.campaignItemId
      }
    }
  });
  return runRef.id;
}

export async function adminListDispatchableCampaigns(max: number): Promise<Array<{ id: string; companyId: string }>> {
  const db = getDb();
  const snap = await db
    .collection(VOICE_CAMPAIGNS)
    .where('status', '==', 'running')
    .limit(Math.max(1, Math.min(max, 20)))
    .get();
  return snap.docs.map((d) => ({ id: d.id, companyId: String(d.data()?.companyId ?? '') })).filter((x) => x.companyId);
}

export async function adminListPendingCampaignItems(input: {
  companyId: string;
  campaignId: string;
  max: number;
}): Promise<Array<{ id: string; normalizedPhone: string }>> {
  const db = getDb();
  const snap = await db
    .collection(VOICE_CAMPAIGN_ITEMS)
    .where('companyId', '==', input.companyId)
    .where('campaignId', '==', input.campaignId)
    .where('status', '==', 'pending')
    .limit(Math.max(1, Math.min(input.max, 100)))
    .get();
  return snap.docs.map((d) => ({ id: d.id, normalizedPhone: String(d.data()?.normalizedPhone ?? '') }));
}

export async function adminClaimCampaignItem(input: {
  companyId: string;
  campaignId: string;
  itemId: string;
}): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(VOICE_CAMPAIGN_ITEMS).doc(input.itemId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const d = snap.data() ?? {};
    if (
      String(d.companyId ?? '') !== input.companyId ||
      String(d.campaignId ?? '') !== input.campaignId ||
      String(d.status ?? '') !== 'pending'
    ) {
      return false;
    }
    tx.update(ref, {
      status: 'queued',
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  });
}

export async function adminMarkCampaignItemDispatched(input: {
  itemId: string;
  callId: string;
  linkedRunId: string;
}): Promise<void> {
  const db = getDb();
  await db.collection(VOICE_CAMPAIGN_ITEMS).doc(input.itemId).set(
    {
      status: 'calling',
      lastCallId: input.callId,
      linkedRunId: input.linkedRunId,
      attemptsCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function adminMarkCampaignItemDispatchError(input: {
  itemId: string;
  error: string;
}): Promise<void> {
  const db = getDb();
  await db.collection(VOICE_CAMPAIGN_ITEMS).doc(input.itemId).set(
    {
      status: 'failed',
      lastError: input.error,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function adminRefreshCampaignCounters(campaignId: string): Promise<void> {
  const db = getDb();
  const items = await db.collection(VOICE_CAMPAIGN_ITEMS).where('campaignId', '==', campaignId).get();
  let pending = 0;
  let calling = 0;
  let completed = 0;
  let failed = 0;
  let busy = 0;
  let noAnswer = 0;
  let callback = 0;
  items.docs.forEach((d) => {
    const st = String(d.data()?.status ?? '');
    if (st === 'pending' || st === 'queued') pending += 1;
    if (st === 'calling') calling += 1;
    if (st === 'completed') completed += 1;
    if (st === 'failed') failed += 1;
    if (st === 'busy') busy += 1;
    if (st === 'no_answer') noAnswer += 1;
    if (st === 'callback') callback += 1;
  });
  const total = items.size;
  const done = completed + failed + busy + noAnswer + callback;
  const status: CampaignStatus = done >= total ? 'completed' : 'running';
  await db.collection(VOICE_CAMPAIGNS).doc(campaignId).set(
    {
      totalCount: total,
      queuedCount: pending,
      dispatchedCount: calling + done,
      completedCount: completed,
      failedCount: failed,
      busyCount: busy,
      noAnswerCount: noAnswer,
      callbackCount: callback,
      status,
      ...(status === 'completed' ? { finishedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function adminResolveCampaignItemByCall(input: {
  companyId: string;
  campaignId: string;
  campaignItemId: string;
  callStatus: string;
  outcome: string | null;
}): Promise<void> {
  const db = getDb();
  const ref = db.collection(VOICE_CAMPAIGN_ITEMS).doc(input.campaignItemId);
  const next: CampaignItemStatus =
    input.callStatus === 'completed'
      ? input.outcome === 'callback'
        ? 'callback'
        : 'completed'
      : input.callStatus === 'busy'
        ? 'busy'
        : input.callStatus === 'no_answer'
          ? 'no_answer'
          : 'failed';
  await ref.set(
    {
      status: next,
      outcome: input.outcome ?? 'unknown',
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  await adminRefreshCampaignCounters(input.campaignId);
}

export async function adminUpdateCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
  const db = getDb();
  await db.collection(VOICE_CAMPAIGNS).doc(campaignId).set(
    {
      status,
      ...(status === 'running' ? { startedAt: FieldValue.serverTimestamp() } : {}),
      ...(status === 'completed' || status === 'failed' ? { finishedAt: FieldValue.serverTimestamp() } : {}),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function adminGetCampaignById(campaignId: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const snap = await db.collection(VOICE_CAMPAIGNS).doc(campaignId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() ?? {}) };
}

