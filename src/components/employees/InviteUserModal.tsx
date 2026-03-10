import React, { useState } from 'react';
import { X, UserPlus, Copy, Check } from 'lucide-react';
import { createInvite } from '../../lib/firebase/invites';
import type { CompanyUserRole } from '../../types/company';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  invitedBy: string;
}

const ROLE_LABELS: Record<CompanyUserRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
  member: 'Сотрудник'
};

const ROLES: CompanyUserRole[] = ['admin', 'manager', 'member'];

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  companyId,
  invitedBy
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyUserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Введите email');
      return;
    }
    setLoading(true);
    try {
      const { link } = await createInvite({
        companyId,
        email: trimmed,
        role,
        invitedBy
      });
      setInviteLink(link);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать приглашение');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать');
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    setError(null);
    setEmail('');
    setRole('member');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Пригласить пользователя
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {!inviteLink ? (
            <>
              <div>
                <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email приглашаемого
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
                  Роль
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as CompanyUserRole)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? 'Создание…' : 'Создать приглашение'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Отмена
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Отправьте эту ссылку приглашённому. Ссылка действительна 7 дней.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 border border-gray-200 bg-gray-50 text-gray-600 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="py-2 px-3 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setInviteLink(null); }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Пригласить ещё
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2 px-4 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
                >
                  Готово
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
