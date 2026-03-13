/**
 * Загрузка данных для дашборда аналитики CRM + WhatsApp.
 * Запросы к Firestore; при отсутствии индексов — часть метрик считается по доступным данным.
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

const COLLECTION_DEALS = 'deals';

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
}

export interface ConversationRow {
  id: string;
  createdAt: number;
  status: string;
  unreadCount: number;
  lastIncomingAt: number;
  lastOutgoingAt: number;
  dealId: string | null;
  companyId?: string;
}

export async function fetchDealsForCompany(companyId: string): Promise<DealRow[]> {
  const q = query(collection(db, COLLECTION_DEALS), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const deal = docToDeal(d.id, d.data() as Record<string, unknown>);
    return {
      id: deal.id,
      createdAt: toMs(deal.createdAt),
      amount: deal.amount ?? 0,
      stageId: deal.stageId,
      source: deal.source ?? null,
      deletedAt: deal.deletedAt ? toMs(deal.deletedAt) : null,
      responsibleUserId: deal.responsibleUserId ?? null,
      pipelineId: deal.pipelineId,
      whatsappConversationId: deal.whatsappConversationId ?? null
    };
  });
}

export async function fetchConversationsForCompany(companyId: string): Promise<ConversationRow[]> {
  const q = query(
    collection(db, COLLECTIONS.CONVERSATIONS),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data() as DocumentData;
    return {
      id: d.id,
      createdAt: toMs(x.createdAt),
      status: (x.status as string) || 'active',
      unreadCount: (x.unreadCount as number) ?? 0,
      lastIncomingAt: toMs(x.lastIncomingAt),
      lastOutgoingAt: toMs(x.lastOutgoingAt),
      dealId: (x.dealId as string) ?? null,
      companyId: x.companyId as string
    };
  });
}

/** Сообщения за период (нужен составной индекс companyId + createdAt). */
export async function fetchMessagesSince(
  companyId: string,
  sinceMs: number,
  maxDocs = 8000
): Promise<MessageRow[]> {
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
    return snap.docs.map((d) => {
      const x = d.data() as DocumentData;
      return {
        id: d.id,
        conversationId: (x.conversationId as string) || '',
        direction: (x.direction as 'incoming' | 'outgoing') || 'incoming',
        createdAt: toMs(x.createdAt),
        system: Boolean(x.system)
      };
    });
  } catch {
    return [];
  }
}
