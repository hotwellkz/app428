import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EditLogEntry {
  id: string;
  transactionId: string;
  editedAt: { seconds: number };
  editedBy: string;
  before: { from: string; to: string; amount: number; comment: string; category: string | null };
  after: { from: string; to: string; amount: number; comment: string; category: string | null };
}

/**
 * Страница журнала изменений одной транзакции (audit log).
 * Маршрут: /transaction-history/:id
 */
export const TransactionEditHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<EditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'transaction_edit_logs'),
      where('transactionId', '==', id)
    );
    getDocs(q)
      .then((snap) => {
        const entries: EditLogEntry[] = snap.docs
          .map((d) => {
            const data = d.data();
            const editedAt = data.editedAt as Timestamp;
            return {
              id: d.id,
              transactionId: data.transactionId,
              editedAt: editedAt?.seconds != null ? { seconds: editedAt.seconds } : { seconds: 0 },
              editedBy: data.editedBy ?? '',
              before: data.before ?? { from: '', to: '', amount: 0, comment: '', category: null },
              after: data.after ?? { from: '', to: '', amount: 0, comment: '', category: null }
            };
          })
          .sort((a, b) => b.editedAt.seconds - a.editedAt.seconds);
        setLogs(entries);
      })
      .catch((err) => {
        console.error('Error loading transaction edit log:', err);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const formatTime = (seconds: number) =>
    format(new Date(seconds * 1000), 'HH:mm', { locale: ru });
  const formatDate = (seconds: number) =>
    format(new Date(seconds * 1000), 'd MMM yyyy', { locale: ru });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 md:static">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">История изменений</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <p className="text-sm text-gray-500">Загрузка...</p>
        )}
        {!loading && logs.length === 0 && (
          <p className="text-sm text-gray-500">Нет записей об изменениях этой транзакции.</p>
        )}
        {!loading &&
          logs.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">Редактирование</span>
                <span className="text-xs text-gray-500">
                  {formatDate(entry.editedAt.seconds)} {formatTime(entry.editedAt.seconds)}
                </span>
              </div>
              <div className="text-xs text-gray-600 space-y-2">
                <div>
                  <span className="text-gray-400">Было:</span>{' '}
                  {entry.before.from} → {entry.before.to},{' '}
                  {Math.abs(entry.before.amount).toLocaleString('ru-RU')} ₸
                </div>
                <div>
                  <span className="text-gray-400">Стало:</span>{' '}
                  {entry.after.from} → {entry.after.to},{' '}
                  {Math.abs(entry.after.amount).toLocaleString('ru-RU')} ₸
                </div>
                {entry.before.comment !== entry.after.comment && (
                  <div>
                    <span className="text-gray-400">Комментарий:</span>{' '}
                    {entry.after.comment || '—'}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
