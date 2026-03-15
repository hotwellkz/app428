import React from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { LandingHeader } from './LandingHeader';
import { LandingFooter } from './LandingFooter';
import { getCanonicalUrl } from '../../config/seo';

const DEFAULT_OG_IMAGE = 'https://2wix.ru/og-image.png';

interface SEOPageLayoutProps {
  title: string;
  description: string;
  /** Путь для canonical и og:url (по умолчанию — текущий pathname) */
  path?: string;
  /** URL изображения для og:image (по умолчанию — общий og-image) */
  ogImage?: string;
  /** Хлебные крошки для JSON-LD (опционально). Например: [{ name: 'Главная', item: 'https://2wix.ru/' }, { name: 'Цены', item: 'https://2wix.ru/ceny' }] */
  breadcrumbs?: Array<{ name: string; item: string }>;
  children: React.ReactNode;
}

export const SEOPageLayout: React.FC<SEOPageLayoutProps> = ({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  breadcrumbs,
  children,
}) => {
  const location = useLocation();
  const canonicalPath = path ?? location.pathname;
  const canonicalUrl = getCanonicalUrl(canonicalPath);
  const ogUrl = canonicalUrl;

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

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="ru_RU" />

        {breadcrumbSchema && (
          <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        )}
      </Helmet>
      <div className="min-h-screen bg-white text-slate-900 antialiased">
        <LandingHeader />
        <main>{children}</main>
        <LandingFooter />
      </div>
    </>
  );
};
