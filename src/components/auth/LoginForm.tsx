import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { loginUser } from '../../lib/firebase/auth';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginFormProps {
  onSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Сбрасываем прошлую ошибку перед новой попыткой
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    // Локальная валидация без запроса в Firebase
    if (!trimmedEmail) {
      setErrorMessage('Введите email');
      return;
    }
    if (!trimmedPassword) {
      setErrorMessage('Введите пароль');
      return;
    }

    setLoading(true);

    try {
      await loginUser(trimmedEmail, trimmedPassword);
      showSuccessNotification('Вход выполнен успешно');
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Не удалось войти в систему. Попробуйте ещё раз';
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
            Вход в систему
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 focus:z-10 sm:text-sm"
                placeholder="Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`appearance-none rounded-none relative block w-full px-3 py-2 pr-10 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:z-10 sm:text-sm border ${
                    errorMessage ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
                  }`}
                  placeholder="Пароль"
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
          </div>

          {errorMessage && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <LogIn className="h-5 w-5 text-emerald-500 group-hover:text-emerald-400" />
              </span>
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="block w-full text-sm font-medium text-emerald-600 hover:text-emerald-500"
            >
              Создать компанию
            </button>
            <button
              type="button"
              onClick={() => navigate('/accept-invite')}
              className="text-sm text-emerald-600 hover:text-emerald-500"
            >
              Присоединиться по приглашению
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};