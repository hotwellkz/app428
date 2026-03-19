import type { Timestamp } from 'firebase/firestore';

export type PipelineStatus = 'active' | 'archived';

export interface DealsPipeline {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | Timestamp | null;
  updatedAt: Date | Timestamp | null;
}

export type PipelineStageType = 'open' | 'won' | 'lost';

export interface DealsPipelineStage {
  id: string;
  companyId: string;
  pipelineId: string;
  name: string;
  color?: string;
  type: PipelineStageType;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date | Timestamp | null;
  updatedAt: Date | Timestamp | null;
}

export type DealPriority = 'high' | 'medium' | 'low';

export interface Deal {
  id: string;
  companyId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  clientId: string | null;
  clientNameSnapshot?: string;
  clientPhoneSnapshot?: string;
  amount?: number;
  currency?: 'KZT';
  responsibleUserId?: string | null;
  responsibleNameSnapshot?: string;
  status?: string | null;
  /** high | medium | low */
  priority?: string | null;
  note?: string;
  tags?: string[];
  sortOrder: number;
  createdBy?: string | null;
  createdAt: Date | Timestamp | null;
  updatedAt: Date | Timestamp | null;
  stageChangedAt: Date | Timestamp | null;
  /** Текст следующего шага: «Перезвонить», «Отправить КП» */
  nextAction?: string | null;
  /** Когда нужно сделать следующий шаг */
  nextActionAt?: Date | Timestamp | null;
  isArchived?: boolean;
  whatsappConversationId?: string | null;
  deletedAt?: Date | Timestamp | null;
  source?: string | null;
  /** Следующий шаг записан из AI-рекомендации WhatsApp */
  aiTaskFromRecommendation?: boolean;
  aiTaskRecommendationPayloadHash?: string | null;
  aiTaskRecommendationType?: string | null;
}

export interface DealHistoryEntry {
  id: string;
  companyId: string;
  dealId: string;
  message: string;
  createdAt: Date | Timestamp | null;
}

export type DealActivityType =
  | 'created'
  | 'updated'
  | 'stage_changed'
  | 'comment_added'
  | 'deleted'
  | 'restored'
  | 'manager_assigned'
  | 'priority_changed'
  | 'amount_changed'
  | 'next_step_set'
  | 'whatsapp_in'
  | 'whatsapp_out';

export interface DealActivityLogEntry {
  id: string;
  companyId: string;
  dealId: string;
  type: DealActivityType;
  payload: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: Date | Timestamp | null;
}
