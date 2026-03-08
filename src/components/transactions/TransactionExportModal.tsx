import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface TransactionExportFilters {
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  /** Текущая сущность (categoryId или "general" для Общий расход) — экспорт только по ней */
  entityId?: string;
}

export type PeriodType = 'all' | 'month' | 'year' | 'prevMonth' | 'custom';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPresetDates(type: PeriodType): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (type) {
    case 'month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
      };
    case 'year':
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: now,
      };
    case 'prevMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    default:
      return { from: null, to: null };
  }
}

interface TransactionExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (filters: TransactionExportFilters) => void;
  defaultDateFrom?: string;
  defaultDateTo?: string;
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'all', label: 'Всё время' },
  { value: 'month', label: 'Текущий месяц' },
  { value: 'year', label: 'Текущий год' },
  { value: 'prevMonth', label: 'Прошлый месяц' },
  { value: 'custom', label: 'Свой период' },
];

export const TransactionExportModal: React.FC<TransactionExportModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultDateFrom = '',
  defaultDateTo = '',
}) => {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPeriodType('month');
      setDateFrom(defaultDateFrom || null);
      setDateTo(defaultDateTo || null);
      setError('');
    }
  }, [isOpen, defaultDateFrom, defaultDateTo]);

  if (!isOpen) return null;

  const isCustom = periodType === 'custom';
  const isDateFieldsDisabled = !isCustom;

  const handleConfirm = () => {
    let finalFrom: string | undefined;
    let finalTo: string | undefined;

    if (periodType === 'custom') {
      if (dateFrom && dateTo && dateFrom > dateTo) {
        setError('Дата начала не может быть позже даты окончания');
        return;
      }
      finalFrom = dateFrom || undefined;
      finalTo = dateTo || undefined;
    } else {
      const preset = getPresetDates(periodType);
      finalFrom = preset.from ? toDateString(preset.from) : undefined;
      finalTo = preset.to ? toDateString(preset.to) : undefined;
    }

    onConfirm({
      dateFrom: finalFrom,
      dateTo: finalTo,
      startDate: finalFrom,
      endDate: finalTo,
    });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Экспорт отчёта в Excel</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Период</span>
              <div className="space-y-2" role="radiogroup" aria-label="Выбор периода">
                {PERIOD_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5 -mx-2"
                  >
                    <input
                      type="radio"
                      name="periodType"
                      value={opt.value}
                      checked={periodType === opt.value}
                      onChange={() => {
                        setPeriodType(opt.value);
                        setError('');
                      }}
                      className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">С какой даты</label>
                <input
                  type="date"
                  value={dateFrom ?? ''}
                  onChange={(e) => {
                    setDateFrom(e.target.value || null);
                    setError('');
                  }}
                  disabled={isDateFieldsDisabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    isDateFieldsDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">По какую дату</label>
                <input
                  type="date"
                  value={dateTo ?? ''}
                  onChange={(e) => {
                    setDateTo(e.target.value || null);
                    setError('');
                  }}
                  disabled={isDateFieldsDisabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    isDateFieldsDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                  }`}
                />
                {isCustom && !dateTo && (
                  <p className="mt-1 text-xs text-gray-500">Если не указано, будет использована сегодняшняя дата</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Скачать
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
