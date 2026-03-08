import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase/auth';
import { updateProfile, updatePassword } from 'firebase/auth';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  const user = auth.currentUser;
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col h-dvh bg-gray-100">
        <header className="flex-shrink-0 fixed top-0 left-0 sm:left-64 right-0 bg-white z-50 border-b border-gray-200">
          <div className="relative flex items-center min-h-[56px] h-14 px-3 md:px-6">
            <div className="flex items-center gap-2 flex-shrink-0" style={{ gap: '8px' }}>
              <button
                type="button"
                onClick={toggleMobileSidebar}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 text-gray-700"
                aria-label="Меню"
              >
                <Menu className="w-6 h-6" style={{ width: 24, height: 24 }} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 flex-shrink-0 text-gray-700"
                aria-label="Назад"
              >
                <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
              </button>
              <h1 className="hidden md:block text-xl font-semibold text-gray-900" style={{ fontSize: '20px', fontWeight: 600 }}>
                Профиль
              </h1>
            </div>
            <div className="flex-1 flex items-center justify-center min-w-0 md:hidden">
              <h1 className="text-center truncate text-lg font-semibold text-gray-900">Профиль</h1>
            </div>
            <div className="w-[96px] md:w-20 flex-shrink-0" aria-hidden />
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-auto pt-14 md:pt-28 sm:pl-64">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <p className="text-gray-600 text-sm">Войдите в систему, чтобы изменить профиль.</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-5 w-full h-12 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
              >
                На главную
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Пользователь не авторизован');
      }
      if (displayName !== (currentUser.displayName ?? '')) {
        await updateProfile(currentUser, { displayName });
        showSuccessNotification('Имя пользователя успешно обновлено');
      }
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('Пароли не совпадают');
        }
        if (newPassword.length < 6) {
          throw new Error('Пароль должен содержать минимум 6 символов');
        }
        await updatePassword(currentUser, newPassword);
        setNewPassword('');
        setConfirmPassword('');
        showSuccessNotification('Пароль успешно обновлен');
      }
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при обновлении профиля');
    } finally {
      setLoading(false);
    }
  };

  const displayLabel = user.displayName || user.email?.split('@')[0] || 'П';
  const initial = (displayLabel.charAt(0) || 'П').toUpperCase();

  return (
    <div className="flex flex-col h-dvh bg-gray-100">
      <header
        className="flex-shrink-0 fixed top-0 left-0 sm:left-64 right-0 bg-white z-50 transition-all duration-300 border-b border-gray-200"
        style={{ background: '#ffffff' }}
      >
        <div
          className="relative flex items-center min-h-[56px] h-14 px-3 md:px-6 md:py-3 md:min-h-0 md:h-auto"
          style={{ paddingLeft: '12px', paddingRight: '12px' }}
        >
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 w-[96px] md:w-auto md:min-w-0" style={{ gap: '8px' }}>
            <button
              type="button"
              onClick={toggleMobileSidebar}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 text-gray-700"
              aria-label="Меню"
            >
              <Menu className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto p-2 md:mr-4 flex-shrink-0 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Назад"
            >
              <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <h1
              className="hidden md:block text-xl font-semibold text-gray-900"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: 600, color: '#111827' }}
            >
              Профиль
            </h1>
          </div>
          <div className="flex-1 flex items-center justify-center min-w-0 md:hidden">
            <h1
              className="text-center truncate"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111827' }}
            >
              Профиль
            </h1>
          </div>
          <div className="flex items-center flex-shrink-0 w-[96px] md:w-20 justify-end" aria-hidden />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto pt-14 md:pt-28 sm:pl-64">
        <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-4 mb-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white text-xl"
                style={{ backgroundColor: '#10b981' }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 truncate" style={{ fontSize: '20px', fontWeight: 600 }}>
                  {user.displayName || 'Пользователь'}
                </h2>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя пользователя
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Новый пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 px-3 pr-12 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    minLength={6}
                    placeholder="Оставьте пустым, чтобы не менять"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Подтверждение пароля
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 px-3 pr-12 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
                >
                  {loading ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
