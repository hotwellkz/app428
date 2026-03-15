import React from 'react';
import { PublicPageSEO } from '../../seo';
import { PublicLayout } from '../../public';
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
}) => (
  <>
    <PublicPageSEO
      title={title}
      description={description}
      path={path}
      ogImage={ogImage}
      breadcrumbs={breadcrumbs}
      structuredData={structuredData}
    />
    <PublicLayout>{children}</PublicLayout>
  </>
);
