import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EditLogChange {
  field: string;
  before: unknown;
  after: unknown;
}

interface EditLogEntry {
  id: string;
  transactionId: string;
  editedAt: { seconds: number };
  editedBy: string;
  before: { from: string; to: string; amount: number; comment: string; category: string | null; isSalary?: boolean; isCashless?: boolean; needsReview?: boolean };
  after: { from: string; to: string; amount: number; comment: string; category: string | null; isSalary?: boolean; isCashless?: boolean; needsReview?: boolean };
  changes?: EditLogChange[];
}

const FIELD_LABELS: Record<string, string> = {
  amount: 'Сумма',
  comment: 'Описание',
  description: 'Описание',
  from: 'Откуда',
  to: 'Куда',
  category: 'Категория',
  isSalary: 'ЗП',
  isCashless: 'Безнал',
  needsReview: 'На проверку',
  object: 'Объект',
  project: 'Проект',
  employee: 'Сотрудник',
  tags: 'Теги',
  attachment: 'Вложение',
  date: 'Дата',
  status: 'Статус'
};

function formatChangeValue(field: string, value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (field === 'isSalary' || field === 'isCashless' || field === 'needsReview') {
    return value === true ? 'Да' : 'Нет';
  }
  if (field === 'amount' && typeof value === 'number') {
    return `${Math.abs(value).toLocaleString('ru-RU')} ₸`;
  }
  return String(value).trim() || '—';
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
            const before = data.before ?? { from: '', to: '', amount: 0, comment: '', category: null };
            const after = data.after ?? { from: '', to: '', amount: 0, comment: '', category: null };
            return {
              id: d.id,
              transactionId: data.transactionId,
              editedAt: editedAt?.seconds != null ? { seconds: editedAt.seconds } : { seconds: 0 },
              editedBy: data.editedBy ?? '',
              before,
              after,
              changes: Array.isArray(data.changes) ? (data.changes as EditLogChange[]) : undefined
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
          logs.map((entry) => {
            const hasChangesList = entry.changes && entry.changes.length > 0;
            const changeCount = hasChangesList ? entry.changes!.length : 0;
            return (
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
                {entry.editedBy && (
                  <p className="text-xs text-gray-500 mb-3">Кто изменил: {entry.editedBy}</p>
                )}
                {hasChangesList ? (
                  <div className="text-sm space-y-2">
                    <span className="text-gray-500 font-medium">
                      {changeCount === 1 ? 'Изменение:' : 'Изменения:'}
                    </span>
                    <ul className="space-y-1.5 list-none pl-0">
                      {entry.changes!.map((ch, i) => {
                        const label = FIELD_LABELS[ch.field] ?? ch.field;
                        const beforeStr = formatChangeValue(ch.field, ch.before);
                        const afterStr = formatChangeValue(ch.field, ch.after);
                        const isBoolean = ['isSalary', 'isCashless', 'needsReview'].includes(ch.field);
                        return (
                          <li key={i} className="flex flex-wrap items-baseline gap-1">
                            {isBoolean && (
                              <span className="text-gray-600" title="Чекбокс">☑ </span>
                            )}
                            <span className="text-gray-600">{label}:</span>
                            <span className="text-gray-500">{beforeStr}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-emerald-600 font-medium">{afterStr}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
