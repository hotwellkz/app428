import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO_CONFIG } from './seoConfig';
import {
  getCanonicalUrl,
  buildAbsoluteUrl,
  formatTitle,
  isProductionLikeUrl,
} from './seoHelpers';

export interface BreadcrumbItem {
  name: string;
  item: string;
}

export interface PublicPageSEOProps {
  /** Заголовок страницы (обязателен для публичных). Будет отформатирован с siteName при необходимости. */
  title: string;
  /** Meta description (обязателен для публичных). */
  description: string;
  /** Путь для canonical и og:url (по умолчанию — текущий pathname). */
  path?: string;
  /** robots (по умолчанию index, follow). */
  robots?: string;
  /** URL изображения для og:image и twitter:image. */
  ogImage?: string;
  /** og:type (по умолчанию website). */
  ogType?: string;
  /** Переопределить og:title (если не задано — используется title). */
  ogTitle?: string;
  /** Переопределить og:description. */
  ogDescription?: string;
  /** Twitter card (по умолчанию summary_large_image). */
  twitterCard?: string;
  /** Twitter title (если не задано — title). */
  twitterTitle?: string;
  /** Twitter description (если не задано — description). */
  twitterDescription?: string;
  /** Twitter image (если не задано — ogImage). */
  twitterImage?: string;
  /** Хлебные крошки для JSON-LD BreadcrumbList. */
  breadcrumbs?: BreadcrumbItem[];
  /** Дополнительные structured data (массив объектов для script type="application/ld+json"). */
  structuredData?: object[];
}

const isDev = import.meta.env.DEV;

export const PublicPageSEO: React.FC<PublicPageSEOProps> = ({
  title,
  description,
  path,
  robots = SEO_CONFIG.defaultRobots,
  ogImage = SEO_CONFIG.defaultOgImage,
  ogType = SEO_CONFIG.defaultOgType,
  ogTitle,
  ogDescription,
  twitterCard = SEO_CONFIG.defaultTwitterCard,
  twitterTitle,
  twitterDescription,
  twitterImage,
  breadcrumbs,
  structuredData = [],
}) => {
  const location = useLocation();
  const canonicalPath = path ?? location.pathname;
  const canonicalUrl = getCanonicalUrl(canonicalPath);
  const absoluteUrl = buildAbsoluteUrl(canonicalPath);

  const finalTitle = useMemo(() => formatTitle(title || SEO_CONFIG.defaultTitle), [title]);
  const finalDescription = description || SEO_CONFIG.defaultDescription;
  const finalOgTitle = ogTitle ?? finalTitle;
  const finalOgDescription = ogDescription ?? finalDescription;
  const finalTwitterTitle = twitterTitle ?? finalTitle;
  const finalTwitterDescription = twitterDescription ?? finalDescription;
  const finalTwitterImage = twitterImage ?? ogImage;

  if (isDev) {
    if (!title?.trim()) {
      console.warn('[SEO] Публичная страница без title. Путь:', canonicalPath);
    }
    if (!description?.trim()) {
      console.warn('[SEO] Публичная страница без description. Путь:', canonicalPath);
    }
    if (!isProductionLikeUrl(canonicalUrl)) {
      console.warn('[SEO] Canonical URL не похож на продакшен:', canonicalUrl);
    }
  }

  const breadcrumbSchema =
    breadcrumbs && breadcrumbs.length > 0
      ? {
          '@context': 'https://schema.org' as const,
          '@type': 'BreadcrumbList' as const,
          itemListElement: breadcrumbs.map((b, i) => ({
            '@type': 'ListItem' as const,
            position: i + 1,
            name: b.name,
            item: b.item,
          })),
        }
      : null;

  const allStructuredData = useMemo(() => {
    const list = [...structuredData];
    if (breadcrumbSchema) list.push(breadcrumbSchema);
    return list;
  }, [structuredData, breadcrumbSchema]);

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={SEO_CONFIG.ogLocale} />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={finalTwitterTitle} />
      <meta name="twitter:description" content={finalTwitterDescription} />
      <meta name="twitter:image" content={finalTwitterImage} />

      {allStructuredData.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};
