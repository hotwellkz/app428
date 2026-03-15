import React from 'react';
import { Link } from 'react-router-dom';
import { publicTokens } from '../theme';

const FOOTER_LINKS = [
  { label: 'Возможности', to: '/vozmozhnosti' },
  { label: 'Управление клиентами', to: '/upravlenie-klientami' },
  { label: 'Аналитика продаж', to: '/analitika-prodazh' },
  { label: 'Контроль менеджеров', to: '/kontrol-menedzherov' },
  { label: 'CRM для бизнеса', to: '/crm-dlya-biznesa' },
  { label: 'CRM для малого бизнеса', to: '/crm-dlya-malogo-biznesa' },
  { label: 'CRM для продаж', to: '/crm-dlya-prodazh' },
  { label: 'WhatsApp CRM', to: '/whatsapp-crm' },
  { label: 'Цены', to: '/ceny' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Вход', to: '/' },
];

export const PublicFooter: React.FC = () => (
  <footer id="footer" className={`${publicTokens.bg.dark} text-slate-300 ${publicTokens.section.pySm}`} data-public-site>
    <div className={publicTokens.container.base}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <Link to="/" className="flex items-center gap-2 text-white font-semibold text-lg">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
            2
          </span>
          2wix
        </Link>
        <nav className="flex flex-wrap gap-6">
          {FOOTER_LINKS.map(({ label, to }) => (
            <Link key={label} to={to} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-10 pt-8 border-t border-slate-700/50">
        <p className="text-sm text-slate-500">© {new Date().getFullYear()} 2wix. CRM для бизнеса, продаж и коммуникаций.</p>
      </div>
    </div>
  </footer>
);
