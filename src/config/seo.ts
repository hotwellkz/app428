/**
 * Технический SEO: списки путей для robots/sitemap и обратная совместимость.
 * Базовый URL и хелперы — в src/seo/ (seoConfig, seoHelpers).
 */
import { SEO_CONFIG } from '../seo/seoConfig';
import { getCanonicalUrl as getCanonicalUrlFromSeo } from '../seo/seoHelpers';

export const SEO_BASE_URL = SEO_CONFIG.baseUrl;
export { getCanonicalUrlFromSeo as getCanonicalUrl };

/** Публичные SEO-страницы (индексируемые). */
export const SEO_PUBLIC_PATHS = [
  '/',
  '/crm-dlya-biznesa',
  '/crm-dlya-malogo-biznesa',
  '/crm-dlya-prodazh',
  '/whatsapp-crm',
  '/crm-twilio',
  '/vozmozhnosti',
  '/ceny',
  '/faq',
  '/upravlenie-klientami',
  '/analitika-prodazh',
  '/kontrol-menedzherov',
  '/upravlenie-zayavkami',
  '/klienty',
  '/whatsapp-i-chaty',
  '/sdelki-i-voronka',
  '/bystrye-otvety',
  '/analitika',
  '/tranzakcii-i-finansy',
  '/sklad-i-materialy',
  '/roli-i-prava',
  '/whatsapp-dlya-otdela-prodazh',
  '/edinaya-baza-klientov',
  '/uchet-klientov',
  '/crm-dlya-komandy',
  '/crm-dlya-stroitelnoi-kompanii',
  '/crm-dlya-proizvodstva',
  '/crm-dlya-uslug',
  '/chto-takoe-crm',
  '/kak-vybrat-crm',
  '/zachem-nuzhna-crm',
  '/crm-ili-excel',
  '/crm-dlya-kaspi',
] as const;

/** Пути CRM и служебные — не индексировать. */
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
