import React from 'react';
import { Helmet } from 'react-helmet-async';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { ForWhoSection } from './ForWhoSection';
import { FeaturesSection } from './FeaturesSection';
import { Why2wixSection } from './Why2wixSection';
import { UseCasesSection } from './UseCasesSection';
import { ScreenshotsSection } from './ScreenshotsSection';
import { FAQSection } from './FAQSection';
import { CTASection } from './CTASection';
import { LandingFooter } from './LandingFooter';

const META_TITLE = '2wix — CRM для бизнеса, продаж и WhatsApp в одном окне';
const META_DESCRIPTION =
  'Контроль клиентов, сделок, сотрудников, сообщений и аналитики в одной системе. Универсальная CRM для малого и среднего бизнеса, отделов продаж и команд с WhatsApp.';

interface LandingPageProps {
  onLoginSuccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => (
  <>
    <Helmet>
      <title>{META_TITLE}</title>
      <meta name="description" content={META_DESCRIPTION} />
      <meta property="og:title" content={META_TITLE} />
      <meta property="og:description" content={META_DESCRIPTION} />
      <link rel="canonical" href="https://2wix.ru/" />
    </Helmet>
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <LandingHeader />
      <main>
        <HeroSection onLoginSuccess={onLoginSuccess} />
        <ForWhoSection />
        <FeaturesSection />
        <Why2wixSection />
        <UseCasesSection />
        <ScreenshotsSection />
        <FAQSection />
        <CTASection />
        <LandingFooter />
      </main>
    </div>
  </>
);
