import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface DeletePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void> | void;
}

export const DeletePasswordModal: React.FC<DeletePasswordModalProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      const t = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(t);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setPassword('');
    setError('');
    onClose();
  }, [loading, onClose]);

  const handleDelete = useCallback(async () => {
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onConfirm(password);
      setPassword('');
      onClose();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка при удалении транзакции';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [password, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDelete();
      }
    },
    [handleClose, handleDelete]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-[90%] max-w-[420px] p-5"
        onKeyDown={handleKeyDown}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="delete-modal-title" className="text-lg font-semibold text-gray-900">
            Подтвердите удаление
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Введите пароль администратора для удаления транзакции.
        </p>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="Введите пароль администратора"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          disabled={loading}
          autoComplete="current-password"
          aria-invalid={!!error}
          aria-describedby={error ? 'delete-password-error' : undefined}
        />
        {error && (
          <p id="delete-password-error" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : null}
            {loading ? 'Проверка...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
};
