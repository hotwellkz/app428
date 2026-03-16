import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  deleteField,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';
import { saveSystemMessage } from './whatsappDb';
import type {
  DealsPipeline,
  DealsPipelineStage,
  Deal,
  DealActivityLogEntry,
  DealActivityType
} from '../../types/deals';

const COLLECTION_PIPELINES = 'pipelines';
const COLLECTION_STAGES = 'pipeline_stages';
const COLLECTION_DEALS = 'deals';
const COLLECTION_ACTIVITY = 'deal_activity_log';

function docToPipeline(id: string, data: Record<string, unknown>): DealsPipeline {
  return {
    id,
    companyId: (data.companyId as string) ?? '',
    name: (data.name as string) ?? '',
    code: data.code as string | undefined,
    isDefault: Boolean(data.isDefault),
    isActive: data.isActive !== false,
    sortOrder: (data.sortOrder as number) ?? 0,
    createdAt: (data.createdAt as DealsPipeline['createdAt']) ?? null,
    updatedAt: (data.updatedAt as DealsPipeline['updatedAt']) ?? null
  };
}

function docToStage(id: string, data: Record<string, unknown>): DealsPipelineStage {
  return {
    id,
    companyId: (data.companyId as string) ?? '',
    pipelineId: (data.pipelineId as string) ?? '',
    name: (data.name as string) ?? '',
    color: data.color as string | undefined,
    type: (data.type as DealsPipelineStage['type']) ?? 'open',
    sortOrder: (data.sortOrder as number) ?? 0,
    isActive: data.isActive !== false,
    createdAt: (data.createdAt as DealsPipelineStage['createdAt']) ?? null,
    updatedAt: (data.updatedAt as DealsPipelineStage['updatedAt']) ?? null
  };
}

export function docToDeal(id: string, data: Record<string, unknown>): Deal {
  return {
    id,
    companyId: (data.companyId as string) ?? '',
    pipelineId: (data.pipelineId as string) ?? '',
    stageId: (data.stageId as string) ?? '',
    title: (data.title as string) ?? '',
    clientId: (data.clientId as string | null) ?? null,
    clientNameSnapshot: data.clientNameSnapshot as string | undefined,
    clientPhoneSnapshot: data.clientPhoneSnapshot as string | undefined,
    amount: data.amount as number | undefined,
    currency: (data.currency as Deal['currency']) ?? 'KZT',
    responsibleUserId: (data.responsibleUserId as string | null) ?? null,
    responsibleNameSnapshot: data.responsibleNameSnapshot as string | undefined,
    status: data.status as string | null | undefined,
    priority: data.priority as string | null | undefined,
    note: data.note as string | undefined,
    tags: (data.tags as string[]) ?? [],
    sortOrder: (data.sortOrder as number) ?? 0,
    createdBy: (data.createdBy as string | null) ?? null,
    createdAt: (data.createdAt as Deal['createdAt']) ?? null,
    updatedAt: (data.updatedAt as Deal['updatedAt']) ?? null,
    stageChangedAt: (data.stageChangedAt as Deal['stageChangedAt']) ?? null,
    nextAction: (data.nextAction as string | null) ?? null,
    nextActionAt: (data.nextActionAt as Deal['nextActionAt']) ?? null,
    isArchived: Boolean(data.isArchived),
    whatsappConversationId: (data.whatsappConversationId as string) ?? null,
    deletedAt: (data.deletedAt as Deal['deletedAt']) ?? null,
    source: (data.source as string) ?? null
  };
}

const COLLECTION_DEAL_HISTORY = 'deal_history';

function docToHistory(id: string, data: Record<string, unknown>): import('../../types/deals').DealHistoryEntry {
  return {
    id,
    companyId: (data.companyId as string) ?? '',
    dealId: (data.dealId as string) ?? '',
    message: (data.message as string) ?? '',
    createdAt: (data.createdAt as import('../../types/deals').DealHistoryEntry['createdAt']) ?? null
  };
}

function docToActivity(id: string, data: Record<string, unknown>): DealActivityLogEntry {
  return {
    id,
    companyId: (data.companyId as string) ?? '',
    dealId: (data.dealId as string) ?? '',
    type: (data.type as DealActivityType) ?? 'updated',
    payload: (data.payload as Record<string, unknown>) ?? {},
    createdBy: (data.createdBy as string | null) ?? null,
    createdAt: (data.createdAt as DealActivityLogEntry['createdAt']) ?? null
  };
}

// Pipelines

export async function listPipelines(companyId: string): Promise<DealsPipeline[]> {
  const q = query(
    collection(db, COLLECTION_PIPELINES),
    where('companyId', '==', companyId),
    orderBy('sortOrder', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToPipeline(d.id, d.data() as Record<string, unknown>));
}

export async function createPipeline(
  companyId: string,
  payload: { name: string; isDefault?: boolean }
): Promise<DealsPipeline> {
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, COLLECTION_PIPELINES), {
    companyId,
    name: payload.name.trim(),
    code: null,
    isDefault: !!payload.isDefault,
    isActive: true,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now
  });
  const snap = await getDoc(ref);
  return docToPipeline(ref.id, snap.data() as Record<string, unknown>);
}

export async function updatePipeline(
  id: string,
  data: Partial<Pick<DealsPipeline, 'name' | 'isActive' | 'sortOrder'>>
): Promise<void> {
  const ref = doc(db, COLLECTION_PIPELINES, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// Stages

export async function listStages(
  companyId: string,
  pipelineId: string
): Promise<DealsPipelineStage[]> {
  const q = query(
    collection(db, COLLECTION_STAGES),
    where('companyId', '==', companyId),
    where('pipelineId', '==', pipelineId),
    orderBy('sortOrder', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToStage(d.id, d.data() as Record<string, unknown>));
}

export async function createStage(
  companyId: string,
  pipelineId: string,
  payload: { name: string; type?: DealsPipelineStage['type']; color?: string }
): Promise<DealsPipelineStage> {
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, COLLECTION_STAGES), {
    companyId,
    pipelineId,
    name: payload.name.trim(),
    color: payload.color ?? null,
    type: payload.type ?? 'open',
    sortOrder: Date.now(),
    isActive: true,
    createdAt: now,
    updatedAt: now
  });
  const snap = await getDoc(ref);
  return docToStage(ref.id, snap.data() as Record<string, unknown>);
}

export async function updateStage(
  id: string,
  data: Partial<Pick<DealsPipelineStage, 'name' | 'color' | 'type' | 'sortOrder' | 'isActive'>>
): Promise<void> {
  const ref = doc(db, COLLECTION_STAGES, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function reorderStages(
  updates: { id: string; sortOrder: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const u of updates) {
    batch.update(doc(db, COLLECTION_STAGES, u.id), { sortOrder: u.sortOrder, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

// Deals

export interface DealsFilter {
  stageId?: string | null;
  searchQuery?: string;
}

export function subscribeDeals(
  companyId: string,
  pipelineId: string,
  callback: (deals: Deal[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_DEALS),
    where('companyId', '==', companyId),
    where('pipelineId', '==', pipelineId),
    orderBy('stageId', 'asc'),
    orderBy('sortOrder', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => docToDeal(d.id, d.data() as Record<string, unknown>))
        .filter((d) => d.deletedAt == null);
      if (import.meta.env.DEV) {
        console.log('[Deals] deals snapshot:', { companyId, pipelineId, count: list.length });
      }
      callback(list);
    },
    (err) => onError?.(err)
  );
}

/** Сделки в корзине (по компании). Индекс: companyId + deletedAt */
export function subscribeTrashedDeals(
  companyId: string,
  callback: (deals: Deal[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_DEALS),
    where('companyId', '==', companyId),
    where('deletedAt', '!=', null),
    orderBy('deletedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => docToDeal(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => onError?.(err)
  );
}

/** Снять привязку сделки со всех чатов WhatsApp (только dealId на чате). */
async function unlinkDealFromChats(
  dealId: string,
  companyId: string | null | undefined,
  convIds: string[]
): Promise<void> {
  const seen = new Set<string>();
  const clear = async (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    try {
      await updateDoc(doc(db, COLLECTION_WHATSAPP_CONVERSATIONS, id), {
        dealId: deleteField(),
        dealStageId: deleteField(),
        dealStageName: deleteField(),
        dealStageColor: deleteField(),
        dealTitle: deleteField(),
        dealResponsibleName: deleteField()
      });
      if (companyId) {
        await saveSystemMessage(id, 'Сделка была удалена', companyId);
      }
    } catch {
      /* ignore */
    }
  };
  for (const id of convIds) await clear(id);
  if (companyId) {
    try {
      const q = query(
        collection(db, COLLECTION_WHATSAPP_CONVERSATIONS),
        where('companyId', '==', companyId),
        where('dealId', '==', dealId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) await clear(d.id);
    } catch {
      /* индекс companyId+dealId может отсутствовать — уже обработали convIds */
    }
  }
}

export async function softDeleteDeal(dealId: string, companyId?: string | null): Promise<void> {
  const ref = doc(db, COLLECTION_DEALS, dealId);
  const snap = await getDoc(ref);
  const data = snap.data() as { whatsappConversationId?: string | null } | undefined;
  const convId = data?.whatsappConversationId ?? undefined;

  await updateDoc(ref, {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await addDealActivity(companyId ?? '', dealId, 'deleted', {});
  await addDoc(collection(db, COLLECTION_DEAL_HISTORY), {
    companyId: companyId ?? '',
    dealId,
    message: 'Сделка перемещена в корзину',
    createdAt: serverTimestamp()
  });

  await unlinkDealFromChats(dealId, companyId ?? null, convId ? [convId] : []);
}

export async function restoreDeal(dealId: string, companyId?: string | null): Promise<void> {
  const ref = doc(db, COLLECTION_DEALS, dealId);
  const snap = await getDoc(ref);
  const cid = (snap.data()?.companyId as string) ?? companyId ?? '';
  await updateDoc(ref, {
    deletedAt: deleteField(),
    updatedAt: serverTimestamp()
  });
  if (cid) {
    await addDealActivity(cid, dealId, 'restored', {});
    await addDoc(collection(db, COLLECTION_DEAL_HISTORY), {
      companyId: cid,
      dealId,
      message: 'Сделка восстановлена из корзины',
      createdAt: serverTimestamp()
    });
  }
}

export async function permanentDeleteDeal(dealId: string, companyId?: string | null): Promise<void> {
  const ref = doc(db, COLLECTION_DEALS, dealId);
  const snap = await getDoc(ref);
  const data = snap.data() as { whatsappConversationId?: string | null } | undefined;
  const convId = data?.whatsappConversationId ?? undefined;
  await unlinkDealFromChats(dealId, companyId ?? null, convId ? [convId] : []);
  await deleteDoc(ref);
}

export async function createDeal(
  companyId: string,
  pipelineId: string,
  stageId: string,
  payload: {
    title: string;
    clientId?: string | null;
    clientNameSnapshot?: string;
    clientPhoneSnapshot?: string;
    amount?: number;
    responsibleUserId?: string | null;
    responsibleNameSnapshot?: string;
    note?: string;
    source?: string | null;
  }
): Promise<Deal> {
  const now = serverTimestamp();
  const ref = await addDoc(collection(db, COLLECTION_DEALS), {
    companyId,
    pipelineId,
    stageId,
    title: payload.title.trim(),
    clientId: payload.clientId ?? null,
    clientNameSnapshot: payload.clientNameSnapshot ?? null,
    clientPhoneSnapshot: payload.clientPhoneSnapshot ?? null,
    amount: payload.amount ?? null,
    currency: 'KZT',
    responsibleUserId: payload.responsibleUserId ?? null,
    responsibleNameSnapshot: payload.responsibleNameSnapshot ?? null,
    status: null,
    priority: null,
    note: payload.note ?? '',
    source: payload.source ?? 'Ручной',
    tags: [],
    sortOrder: Date.now(),
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    stageChangedAt: now,
    nextAction: null,
    nextActionAt: null,
    isArchived: false,
    deletedAt: null
  });
  const snap = await getDoc(ref);
  const deal = docToDeal(ref.id, snap.data() as Record<string, unknown>);
  await addDealActivity(companyId, deal.id, 'created', { pipelineId, stageId });
  await addDoc(collection(db, COLLECTION_DEAL_HISTORY), {
    companyId,
    dealId: deal.id,
    message: 'Сделка создана',
    createdAt: serverTimestamp()
  });
  return deal;
}

export async function updateDeal(
  id: string,
  data: Partial<
    Pick<
      Deal,
      | 'title'
      | 'clientId'
      | 'clientNameSnapshot'
      | 'clientPhoneSnapshot'
      | 'amount'
      | 'responsibleUserId'
      | 'responsibleNameSnapshot'
      | 'status'
      | 'priority'
      | 'note'
      | 'tags'
      | 'nextAction'
      | 'nextActionAt'
      | 'isArchived'
      | 'whatsappConversationId'
      | 'source'
    >
  >
): Promise<void> {
  const ref = doc(db, COLLECTION_DEALS, id);
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      payload[key] = deleteField();
    } else {
      payload[key] = value;
    }
  }
  await updateDoc(ref, payload);
}

const COLLECTION_WHATSAPP_CONVERSATIONS = 'whatsappConversations';

export async function moveDealToStage(
  companyId: string,
  dealId: string,
  targetStageId: string,
  sortOrder: number,
  stageMeta?: { name: string; color?: string | null }
): Promise<void> {
  const ref = doc(db, COLLECTION_DEALS, dealId);
  await updateDoc(ref, {
    stageId: targetStageId,
    sortOrder,
    stageChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await addDealActivity(companyId, dealId, 'stage_changed', { stageId: targetStageId });
  if (stageMeta?.name) {
    await addDoc(collection(db, COLLECTION_DEAL_HISTORY), {
      companyId,
      dealId,
      message: `Сделка перемещена в этап: ${stageMeta.name}`,
      createdAt: serverTimestamp()
    });
  }

  const dealSnap = await getDoc(ref);
  const convId = (dealSnap.data() as { whatsappConversationId?: string | null })?.whatsappConversationId;
  if (convId && stageMeta?.name) {
    await saveSystemMessage(convId, `Сделка переведена в этап: ${stageMeta.name}`, companyId);
  }
}

export async function reorderDealsWithinStage(
  updates: { id: string; sortOrder: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const u of updates) {
    batch.update(doc(db, COLLECTION_DEALS, u.id), { sortOrder: u.sortOrder, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

// Activity log

export async function addDealActivity(
  companyId: string,
  dealId: string,
  type: DealActivityType,
  payload: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, COLLECTION_ACTIVITY), {
    companyId,
    dealId,
    type,
    payload,
    createdBy: null,
    createdAt: serverTimestamp()
  });
}

export function subscribeDealHistory(
  companyId: string,
  dealId: string,
  callback: (entries: import('../../types/deals').DealHistoryEntry[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_DEAL_HISTORY),
    where('companyId', '==', companyId),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => docToHistory(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err)
  );
}

export async function listDealActivity(
  companyId: string,
  dealId: string
): Promise<DealActivityLogEntry[]> {
  const q = query(
    collection(db, COLLECTION_ACTIVITY),
    where('companyId', '==', companyId),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToActivity(d.id, d.data() as Record<string, unknown>));
}

export function subscribeDealActivity(
  companyId: string,
  dealId: string,
  callback: (entries: DealActivityLogEntry[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_ACTIVITY),
    where('companyId', '==', companyId),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => docToActivity(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err)
  );
}

// Lazy seed для HotWell: дефолтная воронка и этапы

const HOTWELL_COMPANY_CODE = 'hotwell';

const DEFAULT_STAGES: Array<{ name: string; type: DealsPipelineStage['type'] }> = [
  { name: 'Новый лид', type: 'open' },
  { name: 'Связались', type: 'open' },
  { name: 'Замер', type: 'open' },
  { name: 'Смета', type: 'open' },
  { name: 'Договор', type: 'open' },
  { name: 'Оплата', type: 'open' },
  { name: 'Успешно', type: 'won' },
  { name: 'Проиграно', type: 'lost' }
];

/** Инициализация дефолтной воронки для компании (особенно для HotWell). Без дубликатов. */
export async function ensureDefaultPipeline(companyId: string): Promise<DealsPipeline | null> {
  const existing = await listPipelines(companyId);
  if (existing.length > 0) return existing[0];

  if (import.meta.env.DEV) {
    console.log('[Deals] ensureDefaultPipeline: creating default pipeline for', companyId);
  }

  const pipeline = await createPipeline(companyId, {
    name: companyId === HOTWELL_COMPANY_CODE ? 'Основная воронка' : 'Воронка продаж',
    isDefault: true
  });

  const now = Date.now();
  const batch = writeBatch(db);
  DEFAULT_STAGES.forEach((s, index) => {
    const ref = doc(collection(db, COLLECTION_STAGES));
    batch.set(ref, {
      id: ref.id,
      companyId,
      pipelineId: pipeline.id,
      name: s.name,
      color: null,
      type: s.type,
      sortOrder: now + index,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();

  return pipeline;
}

