import React from 'react';
import { X } from 'lucide-react';

type FilterType = 'all' | 'income' | 'expense' | 'transfer' | 'correction';

const TYPE_LABELS: Record<FilterType, string> = {
  all: 'Все',
  income: 'Доход',
  expense: 'Расход',
  transfer: 'Перевод',
  correction: 'Исправление'
};

interface Chip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface FeedFilterChipsProps {
  dateRange: { start: Date | null; end: Date | null };
  filterType: FilterType;
  filterUser: string;
  filterCategoryId: string;
  filterExpenseCategoryId: string;
  minAmount: string;
  maxAmount: string;
  filterNeedsReview: boolean;
  filterCorrection: boolean;
  filterApproved: boolean;
  searchQuery: string;
  categoryTitleById: (id: string) => string | undefined;
  expenseCategoryNameById: (id: string) => string | undefined;
  onClearDate: () => void;
  onClearType: () => void;
  onClearUser: () => void;
  onClearCategory: () => void;
  onClearExpenseCategory: () => void;
  onClearAmount: () => void;
  onClearNeedsReview: () => void;
  onClearCorrection: () => void;
  onClearApproved: () => void;
  onClearSearch: () => void;
}

export const FeedFilterChips: React.FC<FeedFilterChipsProps> = ({
  dateRange,
  filterType,
  filterUser,
  filterCategoryId,
  filterExpenseCategoryId,
  minAmount,
  maxAmount,
  filterNeedsReview,
  filterCorrection,
  filterApproved,
  searchQuery,
  categoryTitleById,
  expenseCategoryNameById,
  onClearDate,
  onClearType,
  onClearUser,
  onClearCategory,
  onClearExpenseCategory,
  onClearAmount,
  onClearNeedsReview,
  onClearCorrection,
  onClearApproved,
  onClearSearch
}) => {
  const chips: Chip[] = [];

  if (dateRange.start && dateRange.end) {
    const label =
      dateRange.start.toDateString() === dateRange.end.toDateString()
        ? dateRange.start.toLocaleDateString('ru-RU')
        : `${dateRange.start.toLocaleDateString('ru-RU')} — ${dateRange.end.toLocaleDateString('ru-RU')}`;
    chips.push({ id: 'date', label, onRemove: onClearDate });
  }

  if (filterType !== 'all') {
    chips.push({ id: 'type', label: TYPE_LABELS[filterType], onRemove: onClearType });
  }

  if (filterUser.trim()) {
    chips.push({ id: 'user', label: filterUser, onRemove: onClearUser });
  }

  if (filterCategoryId) {
    const title = categoryTitleById(filterCategoryId) || filterCategoryId;
    chips.push({ id: 'category', label: title, onRemove: onClearCategory });
  }

  if (filterExpenseCategoryId) {
    const name = expenseCategoryNameById(filterExpenseCategoryId) || filterExpenseCategoryId;
    chips.push({ id: 'expenseCat', label: name, onRemove: onClearExpenseCategory });
  }

  if (minAmount || maxAmount) {
    const label = [minAmount, maxAmount].filter(Boolean).join(' — ') + ' ₸';
    chips.push({ id: 'amount', label, onRemove: onClearAmount });
  }

  if (filterNeedsReview) {
    chips.push({ id: 'needsReview', label: 'Требует уточнения', onRemove: onClearNeedsReview });
  }
  if (filterCorrection) {
    chips.push({ id: 'correction', label: 'Исправление', onRemove: onClearCorrection });
  }
  if (filterApproved) {
    chips.push({ id: 'approved', label: 'Подтверждено', onRemove: onClearApproved });
  }

  if (searchQuery.trim()) {
    chips.push({ id: 'search', label: `«${searchQuery.slice(0, 20)}${searchQuery.length > 20 ? '…' : ''}»`, onRemove: onClearSearch });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm bg-emerald-50 text-emerald-800 border border-emerald-200"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="p-0.5 rounded-full hover:bg-emerald-200/60"
            aria-label={`Убрать фильтр ${chip.label}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
};
