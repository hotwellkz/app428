import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Bot, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { subscribeCrmAiBots, updateCrmAiBot } from '../lib/firebase/crmAiBots';
import { PageMetadata } from '../components/PageMetadata';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { CrmAiBot, CrmAiBotStatus } from '../types/crmAiBot';
import {
  labelCrmAiBotChannel,
  labelCrmAiBotStatus,
  labelCrmAiBotType
} from '../types/crmAiBot';
import toast from 'react-hot-toast';

type FilterTab = 'all' | CrmAiBotStatus;

function formatUpdatedAt(t: CrmAiBot['updatedAt']): string {
  if (!t) return '—';
  try {
    const d =
      typeof (t as Timestamp).toDate === 'function'
        ? (t as Timestamp).toDate()
        : t instanceof Date
          ? t
          : new Date();
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'dd.MM.yyyy HH:mm');
  } catch {
    return '—';
  }
}

function statusBadgeClass(status: CrmAiBotStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 ring-gray-200';
    case 'active':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'paused':
      return 'bg-amber-50 text-amber-900 ring-amber-200';
    case 'archived':
      return 'bg-violet-50 text-violet-800 ring-violet-200';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
}

export const AutovoronkiListPage: React.FC = () => {
  const companyId = useCompanyId();
  const { canAccess } = useCurrentCompanyUser();
  const canUse = canAccess('autovoronki');
  const navigate = useNavigate();
  const [bots, setBots] = useState<CrmAiBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !canUse) {
      setBots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeCrmAiBots(companyId, (list) => {
      setBots(list);
      setLoading(false);
    });
    return () => unsub();
  }, [companyId, canUse]);

  const filtered = useMemo(() => {
    if (filter === 'all') return bots;
    return bots.filter((b) => b.status === filter);
  }, [bots, filter]);

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'active', label: 'Активные' },
    { id: 'draft', label: 'Черновики' },
    { id: 'paused', label: 'На паузе' },
    { id: 'archived', label: 'Архив' }
  ];

  const archiveBot = async (b: CrmAiBot) => {
    try {
      await updateCrmAiBot(b.id, {
        name: b.name,
        description: b.description,
        botType: b.botType,
        channel: b.channel,
        status: 'archived'
      });
      toast.success('Бот перенесён в архив');
    } catch {
      toast.error('Не удалось обновить статус');
    }
    setMenuOpenId(null);
  };

  if (!canUse) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PageMetadata title="Автоворонки" description="AI-боты для продаж" />
        <p className="text-gray-600 text-sm">У вас нет доступа к этому разделу.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <PageMetadata
        title="Автоворонки"
        description="Создавайте AI-ботов для продаж, квалификации и повторного касания клиентов"
      />
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Автоворонки</h1>
            <p className="mt-1.5 text-sm md:text-base text-gray-500 max-w-xl">
              Создавайте AI-ботов для продаж, квалификации и повторного касания клиентов
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/voice-campaigns"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white text-gray-800 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm shrink-0"
            >
              Voice кампании
            </Link>
            <Link
              to="/autovoronki/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-5 h-5" />
              Создать бота
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 md:p-14 text-center shadow-sm">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Пока нет созданных автоворонок</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Создайте первого AI-бота для работы с клиентами. На следующих этапах здесь появятся сценарии,
              правила и аналитика.
            </p>
            <button
              type="button"
              onClick={() => navigate('/autovoronki/new')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Создать бота
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((b) => (
              <li key={b.id}>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">{b.name}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(b.status)}`}
                        >
                          {labelCrmAiBotStatus(b.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {labelCrmAiBotType(b.botType)} · {labelCrmAiBotChannel(b.channel)}
                      </p>
                      {b.description ? (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{b.description}</p>
                      ) : null}
                      <p className="text-xs text-gray-400">Обновлено: {formatUpdatedAt(b.updatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpenId((id) => (id === b.id ? null : b.id))}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                          aria-label="Действия"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {menuOpenId === b.id && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-10 cursor-default"
                              aria-label="Закрыть меню"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                              {b.status !== 'archived' && (
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  onClick={() => archiveBot(b)}
                                >
                                  В архив
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <Link
                        to={`/autovoronki/${b.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        Открыть
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
