import type { LucideIcon } from 'lucide-react';

export type IntegrationCategoryId =
  | 'messengers'
  | 'ai'
  | 'telephony'
  | 'marketplaces'
  | 'payments'
  | 'other';

/** Унифицированный статус карточки каталога */
export type CatalogIntegrationStatus =
  | 'connected'
  | 'not_connected'
  | 'needs_setup'
  | 'error';

export interface IntegrationRegistryItem {
  id: string;
  title: string;
  shortDescription: string;
  category: IntegrationCategoryId;
  categoryLabel: string;
  Icon: LucideIcon;
}

export interface IntegrationCardModel extends IntegrationRegistryItem {
  status: CatalogIntegrationStatus;
  statusLabel: string;
  summaryLine: string | null;
  lastCheckedAt: string | null;
  loading?: boolean;
}

export const CATEGORY_LABELS: Record<IntegrationCategoryId, string> = {
  messengers: 'Мессенджеры',
  ai: 'AI',
  telephony: 'Телефония',
  marketplaces: 'Маркетплейсы / заказы',
  payments: 'Платежи',
  other: 'Прочее'
};
