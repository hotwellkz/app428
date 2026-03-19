import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';
import type { CrmAiBot, CrmAiBotStatus } from '../../types/crmAiBot';
import { defaultCrmAiBotConfig, parseCrmAiBotConfig, type CrmAiBotConfig } from '../../types/crmAiBotConfig';

export const CRM_AI_BOTS_COLLECTION = 'crmAiBots';

function docToCrmAiBot(d: DocumentSnapshot): CrmAiBot {
  const data = (d.data() ?? {}) as Record<string, unknown>;
  return {
    id: d.id,
    companyId: (data.companyId as string) ?? '',
    name: (data.name as string) ?? '',
    description: (data.description as string) ?? null,
    botType: (data.botType as string) ?? 'other',
    channel: (data.channel as string) ?? 'other',
    status: (['draft', 'active', 'paused', 'archived'].includes(data.status as string)
      ? data.status
      : 'draft') as CrmAiBotStatus,
    createdAt: (data.createdAt as CrmAiBot['createdAt']) ?? null,
    updatedAt: (data.updatedAt as CrmAiBot['updatedAt']) ?? null,
    createdBy: (data.createdBy as string) ?? null,
    config: parseCrmAiBotConfig(data.config)
  };
}

function sortBotsByUpdated(a: CrmAiBot, b: CrmAiBot): number {
  const ta =
    a.updatedAt && typeof (a.updatedAt as { toMillis?: () => number }).toMillis === 'function'
      ? (a.updatedAt as { toMillis: () => number }).toMillis()
      : a.updatedAt instanceof Date
        ? a.updatedAt.getTime()
        : 0;
  const tb =
    b.updatedAt && typeof (b.updatedAt as { toMillis?: () => number }).toMillis === 'function'
      ? (b.updatedAt as { toMillis: () => number }).toMillis()
      : b.updatedAt instanceof Date
        ? b.updatedAt.getTime()
        : 0;
  return tb - ta;
}

/** Подписка на всех ботов компании (сортировка по updatedAt на клиенте) */
export function subscribeCrmAiBots(companyId: string, onList: (bots: CrmAiBot[]) => void): Unsubscribe {
  const q = query(collection(db, CRM_AI_BOTS_COLLECTION), where('companyId', '==', companyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => docToCrmAiBot(d)).sort(sortBotsByUpdated);
    onList(list);
  });
}

export interface CreateCrmAiBotInput {
  companyId: string;
  name: string;
  description: string | null;
  botType: string;
  channel: string;
  status: CrmAiBotStatus;
  createdBy: string | null;
}

export async function createCrmAiBot(input: CreateCrmAiBotInput): Promise<string> {
  const config = defaultCrmAiBotConfig();
  const ref = await addDoc(collection(db, CRM_AI_BOTS_COLLECTION), {
    companyId: input.companyId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    botType: input.botType,
    channel: input.channel,
    status: input.status,
    createdBy: input.createdBy,
    config,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export interface UpdateCrmAiBotInput {
  name: string;
  description: string | null;
  botType: string;
  channel: string;
  status: CrmAiBotStatus;
  /** Если задан — перезаписывает весь объект config в документе */
  config?: CrmAiBotConfig;
}

export async function updateCrmAiBot(botId: string, patch: UpdateCrmAiBotInput): Promise<void> {
  const payload: Record<string, unknown> = {
    name: patch.name.trim(),
    description: patch.description?.trim() || null,
    botType: patch.botType,
    channel: patch.channel,
    status: patch.status,
    updatedAt: serverTimestamp()
  };
  if (patch.config !== undefined) {
    payload.config = patch.config;
  }
  await updateDoc(doc(db, CRM_AI_BOTS_COLLECTION, botId), payload);
}

export async function getCrmAiBotById(botId: string): Promise<CrmAiBot | null> {
  const snap = await getDoc(doc(db, CRM_AI_BOTS_COLLECTION, botId));
  if (!snap.exists()) return null;
  return docToCrmAiBot(snap);
}
