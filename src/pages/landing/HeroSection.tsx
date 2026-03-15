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
    <section id="hero" className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white" />
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-20 left-0 w-80 h-80 bg-teal-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]">
              CRM для бизнеса, продаж и WhatsApp в одном окне
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-xl leading-relaxed">
              Контроль клиентов, сделок, сотрудников, сообщений, аналитики и процессов в одной системе.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/register-company')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/25 transition-all hover:shadow-xl"
              >
                Попробовать бесплатно
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                Смотреть возможности
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {BADGES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 border border-slate-200/80 text-sm font-medium text-slate-600 shadow-sm"
                >
                  <Icon className="w-4 h-4 text-emerald-600" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Вход в 2wix</h3>
              <p className="text-sm text-slate-500 mb-6">Уже есть аккаунт? Войдите ниже.</p>
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 placeholder-slate-400"
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-slate-900 placeholder-slate-400"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? 'Вход...' : 'Войти'}
                </button>
              </form>
              <div className="mt-4 flex flex-col sm:flex-row gap-2 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Создать компанию
                </button>
                <span className="hidden sm:inline text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => navigate('/accept-invite')}
                  className="text-sm font-medium text-slate-600 hover:text-slate-800"
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
