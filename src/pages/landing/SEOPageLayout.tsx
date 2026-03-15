import React from 'react';
import { useLocation } from 'react-router-dom';
import { LandingHeader } from './LandingHeader';
import { LandingFooter } from './LandingFooter';
import { PublicPageSEO } from '../../seo';
import type { BreadcrumbItem } from '../../seo';

interface SEOPageLayoutProps {
  title: string;
  description: string;
  /** Путь для canonical и og:url (по умолчанию — текущий pathname) */
  path?: string;
  /** URL изображения для og:image (по умолчанию — из seoConfig) */
  ogImage?: string;
  /** Хлебные крошки для JSON-LD */
  breadcrumbs?: BreadcrumbItem[];
  /** Дополнительные structured data (JSON-LD) */
  structuredData?: object[];
  children: React.ReactNode;
}

export const SEOPageLayout: React.FC<SEOPageLayoutProps> = ({
  title,
  description,
  path,
  ogImage,
  breadcrumbs,
  structuredData,
  children,
}) => {
  return (
    <>
      <PublicPageSEO
        title={title}
        description={description}
        path={path}
        ogImage={ogImage}
        breadcrumbs={breadcrumbs}
        structuredData={structuredData}
      />
      <div className="min-h-screen bg-white text-slate-900 antialiased">
        <LandingHeader />
        <main>{children}</main>
        <LandingFooter />
      </div>
    </>
  );
};
