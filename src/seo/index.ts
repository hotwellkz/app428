/**
 * Единая SEO-система для публичных страниц 2wix.
 * @see ./README.md
 */

export { SEO_CONFIG } from './seoConfig';
export {
  getCanonicalUrl,
  buildAbsoluteUrl,
  formatTitle,
  isProductionLikeUrl,
} from './seoHelpers';
export { PublicPageSEO } from './PublicPageSEO';
export type { PublicPageSEOProps, BreadcrumbItem } from './PublicPageSEO';
