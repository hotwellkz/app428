import React from 'react';
import { Link } from 'react-router-dom';
import { PublicPageSEO } from '../../seo';
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
    <PublicPageSEO
      title={META_TITLE}
      description={META_DESCRIPTION}
      path="/"
    />
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
        <section className="py-16 md:py-20 bg-slate-50/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Подробнее о 2wix</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/crm-dlya-biznesa" className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm">
                CRM для бизнеса
              </Link>
              <Link to="/crm-dlya-prodazh" className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm">
                CRM для продаж
              </Link>
              <Link to="/whatsapp-crm" className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm">
                WhatsApp CRM
              </Link>
              <Link to="/vozmozhnosti" className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm">
                Возможности
              </Link>
              <Link to="/ceny" className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm">
                Цены
              </Link>
              <Link to="/faq" className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm">
                Вопросы и ответы
              </Link>
            </div>
          </div>
        </section>
        <CTASection />
        <LandingFooter />
      </main>
    </div>
  </>
);
