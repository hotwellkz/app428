import React, { useState, useEffect } from 'react';
import { Shield, Loader } from 'lucide-react';
import {
  MENU_SECTIONS,
  DEFAULT_MENU_ACCESS,
  defaultMenuAccessForRole,
  type MenuAccess,
  type MenuSectionId
} from '../../types/menuAccess';
import { getCompanyUser, updateCompanyUserMenuAccess, updateCompanyUserPermissions } from '../../lib/firebase/companies';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface MenuAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSaved?: () => void;
}

export const MenuAccessModal: React.FC<MenuAccessModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onSaved
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState<MenuAccess>({ ...DEFAULT_MENU_ACCESS });
  const [approveTransactions, setApproveTransactions] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    getCompanyUser(userId)
      .then((cu) => {
        const base = defaultMenuAccessForRole(cu?.role ?? 'member');
        if (cu?.menuAccess) setAccess({ ...base, ...cu.menuAccess });
        else setAccess(base);
        setApproveTransactions(cu?.permissions?.approveTransactions === true);
      })
      .catch(() => {
        setAccess({ ...DEFAULT_MENU_ACCESS });
        setApproveTransactions(false);
      })
      .finally(() => setLoading(false));
  }, [isOpen, userId]);

  const handleToggle = (sectionId: MenuSectionId) => {
    setAccess((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSelectAll = () => {
    setAccess(
      MENU_SECTIONS.reduce<MenuAccess>(
        (acc, s) => ({ ...acc, [s.id]: true }),
        { ...DEFAULT_MENU_ACCESS }
      )
    );
  };

  const handleDeselectAll = () => {
    setAccess(
      MENU_SECTIONS.reduce<MenuAccess>(
        (acc, s) => ({ ...acc, [s.id]: false }),
        { ...DEFAULT_MENU_ACCESS }
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompanyUserMenuAccess(userId, access);
      await updateCompanyUserPermissions(userId, { approveTransactions });
      showSuccessNotification('Права доступа сохранены');
      onSaved?.();
      onClose();
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Не удалось сохранить права');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-gray-200">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Права доступа — {userName || 'Пользователь'}
          </h2>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-emerald-600 hover:underline"
                >
                  Выбрать всё
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-sm text-gray-600 hover:underline"
                >
                  Снять всё
                </button>
              </div>
              <ul className="space-y-2">
                {MENU_SECTIONS.map((section) => (
                  <li key={section.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`menu-${section.id}`}
                      checked={access[section.id]}
                      onChange={() => handleToggle(section.id)}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor={`menu-${section.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                      {section.label}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Дополнительные права</p>
                <li className="flex items-center gap-3 list-none">
                  <input
                    type="checkbox"
                    id="permission-approve-transactions"
                    checked={approveTransactions}
                    onChange={() => setApproveTransactions((v) => !v)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="permission-approve-transactions" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Одобрение транзакций
                  </label>
                </li>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3 justify-end p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
