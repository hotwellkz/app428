import React from 'react';
import { Link } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { ArrowRight } from 'lucide-react';

export interface FeaturePageConfig {
  title: string;
  description: string;
  h1: string;
  subtitle: string;
  content: string;
  bullets?: string[];
}

interface FeaturePageProps {
  config: FeaturePageConfig;
  backToLabel?: string;
  backToHref?: string;
}

export const FeaturePage: React.FC<FeaturePageProps> = ({
  config,
  backToLabel = 'Все возможности',
  backToHref = '/vozmozhnosti',
}) => (
  <SEOPageLayout title={config.title} description={config.description}>
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-sf-backgroundSection to-sf-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={backToHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary mb-8">
          <ArrowRight className="w-4 h-4 rotate-180" />
          {backToLabel}
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold text-sf-text-primary tracking-tight">
          {config.h1}
        </h1>
        <p className="mt-6 text-xl text-sf-text-secondary">
          {config.subtitle}
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="prose prose-slate max-w-none">
          <p className="text-sf-text-secondary leading-relaxed mb-8">{config.content}</p>
          {config.bullets && config.bullets.length > 0 && (
            <ul className="space-y-2 text-sf-text-secondary mb-8">
              {config.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
        <Link
          to={backToHref}
          className="inline-flex items-center gap-2 text-sf-accent font-medium hover:text-sf-primary"
        >
          {backToLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>

    <PublicCTA />
  </SEOPageLayout>
);
