import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompanyId } from '../contexts/CompanyContext';
import { useTrashedDeals } from '../hooks/useDeals';
import { restoreDeal, permanentDeleteDeal } from '../lib/firebase/deals';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  LayoutGrid,
  Trash2 as TrashIcon,
  Phone,
  User
} from 'lucide-react';
import type { Deal } from '../types/deals';

function dealWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'сделок';
  if (m10 === 1) return 'сделка';
  if (m10 >= 2 && m10 <= 4) return 'сделки';
  return 'сделок';
}

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
  const location = useLocation();
  const { deals, loading, error } = useTrashedDeals(companyId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<Deal | null>(null);
  const trashCount = deals.length;

  const handleRestore = async (id: string) => {
    setBusyId(id);
    try {
      await restoreDeal(id, companyId);
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanent = async () => {
    if (!confirmPermanent) return;
    setBusyId(confirmPermanent.id);
    try {
      await permanentDeleteDeal(confirmPermanent.id, companyId);
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

  const isTrash = location.pathname.includes('/trash');

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <header className="flex-none bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <Link
            to="/deals"
            className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            К воронке
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Корзина</h1>
          <nav className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
            <Link
              to="/deals"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !isTrash ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 opacity-80" />
              Воронка
            </Link>
            <Link
              to="/deals/trash"
              title={trashCount > 0 ? `В корзине: ${trashCount} ${dealWord(trashCount)}` : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isTrash
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-red-100'
                  : 'text-slate-600'
              }`}
            >
              <TrashIcon className={`w-4 h-4 ${trashCount > 0 ? 'text-red-500' : 'opacity-70'}`} />
              Корзина
              {trashCount > 0 && (
                <span
                  className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold tabular-nums"
                  title={`В корзине: ${trashCount} ${dealWord(trashCount)}`}
                >
                  {trashCount > 99 ? '99+' : trashCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-start gap-2">
            <span className="font-semibold shrink-0">Срок хранения:</span>
            <span>
              Сделки в корзине хранятся <strong>30 дней</strong> (рекомендуется регулярно восстанавливать или
              окончательно удалять). Автоочистка по расписанию может быть подключена отдельно.
            </span>
          </div>
        </div>
      </header>

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
              <span className="block mt-2 text-slate-600">
                Создайте составной индекс в Firebase Console (deals: companyId + deletedAt) или выполните деплой
                индексов.
              </span>
            )}
          </p>
        )}
        {!loading && !error && deals.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 py-16 text-center text-slate-500 text-sm max-w-lg mx-auto">
            Корзина пуста. Удалённые сделки появятся здесь.
          </div>
        )}
        {!loading && deals.length > 0 && (
          <ul className="grid gap-3 max-w-3xl">
            {deals.map((deal) => (
              <li
                key={deal.id}
                className="relative rounded-xl border border-slate-200/80 bg-slate-100/90 opacity-90 grayscale-[0.15] shadow-sm hover:opacity-100 hover:grayscale-0 transition-all"
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-700 truncate">{deal.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {deal.clientNameSnapshot && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {deal.clientNameSnapshot}
                        </span>
                      )}
                      {deal.clientPhoneSnapshot && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3" />
                          {deal.clientPhoneSnapshot}
                        </span>
                      )}
                      {deal.amount != null && (
                        <span className="font-medium text-slate-600">
                          {deal.amount.toLocaleString('ru-RU')} ₸
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Удалено: {formatDeletedAt(deal.deletedAt)}
                    </p>
                  </div>
                  <div className="flex sm:flex-col items-stretch gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === deal.id}
                      onClick={() => handleRestore(deal.id)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Восстановить
                    </button>
                    <button
                      type="button"
                      disabled={busyId === deal.id}
                      onClick={() => setConfirmPermanent(deal)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить навсегда
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmPermanent && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-slate-900">Удалить навсегда?</h2>
            <p className="text-sm text-slate-600 mt-2">
              Сделка «{confirmPermanent.title}» будет безвозвратно удалена. Связь с чатом пропадёт только в
              карточке сделки; диалог WhatsApp не удаляется.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPermanent(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
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
