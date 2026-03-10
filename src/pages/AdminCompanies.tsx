import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Trash2, Ban, CheckCircle, Loader } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase/auth';
import {
  getAllCompanies,
  getCompanyUsersCount,
  updateCompanyStatus,
  type CompanyRow
} from '../lib/firebase/companies';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';

const DELETE_API = '/.netlify/functions/delete-company';

export const AdminCompanies: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<(CompanyRow & { ownerEmail: string; usersCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllCompanies();
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap = new Map<string, string>();
      usersSnap.docs.forEach((d) => {
        const email = d.data().email as string | undefined;
        if (email) usersMap.set(d.id, email);
      });
      const withMeta = await Promise.all(
        list.map(async (c) => ({
          ...c,
          ownerEmail: usersMap.get(c.ownerId) ?? '—',
          usersCount: await getCompanyUsersCount(c.id)
        }))
      );
      setCompanies(withMeta);
    } catch (e) {
      console.error(e);
      showErrorNotification('Не удалось загрузить список компаний');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBlock = async (company: CompanyRow) => {
    if (!window.confirm(`Заблокировать компанию «${company.name}»?`)) return;
    setActioningId(company.id);
    try {
      await updateCompanyStatus(company.id, 'blocked');
      showSuccessNotification('Компания заблокирована');
      await load();
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Ошибка блокировки');
    } finally {
      setActioningId(null);
    }
  };

  const handleUnblock = async (company: CompanyRow) => {
    setActioningId(company.id);
    try {
      await updateCompanyStatus(company.id, 'active');
      showSuccessNotification('Компания разблокирована');
      await load();
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setActioningId(null);
    }
  };

  const handleDeleteClick = (company: CompanyRow) => {
    setCompanyToDelete(company);
  };

  const handleDeleteConfirm = async () => {
    const company = companyToDelete;
    if (!company) return;
    setActioningId(company.id);
    if (import.meta.env.DEV) {
      console.log('[AdminCompanies] delete company:', { companyId: company.id, name: company.name });
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showErrorNotification('Нужно войти в систему');
        setCompanyToDelete(null);
        return;
      }
      const res = await fetch(DELETE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ companyId: company.id })
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; companyId?: string; mode?: string };
      if (!res.ok) {
        const msg = data.error ?? `Ошибка ${res.status}`;
        if (import.meta.env.DEV) console.warn('[AdminCompanies] delete failed:', { status: res.status, data });
        throw new Error(msg);
      }
      if (data.success !== true) {
        throw new Error(data.error ?? 'Не удалось удалить компанию');
      }
      if (import.meta.env.DEV) {
        console.log('[AdminCompanies] delete success:', { companyId: data.companyId, mode: data.mode });
      }
      showSuccessNotification('Компания деактивирована');
      setCompanyToDelete(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось удалить компанию';
      showErrorNotification(msg);
      if (import.meta.env.DEV) console.warn('[AdminCompanies] delete error:', e);
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (v: unknown) => {
    if (!v || typeof (v as { toDate?: () => Date }).toDate !== 'function') return '—';
    return (v as { toDate: () => Date }).toDate().toLocaleDateString('ru-RU');
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          Компании
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Компания</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email владельца</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пользователей</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создана</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.ownerEmail}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.usersCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${c.status === 'blocked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {c.status === 'blocked' ? 'Заблокирована' : 'Активна'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {c.status === 'blocked' ? (
                          <button
                            type="button"
                            onClick={() => handleUnblock(c)}
                            disabled={actioningId === c.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Разблокировать"
                          >
                            {actioningId === c.id ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBlock(c)}
                            disabled={actioningId === c.id}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                            title="Заблокировать"
                          >
                            {actioningId === c.id ? <Loader className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(c)}
                          disabled={actioningId === c.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Удалить компанию"
                        >
                          {actioningId === c.id ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {companies.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">Нет компаний</div>
          )}
        </div>
      )}

      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Удалить компанию?</h3>
            <p className="text-gray-600 text-sm mb-4">
              Компания «{companyToDelete.name}» будет деактивирована и скрыта из активных. Пользователи этой компании не смогут войти.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actioningId === companyToDelete.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {actioningId === companyToDelete.id ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCompanies;
