import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV = [
  { label: 'Возможности', href: '#features' },
  { label: 'Решения', href: '#use-cases' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Войти', href: '#hero', internal: true },
];

export const LandingHeader: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (item: (typeof NAV)[0]) => {
    if (item.internal) {
      const el = document.getElementById('hero');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          <Link to="/" className="flex items-center gap-2 text-slate-900 font-semibold text-xl tracking-tight">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/25">
              2
            </span>
            2wix
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((item) =>
              item.internal ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item)}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {item.label}
                </a>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleNav(NAV.find((n) => n.label === 'Войти')!)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors"
            >
              Войти
            </button>
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-lg shadow-lg shadow-slate-900/20 transition-all"
            >
              Попробовать
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
            aria-label="Меню"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-4 space-y-2">
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleNav(item)}
              className="block w-full text-left py-2 text-sm font-medium text-slate-700"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { navigate('/register-company'); setMobileOpen(false); }}
            className="block w-full text-left py-3 text-sm font-semibold text-slate-900 mt-2"
          >
            Попробовать
          </button>
        </div>
      )}
    </header>
  );
};
