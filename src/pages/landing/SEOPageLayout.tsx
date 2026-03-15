import React from 'react';
import { Helmet } from 'react-helmet-async';
import { LandingHeader } from './LandingHeader';
import { LandingFooter } from './LandingFooter';

interface SEOPageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const SEOPageLayout: React.FC<SEOPageLayoutProps> = ({ title, description, children }) => (
  <>
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
    </Helmet>
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  </>
);
