import React, { useState } from 'react';
import { X } from 'lucide-react';

const CONFIRM_WORD = 'УДАЛИТЬ';

export interface DeleteClientConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

const DeleteClientConfirmModal: React.FC<DeleteClientConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [confirmInput, setConfirmInput] = useState('');

  const canConfirm = confirmInput.trim().toUpperCase() === CONFIRM_WORD;

  const handleConfirm = async () => {
    if (!canConfirm || loading) return;
    await onConfirm();
    setConfirmInput('');
  };

  const handleClose = () => {
    setConfirmInput('');
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-client-modal-title"
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 id="delete-client-modal-title" className="text-lg font-semibold text-gray-900">
            Удалить клиента?
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-gray-700">
            Вы собираетесь полностью удалить клиента и всю связанную информацию.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <p className="font-medium mb-2">Будут удалены:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>вся переписка</li>
              <li>файлы и медиа</li>
              <li>голосовые сообщения</li>
              <li>информация о клиенте</li>
              <li>связанные сделки и заметки (если есть)</li>
            </ul>
            <p className="mt-2 font-medium text-amber-900">Это действие нельзя отменить.</p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Введите слово <strong>{CONFIRM_WORD}</strong> для подтверждения.
            </span>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
              autoComplete="off"
              disabled={loading}
            />
          </label>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Удаление…
              </>
            ) : (
              <>
                <span aria-hidden>🗑</span>
                Удалить клиента
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteClientConfirmModal;
