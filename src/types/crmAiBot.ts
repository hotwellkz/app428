import type { Timestamp } from 'firebase/firestore';
import type { CrmAiBotConfig } from './crmAiBotConfig';

/** Статус AI-бота / автоворонки */
export type CrmAiBotStatus = 'draft' | 'active' | 'paused' | 'archived';

/** Документ Firestore: crmAiBots/{id} */
export interface CrmAiBot {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  /** Ключ типа (sales_manager, qualifier, …) */
  botType: string;
  /** Ключ канала (whatsapp, site, …) */
  channel: string;
  status: CrmAiBotStatus;
  createdAt: Timestamp | Date | null;
  updatedAt: Timestamp | Date | null;
  createdBy: string | null;
  /** Сценарий, роль, правила, CRM-флаги (после этапа 2 всегда нормализуется при чтении) */
  config: CrmAiBotConfig;
}

export const CRM_AI_BOT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'sales_manager', label: 'Менеджер по продажам' },
  { value: 'qualifier', label: 'Квалификатор' },
  { value: 'follow_up', label: 'Follow-up бот' },
  { value: 'after_proposal', label: 'Бот после КП' },
  { value: 'reactivation', label: 'Реактивация лида' },
  { value: 'other', label: 'Другое' }
];

export const CRM_AI_BOT_CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'site', label: 'Сайт / заявки' },
  { value: 'manual', label: 'Ручной режим' },
  { value: 'voice_future', label: 'Голосовой (будущий)' },
  { value: 'other', label: 'Другое' }
];

export const CRM_AI_BOT_STATUS_OPTIONS: { value: CrmAiBotStatus; label: string }[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'active', label: 'Активен' },
  { value: 'paused', label: 'На паузе' },
  { value: 'archived', label: 'Архив' }
];

export function labelCrmAiBotType(value: string): string {
  return CRM_AI_BOT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelCrmAiBotChannel(value: string): string {
  return CRM_AI_BOT_CHANNEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelCrmAiBotStatus(status: CrmAiBotStatus): string {
  return CRM_AI_BOT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}
