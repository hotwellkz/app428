import { SEO_CONFIG } from './seoConfig';

/**
 * Строит канонический URL по пути.
 * Всегда использует baseUrl из конфига (без localhost/dev).
 * Путь без query-string и hash.
 */
export function getCanonicalUrl(path: string, baseUrl: string = SEO_CONFIG.baseUrl): string {
  const base = baseUrl.replace(/\/$/, '');
  const cleanPath = path === '/' ? '' : path.startsWith('/') ? path.split('?')[0].split('#')[0] : `/${path}`;
  return `${base}${cleanPath || ''}`;
}

/**
 * Строит абсолютный URL для пути (canonical, og:url и т.д.).
 * В проде не должен содержать localhost или dev-хосты.
 */
export function buildAbsoluteUrl(path: string, baseUrl: string = SEO_CONFIG.baseUrl): string {
  return getCanonicalUrl(path, baseUrl);
}

/**
 * Проверка, что URL выглядит как продакшен (для dev-предупреждений).
 */
export function isProductionLikeUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    !lower.includes('localhost') &&
    !lower.includes('127.0.0.1') &&
    !lower.includes('/preview') &&
    !lower.includes('.netlify.app')
  );
}

/**
 * Формирует title в едином стиле: "Название страницы | 2wix".
 * Не добавляет суффикс, если уже есть "|" или в title упомянут siteName.
 */
export function formatTitle(title: string, siteName: string = SEO_CONFIG.siteName): string {
  if (!title?.trim()) return SEO_CONFIG.defaultTitle;
  const t = title.trim();
  if (t.includes('|')) return t;
  if (t.length < 30 || t.toLowerCase().includes(siteName.toLowerCase())) return t;
  return `${t} | ${siteName}`;
}
