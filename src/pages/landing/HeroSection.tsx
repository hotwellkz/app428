import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../lib/firebase/auth';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';
import { MessageSquare, BarChart3, Users, Wallet, Briefcase, ArrowRight, LogIn } from 'lucide-react';

interface HeroSectionProps {
  onLoginSuccess: () => void;
}

const BADGES = [
  { icon: MessageSquare, label: 'WhatsApp CRM' },
  { icon: Briefcase, label: 'Сделки' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: Users, label: 'Команда' },
  { icon: Wallet, label: 'Финансы' },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimEmail = email.trim();
    if (!trimEmail || !password) {
      setError('Введите email и пароль');
      return;
    }
    setLoading(true);
    try {
      await loginUser(trimEmail, password);
      showSuccessNotification('Вход выполнен');
      onLoginSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось войти';
      setError(msg);
      showErrorNotification(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="hero" className="font-sans relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-accentLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-20 left-0 w-80 h-80 bg-sf-primaryLight/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-[1.1]">
              CRM для бизнеса, продаж и WhatsApp в одном окне
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
              Контроль клиентов, сделок, сотрудников, сообщений, аналитики и процессов в одной системе.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/register-company')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-sfButton font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-sfMd transition-all hover:shadow-sfLg"
              >
                Попробовать бесплатно
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-sfButton font-semibold text-sf-primary bg-sf-surface border border-sf-primary hover:bg-sf-primaryLight transition-all"
              >
                Смотреть возможности
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {BADGES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sfBadge bg-sf-surface/90 border border-sf-borderLight text-sm font-medium text-sf-text-secondary shadow-sfSm"
                >
                  <Icon className="w-4 h-4 text-sf-accent" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-sfCard bg-sf-surface/95 backdrop-blur-sm border border-sf-borderLight shadow-sfCard p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-sf-text-primary mb-1">Вход в 2wix</h3>
              <p className="text-sm text-sf-text-muted mb-6">Уже есть аккаунт? Войдите ниже.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="hero-email" className="sr-only">Email</label>
                  <input
                    id="hero-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="Email"
                    className="w-full px-4 py-3 rounded-sfButton border border-sf-border focus:border-sf-borderFocus focus:ring-2 focus:ring-sf-primary/20 outline-none transition-all text-sf-text-primary placeholder-sf-text-muted"
                  />
                </div>
                <div>
                  <label htmlFor="hero-password" className="sr-only">Пароль</label>
                  <input
                    id="hero-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="Пароль"
                    className="w-full px-4 py-3 rounded-sfButton border border-sf-border focus:border-sf-borderFocus focus:ring-2 focus:ring-sf-primary/20 outline-none transition-all text-sf-text-primary placeholder-sf-text-muted"
                  />
                </div>
                {error && (
                  <p className="text-sm text-sf-error">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-sfButton font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover focus:ring-2 focus:ring-sf-primary focus:ring-offset-2 transition-all disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? 'Вход...' : 'Войти'}
                </button>
              </form>
              <div className="mt-4 flex flex-col sm:flex-row gap-2 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="text-sm font-medium text-sf-text-link hover:text-sf-text-linkHover"
                >
                  Создать компанию
                </button>
                <span className="hidden sm:inline text-sf-text-muted">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/accept-invite')}
                  className="text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary"
                >
                  Присоединиться по приглашению
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
