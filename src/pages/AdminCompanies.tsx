import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Trash2, Ban, CheckCircle, Loader } from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

  const handleDelete = async (company: CompanyRow) => {
    if (!window.confirm(`Удалить компанию «${company.name}» и все её данные (клиенты, транзакции, сообщения, файлы)? Это нельзя отменить.`)) return;
    setActioningId(company.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showErrorNotification('Нужно войти в систему');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Ошибка ${res.status}`);
      }
      showSuccessNotification('Компания удалена');
      await load();
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Ошибка удаления');
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
                          onClick={() => handleDelete(c)}
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
    </div>
  );
};

export default AdminCompanies;
