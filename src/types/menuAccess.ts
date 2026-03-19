/**
 * Доступ к разделам меню по ID.
 * analytics — отдельное право на /analytics (аналитика CRM).
 */
export type MenuSectionId =
  | 'transactions'
  | 'feed'
  | 'clients'
  | 'warehouse'
  | 'calculator'
  | 'clientFiles'
  | 'templates'
  | 'products'
  | 'employees'
  | 'whatsapp'
  | 'knowledgeBase'
  | 'quickReplies'
  | 'integrations'
  | 'autovoronki'
  | 'deals'
  | 'analytics';

export interface MenuAccess {
  transactions: boolean;
  feed: boolean;
  clients: boolean;
  warehouse: boolean;
  calculator: boolean;
  clientFiles: boolean;
  templates: boolean;
  products: boolean;
  employees: boolean;
  whatsapp: boolean;
  knowledgeBase: boolean;
  quickReplies: boolean;
  integrations: boolean;
  /** Автоворонки / AI-боты (маршрут /autovoronki) */
  autovoronki: boolean;
  deals: boolean;
  /** Доступ к /analytics (аналитический центр) */
  analytics: boolean;
}

/** Дефолт: все разделы включены (владелец / старые пользователи без записи menuAccess). */
export const DEFAULT_MENU_ACCESS: MenuAccess = {
  transactions: true,
  feed: true,
  clients: true,
  warehouse: true,
  calculator: true,
  clientFiles: true,
  templates: true,
  products: true,
  employees: true,
  whatsapp: true,
  knowledgeBase: true,
  quickReplies: true,
  integrations: true,
  autovoronki: true,
  deals: true,
  analytics: true
};

/** Менеджер / сотрудник: аналитика по умолчанию выключена (админ может включить). */
export const DEFAULT_MENU_ACCESS_MANAGER: MenuAccess = {
  ...DEFAULT_MENU_ACCESS,
  analytics: false
};

import type { CompanyUserRole } from './company';

export function defaultMenuAccessForRole(role: CompanyUserRole): MenuAccess {
  if (role === 'owner' || role === 'admin') return { ...DEFAULT_MENU_ACCESS };
  return { ...DEFAULT_MENU_ACCESS_MANAGER };
}

/** Конфиг разделов: id, label, путь для роута (для guard). */
export const MENU_SECTIONS: { id: MenuSectionId; label: string; path: string }[] = [
  { id: 'transactions', label: 'Транзакции', path: '/transactions' },
  { id: 'feed', label: 'Лента', path: '/feed' },
  { id: 'clients', label: 'Клиенты', path: '/clients' },
  { id: 'warehouse', label: 'Склад', path: '/warehouse' },
  { id: 'calculator', label: 'Калькулятор', path: '/calculator' },
  { id: 'clientFiles', label: 'Файлы клиентов', path: '/client-files' },
  { id: 'templates', label: 'Шаблоны договоров', path: '/templates' },
  { id: 'products', label: 'Товары и цены', path: '/products' },
  { id: 'employees', label: 'Сотрудники', path: '/employees' },
  { id: 'whatsapp', label: 'Чаты', path: '/whatsapp' },
  { id: 'knowledgeBase', label: 'AI База знаний', path: '/settings/knowledge' },
  { id: 'quickReplies', label: 'Быстрые ответы', path: '/settings/quick-replies' },
  { id: 'integrations', label: 'Интеграции', path: '/settings/integrations' },
  { id: 'autovoronki', label: 'Автоворонки', path: '/autovoronki' },
  { id: 'deals', label: 'Сделки', path: '/deals' },
  { id: 'analytics', label: 'Analytics', path: '/analytics' }
];

export function canAccessSection(
  menuAccess: MenuAccess | undefined | null,
  section: MenuSectionId
): boolean {
  if (!menuAccess) return true;
  const value = menuAccess[section];
  if (section === 'analytics') {
    if (value === true) return true;
    if (value === false) return false;
    return true;
  }
  return value !== false;
}

export function getSectionByPath(pathname: string): MenuSectionId | null {
  const normalized = pathname.split('?')[0].replace(/\/$/, '') || '/';
  /** Журнал AI-срабатываний — то же право, что и «Автоворонки». */
  if (normalized === '/ai-control' || normalized.startsWith('/ai-control/')) return 'autovoronki';
  if (normalized === '/analytics') return 'analytics';
  if (normalized === '/client-files' || /^\/clients\/[^/]+\/files/.test(normalized)) return 'clientFiles';
  const byPath = MENU_SECTIONS.filter((s) => s.id !== 'clientFiles').find(
    (s) => normalized === s.path || normalized.startsWith(s.path + '/')
  );
  return byPath?.id ?? null;
}
