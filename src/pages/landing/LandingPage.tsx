import React from 'react';
import { Link } from 'react-router-dom';
import { PublicPageSEO } from '../../seo';
import { PublicLayout } from '../../public';
import { HeroSection } from './HeroSection';
import { ForWhoSection } from './ForWhoSection';
import { FeaturesSection } from './FeaturesSection';
import { Why2wixSection } from './Why2wixSection';
import { UseCasesSection } from './UseCasesSection';
import { ScreenshotsSection } from './ScreenshotsSection';
import { FAQSection } from './FAQSection';
import { CTASection } from './CTASection';

const META_TITLE = '2wix — CRM для бизнеса, продаж и WhatsApp в одном окне';
const META_DESCRIPTION =
  'Контроль клиентов, сделок, сотрудников, сообщений и аналитики в одной системе. Универсальная CRM для малого и среднего бизнеса, отделов продаж и команд с WhatsApp.';

interface LandingPageProps {
  onLoginSuccess: () => void;
}

const linkButtonClass = 'px-4 py-2.5 rounded-sfButton bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors text-sm';

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => (
  <>
    <PublicPageSEO title={META_TITLE} description={META_DESCRIPTION} path="/" />
    <PublicLayout>
      <HeroSection onLoginSuccess={onLoginSuccess} />
      <ForWhoSection />
      <FeaturesSection />
      <Why2wixSection />
      <UseCasesSection />
      <ScreenshotsSection />
      <FAQSection />
      <section className="font-sans py-16 md:py-20 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-sf-text-primary mb-8">Подробнее о 2wix</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/crm-dlya-biznesa" className={linkButtonClass}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={linkButtonClass}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={linkButtonClass}>WhatsApp CRM</Link>
            <Link to="/vozmozhnosti" className={linkButtonClass}>Возможности</Link>
            <Link to="/ceny" className={linkButtonClass}>Цены</Link>
            <Link to="/faq" className={linkButtonClass}>Вопросы и ответы</Link>
          </div>
        </div>
      </section>
      <CTASection />
    </PublicLayout>
  </>
);
