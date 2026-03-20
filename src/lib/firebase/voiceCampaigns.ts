import { collection, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import type { VoiceCampaign, VoiceCampaignItem } from '../../types/voiceCampaign';
import { voiceFetch } from '../voice/voiceLauncherApi';

const CAMPAIGNS = 'voiceCampaigns';
const ITEMS = 'voiceCampaignItems';

function toCampaign(id: string, d: Record<string, unknown>): VoiceCampaign {
  return {
    id,
    companyId: String(d.companyId ?? ''),
    name: String(d.name ?? ''),
    botId: String(d.botId ?? ''),
    fromNumberId: String(d.fromNumberId ?? ''),
    provider: 'twilio',
    sourceType: (String(d.sourceType ?? 'manual') === 'csv' ? 'csv' : 'manual'),
    status: String(d.status ?? 'draft') as VoiceCampaign['status'],
    totalCount: Number(d.totalCount ?? 0),
    queuedCount: Number(d.queuedCount ?? 0),
    dispatchedCount: Number(d.dispatchedCount ?? 0),
    completedCount: Number(d.completedCount ?? 0),
    failedCount: Number(d.failedCount ?? 0),
    noAnswerCount: Number(d.noAnswerCount ?? 0),
    busyCount: Number(d.busyCount ?? 0),
    callbackCount: Number(d.callbackCount ?? 0),
    createdAt: (d.createdAt as VoiceCampaign['createdAt']) ?? null,
    updatedAt: (d.updatedAt as VoiceCampaign['updatedAt']) ?? null
  };
}

function toItem(id: string, d: Record<string, unknown>): VoiceCampaignItem {
  return {
    id,
    campaignId: String(d.campaignId ?? ''),
    companyId: String(d.companyId ?? ''),
    phone: String(d.phone ?? ''),
    normalizedPhone: String(d.normalizedPhone ?? ''),
    status: String(d.status ?? 'pending') as VoiceCampaignItem['status'],
    attemptsCount: Number(d.attemptsCount ?? 0),
    lastCallId: d.lastCallId != null ? String(d.lastCallId) : null,
    linkedRunId: d.linkedRunId != null ? String(d.linkedRunId) : null,
    outcome: d.outcome != null ? String(d.outcome) : null,
    lastError: d.lastError != null ? String(d.lastError) : null,
    createdAt: (d.createdAt as VoiceCampaignItem['createdAt']) ?? null,
    updatedAt: (d.updatedAt as VoiceCampaignItem['updatedAt']) ?? null
  };
}

export function subscribeVoiceCampaigns(companyId: string, cb: (items: VoiceCampaign[]) => void): Unsubscribe {
  const q = query(collection(db, CAMPAIGNS), where('companyId', '==', companyId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toCampaign(d.id, d.data() as Record<string, unknown>))));
}

export function subscribeVoiceCampaignItems(
  companyId: string,
  campaignId: string,
  cb: (items: VoiceCampaignItem[]) => void
): Unsubscribe {
  const q = query(
    collection(db, ITEMS),
    where('companyId', '==', companyId),
    where('campaignId', '==', campaignId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toItem(d.id, d.data() as Record<string, unknown>))));
}

export async function createVoiceCampaign(input: {
  name: string;
  botId: string;
  fromNumberId: string;
  sourceType: 'csv' | 'manual';
  phones: string[];
  maxConcurrentCalls: number;
  callsPerMinute: number;
}) {
  const res = await voiceFetch('/api/voice/campaign-operational', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...input })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Не удалось создать кампанию');
  return data as { campaignId: string };
}

export async function updateVoiceCampaignStatus(campaignId: string, action: 'start' | 'pause' | 'resume' | 'stop' | 'dispatch_now') {
  const res = await voiceFetch('/api/voice/campaign-operational', {
    method: 'POST',
    body: JSON.stringify({ action, campaignId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Не удалось выполнить действие');
}

