import React from 'react';
import type { AiControlAggregatedStatus } from '../../types/aiControl';

const LABELS: Record<AiControlAggregatedStatus, string> = {
  success: 'Успех',
  partial: 'Частично',
  warning: 'Внимание',
  error: 'Ошибка',
  skipped: 'Пропуск',
  duplicate: 'Дубль',
  paused: 'Пауза',
  off: 'Выкл.'
};

const STYLES: Record<AiControlAggregatedStatus, string> = {
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  partial: 'bg-sky-50 text-sky-900 ring-sky-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  error: 'bg-red-50 text-red-800 ring-red-200',
  skipped: 'bg-gray-100 text-gray-700 ring-gray-200',
  duplicate: 'bg-violet-50 text-violet-900 ring-violet-200',
  paused: 'bg-orange-50 text-orange-900 ring-orange-200',
  off: 'bg-slate-100 text-slate-600 ring-slate-200'
};

export const AiRunStatusBadge: React.FC<{ status: AiControlAggregatedStatus; className?: string }> = ({
  status,
  className = ''
}) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset ${STYLES[status]} ${className}`}
  >
    {LABELS[status]}
  </span>
);
