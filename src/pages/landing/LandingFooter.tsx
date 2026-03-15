import React from 'react';
import { Link } from 'react-router-dom';

const FOOTER_LINKS = [
  { label: 'Возможности', href: '/#features' },
  { label: 'Решения', href: '/#use-cases' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Вход', href: '/#hero' },
  { label: 'Контакты', href: '/#footer' },
];

export const LandingFooter: React.FC = () => (
  <footer id="footer" className="bg-slate-900 text-slate-300 py-12 md:py-16">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <Link to="/" className="flex items-center gap-2 text-white font-semibold text-lg">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
            2
          </span>
          2wix
        </Link>
        <nav className="flex flex-wrap gap-6">
          {FOOTER_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mt-10 pt-8 border-t border-slate-700/50">
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} 2wix. CRM для бизнеса, продаж и коммуникаций.
        </p>
      </div>
    </div>
  </footer>
);
