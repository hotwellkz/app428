import React, { useState } from 'react';
import { XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import { updateExpenseCategory } from '../lib/firebase/expenseCategories';
import { showErrorNotification } from '../utils/notifications';
import type { ExpenseCategory } from '../types/expenseCategory';

interface ExpenseCategoryManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
}

export const ExpenseCategoryManageModal: React.FC<ExpenseCategoryManageModalProps> = ({
  isOpen,
  onClose,
  categories
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleStartEdit = (cat: ExpenseCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSave = async () => {
    if (editingId == null || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    setUpdating(true);
    try {
      await updateExpenseCategory(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      showErrorNotification(err instanceof Error ? err.message : 'Ошибка обновления категории');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg max-h-[90vh] md:max-h-[80vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between shrink-0 border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">Управление категориями</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-gray-500 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-sm text-gray-500 mb-4">
            Нажмите на иконку карандаша, чтобы переименовать категорию.
          </p>
          <ul className="space-y-1">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 min-h-[52px]"
              >
                {editingId === cat.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') handleCancel();
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleSave}
                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updating ? '…' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-gray-900">{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cat)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      aria-label="Редактировать"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
