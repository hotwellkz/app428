import React from 'react';
import clsx from 'clsx';

interface TransactionStatsProps {
  totalAmount: number;
  salaryTotal: number;
  cashlessTotal: number;
  className?: string;
}

const formatAmount = (amount: number) => {
  return Math.round(amount).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
};

export const TransactionStats: React.FC<TransactionStatsProps> = ({
  totalAmount,
  salaryTotal,
  cashlessTotal,
  className
}) => {
  const totalStr = `${formatAmount(Math.abs(totalAmount))} ₸`;
  const salaryStr = `${formatAmount(Math.abs(salaryTotal))} ₸`;
  const cashlessStr = `${formatAmount(Math.abs(cashlessTotal))} ₸`;

  return (
    <div
      className={clsx(
        'bg-white border-b border-gray-100',
        className
      )}
    >
      <div
        className={clsx(
          'flex flex-row flex-nowrap items-center gap-2 sm:gap-3',
          'overflow-x-auto overflow-y-hidden',
          'py-2 px-2 sm:py-2.5 sm:px-3',
          'min-h-[36px]',
          'text-[12px] sm:text-sm'
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-md bg-gray-50/90 px-2.5 py-1 sm:px-3 sm:py-1.5">
          <span className="font-medium text-gray-600 sm:hidden" aria-hidden>
            Общ:
          </span>
          <span className="hidden font-medium text-gray-600 sm:inline">Общая:</span>
          <span className="font-semibold tabular-nums text-red-600">{totalStr}</span>
        </span>

        <span
          className="shrink-0 select-none text-gray-300 sm:text-gray-400"
          aria-hidden
        >
          |
        </span>

        <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-md bg-gray-50/90 px-2.5 py-1 sm:px-3 sm:py-1.5">
          <span className="font-medium text-gray-600">ЗП:</span>
          <span className="font-semibold tabular-nums text-emerald-600">{salaryStr}</span>
        </span>

        <span className="shrink-0 select-none text-gray-300 sm:text-gray-400" aria-hidden>
          |
        </span>

        <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap rounded-md bg-gray-50/90 px-2.5 py-1 sm:px-3 sm:py-1.5">
          <span className="font-medium text-gray-600 sm:hidden" aria-hidden>
            Б/Н:
          </span>
          <span className="hidden font-medium text-gray-600 sm:inline">Безнал:</span>
          <span className="font-semibold tabular-nums text-purple-600">{cashlessStr}</span>
        </span>
      </div>
    </div>
  );
};
