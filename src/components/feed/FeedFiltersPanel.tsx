import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { CategoryCardType } from '../../types';

type FilterType = 'all' | 'income' | 'expense' | 'transfer' | 'correction';

interface ExpenseCategory {
  id: string;
  name: string;
  color?: string;
}

interface FeedFiltersPanelProps {
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: Date | null; end: Date | null }>>;
  filterType: FilterType;
  setFilterType: (t: FilterType) => void;
  filterUser: string;
  setFilterUser: (u: string) => void;
  filterCategoryId: string;
  setFilterCategoryId: (id: string) => void;
  filterExpenseCategoryId: string;
  setFilterExpenseCategoryId: (id: string) => void;
  minAmount: string;
  setMinAmount: (v: string) => void;
  maxAmount: string;
  setMaxAmount: (v: string) => void;
  filterNeedsReview: boolean;
  setFilterNeedsReview: (v: boolean) => void;
  filterCorrection: boolean;
  setFilterCorrection: (v: boolean) => void;
  filterApproved: boolean;
  setFilterApproved: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  visibleCategories: CategoryCardType[];
  expenseCategories: ExpenseCategory[];
  uniqueUserNames: string[];
  onReset: () => void;
  onApply?: () => void;
  compact?: boolean;
  /** Для мобильной панели: текущий пользователь (для чипа «Мои операции») */
  currentUser?: { displayName?: string | null; email?: string | null } | null;
}

const PERIOD_PRESETS: { label: string; getRange: () => { start: Date; end: Date } }[] = [
  { label: 'Сегодня', getRange: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return { start: d, end: new Date() }; } },
  { label: 'Вчера', getRange: () => { const end = new Date(); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999); const start = new Date(end); start.setHours(0, 0, 0, 0); return { start, end }; } },
  { label: '7 дней', getRange: () => { const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); return { start, end }; } },
  { label: '30 дней', getRange: () => { const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); return { start, end }; } },
  {
    label: 'Этот месяц',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date();
      return { start, end };
    }
  },
  {
    label: 'Прошлый месяц',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }
  }
];

const TYPE_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'income', label: 'Доход' },
  { value: 'expense', label: 'Расход' },
  { value: 'transfer', label: 'Перевод' },
  { value: 'correction', label: 'Исправление' }
];

export const FeedFiltersPanel: React.FC<FeedFiltersPanelProps> = ({
  dateRange,
  setDateRange,
  filterType,
  setFilterType,
  filterUser,
  setFilterUser,
  filterCategoryId,
  setFilterCategoryId,
  filterExpenseCategoryId,
  setFilterExpenseCategoryId,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  filterNeedsReview,
  setFilterNeedsReview,
  filterCorrection,
  setFilterCorrection,
  filterApproved,
  setFilterApproved,
  searchQuery,
  setSearchQuery,
  visibleCategories,
  expenseCategories,
  uniqueUserNames,
  onReset,
  onApply,
  compact = false,
  currentUser = null
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const isTodaySelected =
    !!dateRange.start &&
    !!dateRange.end &&
    new Date(dateRange.start).toDateString() === new Date().toDateString() &&
    new Date(dateRange.end).toDateString() === new Date().toDateString();
  const myName = (currentUser?.displayName || currentUser?.email || '').trim();
  const isMyOpsSelected = !!myName && filterUser === myName;

  const filteredUserNames = userSearch.trim()
    ? uniqueUserNames.filter((n) => n.toLowerCase().includes(userSearch.toLowerCase()))
    : uniqueUserNames;

  const periodLabel =
    dateRange.start && dateRange.end
      ? `${dateRange.start.toLocaleDateString('ru-RU')} — ${dateRange.end.toLocaleDateString('ru-RU')}`
      : 'Произвольный период';

  return (
    <div className={`space-y-4 ${compact ? 'space-y-3' : ''}`}>
      {/* На мобильных — быстрые фильтры (чипы) вместо блока под заголовком */}
      {compact && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Тип ленты</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setDateRange({ start: d, end: new Date() });
              }}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                isTodaySelected
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => myName && setFilterUser(myName)}
              disabled={!myName}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isMyOpsSelected
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              Мои операции
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expense')}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                filterType === 'expense'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              Расходы
            </button>
            <button
              type="button"
              onClick={() => setFilterType('income')}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                filterType === 'income'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              Доходы
            </button>
            <button
              type="button"
              onClick={() => setFilterNeedsReview(true)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                filterNeedsReview
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              Требует уточнения
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Период</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDateRange(preset.getRange())}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 flex items-center justify-between text-sm text-gray-700"
          >
            <span className="truncate">{periodLabel}</span>
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
          </button>
        </div>
        {showCalendar && (
          <div className="mt-2 p-3 bg-white border rounded-lg shadow-lg grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Начало</label>
              <input
                type="date"
                value={dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }))
                }
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Конец</label>
              <input
                type="date"
                value={dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }))
                }
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Тип операции</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Пользователь</label>
        <input
          type="text"
          placeholder="Поиск по имени..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-1 focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">Все</option>
          {filteredUserNames.slice(0, 50).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Объект / проект</label>
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">Все</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Категория расхода</label>
        <select
          value={filterExpenseCategoryId}
          onChange={(e) => setFilterExpenseCategoryId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">Все</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₸)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="От"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number"
            placeholder="До"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterNeedsReview}
              onChange={(e) => setFilterNeedsReview(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Требует уточнения</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterCorrection}
              onChange={(e) => setFilterCorrection(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Исправление</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterApproved}
              onChange={(e) => setFilterApproved(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Подтверждено</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
        <input
          type="text"
          placeholder="Комментарий, объект, пользователь..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Сбросить
        </button>
        {onApply && (
          <button
            type="button"
            onClick={onApply}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600"
          >
            Применить
          </button>
        )}
      </div>
    </div>
  );
};
