import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithCustomToken } from '../lib/firebase/auth';
import { showErrorNotification, showSuccessNotification } from '../utils/notifications';
import { Eye, EyeOff, AlertCircle, Building2 } from 'lucide-react';

const GET_INVITE_API = '/.netlify/functions/get-invite';
const ACCEPT_INVITE_API = '/.netlify/functions/accept-invite';

interface InviteInfo {
  companyName: string;
  email: string;
  role: string;
}

export const AcceptInvitePage: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(!!token);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token.trim()) {
      setInviteError('Ссылка приглашения недействительна. Не указан токен.');
      setLoadingInvite(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${GET_INVITE_API}?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setInviteError((data as { error?: string }).error ?? 'Приглашение недействительно или истекло');
          setInvite(null);
          return;
        }
        setInvite(data as InviteInfo);
        setInviteError(null);
        setDisplayName((data as InviteInfo).email?.split('@')[0] ?? '');
      } catch {
        if (!cancelled) setInviteError('Не удалось загрузить приглашение');
      } finally {
        if (!cancelled) setLoadingInvite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!invite) return;
    const trimmedName = displayName.trim() || invite.email.split('@')[0];
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
      const res = await fetch(ACCEPT_INVITE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, displayName: trimmedName, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data as { error?: string }).error ?? 'Не удалось принять приглашение';
        setErrorMessage(msg);
        return;
      }
      const customToken = (data as { customToken?: string }).customToken;
      if (!customToken) {
        setErrorMessage('Не удалось войти после регистрации');
        return;
      }
      await loginWithCustomToken(customToken);
      showSuccessNotification('Вы успешно присоединились к компании');
      onSuccess();
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось принять приглашение');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Загрузка приглашения…</div>
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p>{inviteError ?? 'Приглашение недействительно или истекло'}</p>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="font-medium text-emerald-600 hover:text-emerald-500"
            >
              Вернуться на страницу входа
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Присоединиться к компании
          </h2>
          <div className="mt-3 flex items-center justify-center gap-2 text-gray-600">
            <Building2 className="h-5 w-5" />
            <span className="font-medium">{invite.companyName}</span>
          </div>
          <p className="mt-2 text-center text-sm text-gray-500">
            Введите имя и пароль для создания аккаунта
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email (из приглашения)
              </label>
              <input
                id="invite-email"
                type="email"
                readOnly
                value={invite.email}
                className="block w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-600 rounded-md sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-gray-700 mb-1">
                Ваше имя
              </label>
              <input
                id="display-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`block w-full px-3 py-2 pr-10 border rounded-md sm:text-sm ${
                    errorMessage ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                  placeholder="Не менее 6 символов"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Подтверждение пароля
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className={`block w-full px-3 py-2 border rounded-md sm:text-sm ${
                  errorMessage ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                }`}
                placeholder="Повторите пароль"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {loading ? 'Регистрация…' : 'Присоединиться'}
            </button>
          </div>

          <p className="text-center text-sm text-gray-600">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="font-medium text-emerald-600 hover:text-emerald-500"
            >
              Вернуться на страницу входа
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
