import type { Timestamp } from 'firebase/firestore';

export type VoiceCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
export type VoiceCampaignItemStatus =
  | 'pending'
  | 'queued'
  | 'calling'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'callback'
  | 'skipped';

export interface VoiceCampaign {
  id: string;
  companyId: string;
  name: string;
  botId: string;
  fromNumberId: string;
  provider: 'twilio';
  sourceType: 'csv' | 'manual';
  status: VoiceCampaignStatus;
  totalCount: number;
  queuedCount: number;
  dispatchedCount: number;
  completedCount: number;
  failedCount: number;
  noAnswerCount: number;
  busyCount: number;
  callbackCount: number;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface VoiceCampaignItem {
  id: string;
  campaignId: string;
  companyId: string;
  phone: string;
  normalizedPhone: string;
  status: VoiceCampaignItemStatus;
  attemptsCount: number;
  lastCallId?: string | null;
  linkedRunId?: string | null;
  outcome?: string | null;
  lastError?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

