/**
 * Доступ к разделам меню по ID.
 * Расширяемо: позже можно добавить clients.view, clients.edit и т.д.
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
  | 'deals';

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
  deals: boolean;
}

/** Дефолт: все разделы разрешены (для обратной совместимости и owner/admin). */
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
  deals: true,
};

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
  { id: 'whatsapp', label: 'WhatsApp', path: '/whatsapp' },
  { id: 'deals', label: 'Сделки', path: '/deals' },
];

/**
 * Проверка доступа к разделу.
 * @param menuAccess — права из company_users (может быть undefined для старых пользователей)
 * @param section — id раздела
 * @returns true если доступ разрешён. Если menuAccess нет — считаем всё разрешённым (дефолт).
 */
export function canAccessSection(
  menuAccess: MenuAccess | undefined | null,
  section: MenuSectionId
): boolean {
  if (!menuAccess) return true;
  const value = menuAccess[section];
  return value === true;
}

/** Определить section по pathname (для guard). */
export function getSectionByPath(pathname: string): MenuSectionId | null {
  const normalized = pathname.split('?')[0].replace(/\/$/, '') || '/';
  if (normalized === '/client-files' || /^\/clients\/[^/]+\/files/.test(normalized)) return 'clientFiles';
  const section = MENU_SECTIONS.find(
    (s) => s.id !== 'clientFiles' && (normalized === s.path || normalized.startsWith(s.path + '/'))
  );
  return section?.id ?? null;
}
