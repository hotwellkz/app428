/**
 * Данные для CRM analytics: сделки, диалоги, сообщения.
 * Кэш на стороне клиента — в компоненте (TTL).
 * Все публичные fetch* требуют права analytics:view (иначе 403-совместимая ошибка).
 */
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type DocumentData
} from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS } from './whatsappDb';
import { docToDeal } from './deals';
import type { MenuAccess } from '../../types/menuAccess';
import { canAccessSection } from '../../types/menuAccess';

const COLLECTION_DEALS = 'deals';

/** Нет права analytics:view — как 403 для вызывающего кода. */
export class AnalyticsForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = 'analytics:view required') {
    super(message);
    this.name = 'AnalyticsForbiddenError';
  }
}

export function assertAnalyticsView(menuAccess: MenuAccess | null | undefined): void {
  if (!canAccessSection(menuAccess ?? undefined, 'analytics')) {
    throw new AnalyticsForbiddenError();
  }
}

export function toMs(v: unknown): number {
  if (!v) return 0;
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    return ((v as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(v as string).getTime();
}

export interface DealRow {
  id: string;
  createdAt: number;
  /** Последняя смена этапа — для «закрыто в этом месяце» */
  stageChangedAt: number;
  amount: number;
  stageId: string;
  source: string | null;
  deletedAt: number | null;
  responsibleUserId: string | null;
  pipelineId: string;
  whatsappConversationId: string | null;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  direction: 'incoming' | 'outgoing';
  createdAt: number;
  system?: boolean;
  text?: string;
}

export interface ConversationRow {
  id: string;
  createdAt: number;
  status: string;
  unreadCount: number;
  lastIncomingAt: number;
  lastOutgoingAt: number;
  dealId: string | null;
  phone?: string;
  dealResponsibleName?: string | null;
}

export interface ManagerRow {
  id: string;
  name: string;
}

let dealsCache: { companyId: string; at: number; data: DealRow[] } | null = null;
let convCache: { companyId: string; at: number; data: ConversationRow[] } | null = null;
let msgCache: { companyId: string; since: number; at: number; data: MessageRow[] } | null = null;
const CACHE_TTL_MS = 45000;

export function invalidateAnalyticsCache() {
  dealsCache = convCache = msgCache = null;
}

export async function fetchDealsForCompany(
  companyId: string,
  useCache = true,
  menuAccess?: MenuAccess | null
): Promise<DealRow[]> {
  assertAnalyticsView(menuAccess);
  if (useCache && dealsCache && dealsCache.companyId === companyId && Date.now() - dealsCache.at < CACHE_TTL_MS) {
    return dealsCache.data;
  }
  const q = query(collection(db, COLLECTION_DEALS), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const data = snap.docs.map((d) => {
    const deal = docToDeal(d.id, d.data() as Record<string, unknown>);
    return {
      id: deal.id,
      createdAt: toMs(deal.createdAt),
      stageChangedAt: toMs(deal.stageChangedAt ?? deal.updatedAt ?? deal.createdAt),
      amount: deal.amount ?? 0,
      stageId: deal.stageId,
      source: deal.source ?? null,
      deletedAt: deal.deletedAt ? toMs(deal.deletedAt) : null,
      responsibleUserId: deal.responsibleUserId ?? null,
      pipelineId: deal.pipelineId,
      whatsappConversationId: deal.whatsappConversationId ?? null
    };
  });
  dealsCache = { companyId, at: Date.now(), data };
  return data;
}

export async function fetchConversationsForCompany(
  companyId: string,
  useCache = true,
  menuAccess?: MenuAccess | null
): Promise<ConversationRow[]> {
  assertAnalyticsView(menuAccess);
  if (useCache && convCache && convCache.companyId === companyId && Date.now() - convCache.at < CACHE_TTL_MS) {
    return convCache.data;
  }
  const q = query(
    collection(db, COLLECTIONS.CONVERSATIONS),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  const data = snap.docs.map((d) => {
    const x = d.data() as DocumentData;
    return {
      id: d.id,
      createdAt: toMs(x.createdAt),
      status: (x.status as string) || 'active',
      unreadCount: (x.unreadCount as number) ?? 0,
      lastIncomingAt: toMs(x.lastIncomingAt),
      lastOutgoingAt: toMs(x.lastOutgoingAt),
      dealId: (x.dealId as string) ?? null,
      phone: (x.phone as string) || undefined,
      dealResponsibleName: (x.dealResponsibleName as string) ?? null
    };
  });
  convCache = { companyId, at: Date.now(), data };
  return data;
}

export async function fetchMessagesSince(
  companyId: string,
  sinceMs: number,
  maxDocs = 8000,
  useCache = true,
  menuAccess?: MenuAccess | null
): Promise<MessageRow[]> {
  assertAnalyticsView(menuAccess);
  if (
    useCache &&
    msgCache &&
    msgCache.companyId === companyId &&
    msgCache.since <= sinceMs &&
    Date.now() - msgCache.at < CACHE_TTL_MS
  ) {
    return msgCache.data.filter((m) => m.createdAt >= sinceMs);
  }
  try {
    const since = Timestamp.fromMillis(sinceMs);
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('companyId', '==', companyId),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'asc'),
      limit(maxDocs)
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => {
      const x = d.data() as DocumentData;
      const text = (x.text as string) || '';
      return {
        id: d.id,
        conversationId: (x.conversationId as string) || '',
        direction: (x.direction as 'incoming' | 'outgoing') || 'incoming',
        createdAt: toMs(x.createdAt),
        system: Boolean(x.system),
        text: text.slice(0, 200)
      };
    });
    msgCache = { companyId, since: sinceMs, at: Date.now(), data };
    return data;
  } catch {
    return [];
  }
}

/** Свежие сообщения для live-ленты (без кэша длинного периода). */
export async function fetchRecentMessages(
  companyId: string,
  sinceMs: number,
  maxDocs = 120,
  menuAccess?: MenuAccess | null
): Promise<MessageRow[]> {
  assertAnalyticsView(menuAccess);
  try {
    const since = Timestamp.fromMillis(sinceMs);
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('companyId', '==', companyId),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
      limit(maxDocs)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const x = d.data() as DocumentData;
      const text = (x.text as string) || '';
      return {
        id: d.id,
        conversationId: (x.conversationId as string) || '',
        direction: (x.direction as 'incoming' | 'outgoing') || 'incoming',
        createdAt: toMs(x.createdAt),
        system: Boolean(x.system),
        text: text.slice(0, 160)
      };
    });
  } catch {
    return [];
  }
}

export async function fetchChatManagers(
  companyId: string,
  menuAccess?: MenuAccess | null
): Promise<ManagerRow[]> {
  assertAnalyticsView(menuAccess);
  const q = query(collection(db, 'chatManagers'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    name: ((d.data() as DocumentData).name as string) || d.id
  }));
}
