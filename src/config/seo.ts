/**
 * Технический SEO: базовый URL и список публичных страниц для индексации.
 * Используется для canonical, sitemap, robots.
 */
export const SEO_BASE_URL = 'https://2wix.ru';

/** Публичные SEO-страницы (индексируемые). Остальные маршруты — noindex / disallow. */
export const SEO_PUBLIC_PATHS = [
  '/',
  '/crm-dlya-biznesa',
  '/crm-dlya-prodazh',
  '/whatsapp-crm',
  '/vozmozhnosti',
  '/ceny',
  '/faq',
  '/klienty',
  '/whatsapp-i-chaty',
  '/sdelki-i-voronka',
  '/bystrye-otvety',
  '/analitika',
  '/tranzakcii-i-finansy',
  '/sklad-i-materialy',
  '/roli-i-prava',
] as const;

/** Пути CRM и служебные — не индексировать (Disallow в robots, noindex в meta). */
export const SEO_DISALLOW_PATHS = [
  '/transactions',
  '/transaction-history',
  '/feed',
  '/clients',
  '/client-files',
  '/admin',
  '/daily-report',
  '/templates',
  '/products',
  '/warehouse',
  '/employees',
  '/calculator',
  '/deals',
  '/analytics',
  '/whatsapp',
  '/settings',
  '/profile',
  '/finishing-materials',
  '/register',
  '/register-company',
  '/accept-invite',
  '/login',
  '/app',
];

export function getCanonicalUrl(path: string): string {
  const base = SEO_BASE_URL.replace(/\/$/, '');
  const p = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `${base}${p || ''}`;
}
