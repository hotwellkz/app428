import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plug, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PageMetadata } from '../components/PageMetadata';
import { CATEGORY_LABELS, type IntegrationCategoryId } from '../modules/integrations/types';
import { useIntegrationsCatalogSummary } from '../modules/integrations/hooks/useIntegrationsCatalogSummary';
import { IntegrationCard, IntegrationCardSkeleton } from '../modules/integrations/components/IntegrationCard';

const CATEGORY_ORDER: IntegrationCategoryId[] = [
  'messengers',
  'ai',
  'telephony',
  'marketplaces',
  'payments',
  'other'
];

export const IntegrationsCatalogPage: React.FC = () => {
  const { user } = useAuth();
  const { cards, loading } = useIntegrationsCatalogSummary(user?.uid);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<IntegrationCategoryId | 'all'>('all');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (cat !== 'all' && c.category !== cat) return false;
      if (!t) return true;
      return (
        c.title.toLowerCase().includes(t) ||
        c.shortDescription.toLowerCase().includes(t) ||
        c.categoryLabel.toLowerCase().includes(t)
      );
    });
  }, [cards, q, cat]);

  if (!user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PageMetadata title="Интеграции" description="Каталог подключений CRM" />
        <p className="text-gray-500">Войдите в аккаунт, чтобы настроить интеграции.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full min-h-[50vh]">
      <PageMetadata title="Интеграции" description="Каталог подключений и сервисов" />

      <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500 mb-4">
        <Link to="/settings/knowledge" className="hover:text-violet-600">
          Настройки
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
        <span className="text-gray-800 font-medium">Интеграции</span>
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700 border border-violet-200/80">
            <Plug className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Интеграции</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
              Подключайте мессенджеры, AI, телефонию и магазины. Выберите карточку, чтобы открыть настройки.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm focus:ring-2 focus:ring-violet-500/25 focus:border-violet-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCat('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
              cat === 'all'
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
            }`}
          >
            Все
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                cat === c
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <IntegrationCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-16 text-center text-gray-600">
          <p className="font-medium text-gray-800">Ничего не найдено</p>
          <p className="text-sm mt-1">Измените запрос или сбросьте фильтр категории.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <IntegrationCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
};
