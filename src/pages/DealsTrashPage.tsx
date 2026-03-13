import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompanyId } from '../contexts/CompanyContext';
import { useTrashedDeals } from '../hooks/useDeals';
import { restoreDeal, permanentDeleteDeal } from '../lib/firebase/deals';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeft, Trash2, RotateCcw } from 'lucide-react';
import type { Deal } from '../types/deals';

function formatDeletedAt(d: Deal['deletedAt']): string {
  if (!d) return '—';
  let ms: number;
  if (typeof (d as { toMillis?: () => number }).toMillis === 'function') {
    ms = (d as { toMillis: () => number }).toMillis();
  } else if (typeof d === 'object' && d !== null && 'seconds' in (d as object)) {
    ms = ((d as { seconds: number }).seconds ?? 0) * 1000;
  } else {
    ms = new Date(d as string).getTime();
  }
  return new Date(ms).toLocaleString('ru-RU');
}

const DealsTrashPage: React.FC = () => {
  const companyId = useCompanyId();
  const { deals, loading, error } = useTrashedDeals(companyId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<Deal | null>(null);

  const handleRestore = async (id: string) => {
    setBusyId(id);
    try {
      await restoreDeal(id);
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanent = async () => {
    if (!confirmPermanent) return;
    setBusyId(confirmPermanent.id);
    try {
      await permanentDeleteDeal(confirmPermanent.id);
      setConfirmPermanent(null);
    } finally {
      setBusyId(null);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Компания не привязана.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-none px-4 py-3 border-b bg-white flex items-center gap-3">
        <Link
          to="/deals"
          className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900"
        >
          <ArrowLeft className="w-4 h-4" />
          К воронке
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">Корзина сделок</h1>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600">
            {error}
            {error.includes('index') && (
              <span className="block mt-2 text-gray-600">
                Создайте составной индекс в Firebase Console (deals: companyId + deletedAt) или выполните
                деплой индексов.
              </span>
            )}
          </p>
        )}
        {!loading && !error && deals.length === 0 && (
          <p className="text-sm text-gray-500">Корзина пуста.</p>
        )}
        {!loading && deals.length > 0 && (
          <ul className="space-y-2 max-w-2xl">
            {deals.map((deal) => (
              <li
                key={deal.id}
                className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{deal.title}</p>
                  {deal.clientNameSnapshot && (
                    <p className="text-xs text-gray-600 truncate">{deal.clientNameSnapshot}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Удалено: {formatDeletedAt(deal.deletedAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === deal.id}
                    onClick={() => handleRestore(deal.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Восстановить
                  </button>
                  <button
                    type="button"
                    disabled={busyId === deal.id}
                    onClick={() => setConfirmPermanent(deal)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить навсегда
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmPermanent && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900">Удалить навсегда?</h2>
            <p className="text-sm text-gray-600 mt-2">
              Сделка «{confirmPermanent.title}» будет безвозвратно удалена. Связь с чатом пропадёт только в
              карточке сделки; диалог WhatsApp не удаляется.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPermanent(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busyId === confirmPermanent.id}
                onClick={handlePermanent}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsTrashPage;
