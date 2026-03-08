import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ExpenseCategory } from '../../../types/expenseCategory';

const POPULAR_COUNT = 8;
const ROW_MIN_HEIGHT = 48;

interface ExpenseCategoryMobilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  selectedId: string;
  onSelect: (categoryId: string) => void;
  onCreateNew: () => void;
  onManage: () => void;
}

export const ExpenseCategoryMobilePicker: React.FC<ExpenseCategoryMobilePickerProps> = ({
  isOpen,
  onClose,
  categories,
  selectedId,
  onSelect,
  onCreateNew,
  onManage
}) => {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchLower = search.trim().toLowerCase();
  const filtered =
    searchLower === ''
      ? categories
      : categories.filter((c) => c.name.toLowerCase().includes(searchLower));

  const popular = categories.slice(0, POPULAR_COUNT);
  const popularFiltered =
    searchLower === ''
      ? popular
      : popular.filter((c) => c.name.toLowerCase().includes(searchLower));
  const allFiltered = searchLower === '' ? filtered : filtered;
  const showPopular = popularFiltered.length > 0;
  const popularIds = new Set(popularFiltered.map((c) => c.id));
  const restFiltered = showPopular ? allFiltered.filter((c) => !popularIds.has(c.id)) : allFiltered;

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="fixed top-0 left-0 right-0 z-10 flex flex-col bg-white h-[100dvh] shadow-xl">
        <div className="sticky top-0 bg-white z-10 shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Выберите категорию</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -m-2 text-gray-500 hover:text-gray-700"
              aria-label="Закрыть"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="sticky top-0 bg-white z-10 shrink-0 px-4 pt-3 pb-2 border-b border-gray-100">
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск категории"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
          {showPopular && (
            <section className="pt-2 pb-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                Популярные категории
              </h4>
              <ul className="space-y-0.5">
                {popularFiltered.map((cat) => (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(cat.id)}
                      className="w-full text-left rounded-xl px-4 py-3 text-gray-900 hover:bg-gray-100 active:bg-gray-200 flex items-center min-h-[48px]"
                      style={{ minHeight: ROW_MIN_HEIGHT }}
                    >
                      {cat.name}
                      {selectedId === cat.id && (
                        <span className="ml-2 text-blue-600 text-sm">✓</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="pt-2 pb-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
              {showPopular ? 'Все категории' : 'Категории'}
            </h4>
            <ul className="space-y-0.5">
              {restFiltered.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className="w-full text-left rounded-xl px-4 py-3 text-gray-900 hover:bg-gray-100 active:bg-gray-200 flex items-center min-h-[48px]"
                    style={{ minHeight: ROW_MIN_HEIGHT }}
                  >
                    {cat.name}
                    {selectedId === cat.id && (
                      <span className="ml-2 text-blue-600 text-sm">✓</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {filtered.length === 0 && (
              <p className="py-4 text-center text-gray-500 text-sm">Ничего не найдено</p>
            )}
          </section>

          <div className="space-y-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="w-full rounded-xl px-4 py-3 text-left text-blue-600 font-medium hover:bg-blue-50 active:bg-blue-100 min-h-[48px]"
            >
              + Создать новую категорию
            </button>
            <button
              type="button"
              onClick={() => {
                onManage();
                onClose();
              }}
              className="w-full rounded-xl px-4 py-3 text-left text-gray-700 font-medium hover:bg-gray-100 active:bg-gray-200 min-h-[48px]"
            >
              Управление категориями
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
