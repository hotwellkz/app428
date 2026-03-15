import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { publicTokens } from '../theme';

const NAV_LINKS = [
  { label: 'Возможности', to: '/vozmozhnosti' },
  { label: 'Решения', to: '/crm-dlya-biznesa' },
  { label: 'Цены', to: '/ceny' },
  { label: 'FAQ', to: '/faq' },
];

export const PublicHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogin = () => {
    setMobileOpen(false);
    if (location.pathname === '/') {
      document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <header className="font-sans fixed top-0 left-0 right-0 z-50 bg-sf-surface/90 backdrop-blur-md border-b border-sf-borderLight" data-public-site>
      <div className={publicTokens.container.base}>
        <div className="flex items-center justify-between h-16 md:h-18">
          <Link to="/" className="flex items-center gap-2 text-sf-text-primary font-semibold text-xl tracking-tight">
            <span className="w-8 h-8 rounded-sfButton bg-sf-primary flex items-center justify-center text-sf-text-inverse font-bold text-sm shadow-sfMd">
              2
            </span>
            2wix
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((item) => (
              <Link key={item.label} to={item.to} className="text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button type="button" onClick={handleLogin} className="text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary px-4 py-2 transition-colors">
              Войти
            </button>
            <button type="button" onClick={() => navigate('/register-company')} className={publicTokens.button.primary}>
              Попробовать
            </button>
          </div>

          <button type="button" onClick={() => setMobileOpen((o) => !o)} className="md:hidden p-2 text-sf-text-secondary hover:text-sf-text-primary rounded-sfButton" aria-label="Меню">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-sf-borderLight bg-sf-surface/95 backdrop-blur-md px-4 py-4 space-y-1">
          {NAV_LINKS.map((item) => (
            <Link key={item.label} to={item.to} onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-sf-text-secondary">
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={handleLogin} className="block w-full text-left py-2 text-sm font-medium text-sf-text-secondary">
            Войти
          </button>
          <button type="button" onClick={() => { navigate('/register-company'); setMobileOpen(false); }} className="block w-full text-left py-3 text-sm font-semibold text-sf-text-primary mt-2">
            Попробовать
          </button>
        </div>
      )}
    </header>
  );
};
