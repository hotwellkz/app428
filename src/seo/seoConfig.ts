/**
 * Централизованные SEO-настройки для публичных страниц 2wix.
 * Меняйте здесь baseUrl, siteName и дефолты для всего сайта.
 */

export const SEO_CONFIG = {
  /** Базовый URL сайта (без завершающего слеша). Не использовать localhost/preview в проде. */
  baseUrl: 'https://2wix.ru',

  /** Название сайта для title-шаблона и брендинга. */
  siteName: '2wix',

  /** Дефолтный title, если страница не передала свой (fallback). */
  defaultTitle: '2wix — CRM для бизнеса и продаж',

  /** Дефолтное описание (fallback). */
  defaultDescription:
    'CRM для бизнеса, продаж и WhatsApp. Клиенты, сделки, коммуникации в одном окне.',

  /** Дефолтная картинка для og:image и twitter:image (абсолютный URL). */
  defaultOgImage: 'https://2wix.ru/og-image.png',

  /** Дефолтные директивы для публичных страниц. */
  defaultRobots: 'index, follow' as const,

  /** Дефолтный og:type. */
  defaultOgType: 'website' as const,

  /** Дефолтная Twitter card. */
  defaultTwitterCard: 'summary_large_image' as const,

  /** Локаль для og:locale. */
  ogLocale: 'ru_RU' as const,
} as const;

export type SeoConfig = typeof SEO_CONFIG;
