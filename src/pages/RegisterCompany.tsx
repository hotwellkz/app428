import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { auth, registerCompanyUser } from '../lib/firebase/auth';
import { showErrorNotification, showSuccessNotification } from '../utils/notifications';
import { Eye, EyeOff } from 'lucide-react';

export const RegisterCompany: React.FC = () => {
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.currentUser) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!companyName.trim()) {
      setErrorMessage('Введите название компании');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Введите имя владельца');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Введите email');
      return;
    }
    if (!password) {
      setErrorMessage('Введите пароль');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Пароль должен быть не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await registerCompanyUser(companyName.trim(), email, password, ownerName.trim());
      showSuccessNotification('Компания и аккаунт созданы');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as Error).message
          : 'Не удалось создать компанию. Попробуйте ещё раз.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Создать компанию
            </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Создайте компанию и аккаунт владельца
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
                Название компании
              </label>
              <input
                id="company-name"
                name="companyName"
                type="text"
                required
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setErrorMessage(null); }}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="ООО Рога и копыта"
              />
            </div>
            <div>
              <label htmlFor="owner-name" className="block text-sm font-medium text-gray-700 mb-1">
                Имя владельца
              </label>
              <input
                id="owner-name"
                name="ownerName"
                type="text"
                required
                value={ownerName}
                onChange={(e) => { setOwnerName(e.target.value); setErrorMessage(null); }}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMessage(null); }}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMessage(null); }}
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="Не менее 6 символов"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Подтверждение пароля
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrorMessage(null); }}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="Повторите пароль"
              />
            </div>
          </div>
          {errorMessage && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loading ? 'Создание…' : 'Создать компанию'}
            </button>
          </div>
          <p className="text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link to="/" className="font-medium text-emerald-600 hover:text-emerald-500">
              Войти
            </Link>
          </p>
        </form>
        </div>
      </div>
    </>
  );
};

export default RegisterCompany;
