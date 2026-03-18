import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, FileText, Pencil, Receipt } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { formatTime } from '../../utils/dateUtils';
import { getDotHex } from '../../utils/expenseCategoryColors';
import { Transaction } from './types';

/** Транзакция с полями для Feed/History (editType, correctedFrom, reversedAt и т.д.) */
export type TransactionCardTransaction = Transaction & {
  editType?: 'reversal' | 'correction';
  correctedFrom?: string;
  reversalOf?: string;
  reversedAt?: unknown;
};

export type TransactionCardContext = 'feed' | 'history';

export interface TransactionCardProps {
  transaction: TransactionCardTransaction;
  context: TransactionCardContext;
  /** ID категории счёта "Откуда" — для перехода в историю (опционально) */
  fromCategoryId?: string;
  /** ID категории счёта "Куда" — для перехода в историю (опционально) */
  objectCategoryId?: string;
  /** Цвет индикатора категории расхода */
  categoryColor?: string;
  /** Название категории расхода для тултипа */
  categoryName?: string;
  /** Доступно одобрение (только context=feed) */
  isTrustedForApproval?: boolean;
  /** Режим редактирования включён (только context=feed) */
  editMode?: boolean;
  /** Открыть просмотр чека */
  onReceiptClick?: (attachment: { url: string; type: string; name?: string }) => void;
  /** Клик по накладной */
  onWaybillClick?: (transaction: TransactionCardTransaction) => void;
  /** Одобрить (только context=feed) */
  onApprove?: (transaction: TransactionCardTransaction) => void;
  /** ID транзакции, для которой идёт одобрение (показать loading на кнопке) */
  approvingTransactionId?: string | null;
  /** ID транзакции, для которой идёт отклонение (показать loading на кнопке) */
  rejectingTransactionId?: string | null;
  /** Редактировать (только context=feed) */
  onEdit?: (transaction: TransactionCardTransaction) => void;
  /** Запрос на удаление (показать модалку с паролем и т.д.) */
  onDeleteRequest?: (transaction: TransactionCardTransaction) => void;
  /** Обновить комментарий по прикреплённому чеку (AI). Кнопка скрыта, если aiConfigured === false. */
  onUpdateCommentByReceipt?: (transaction: TransactionCardTransaction) => void;
  /** AI ключ компании подключён (иначе кнопка «По чеку» не показывается) */
  aiConfigured?: boolean;
}

/**
 * Единая карточка транзакции для Feed и История операций.
 * Внешний вид идентичен на обеих страницах; контекст определяет наличие кнопок (Одобрить/Редактировать).
 * Мемоизирована для производительности в виртуализированном списке.
 */
export const TransactionCard = React.memo<TransactionCardProps>(function TransactionCard({
  transaction,
  context,
  fromCategoryId,
  objectCategoryId,
  categoryColor = 'gray',
  categoryName,
  isTrustedForApproval = false,
  editMode = false,
  onReceiptClick,
  onWaybillClick,
  onApprove,
  approvingTransactionId,
  rejectingTransactionId,
  onEdit,
  onDeleteRequest,
  onUpdateCommentByReceipt,
  aiConfigured = true
}) {
  const [isSwiped, setIsSwiped] = useState(false);
  const [categoryTooltipOpen, setCategoryTooltipOpen] = useState(false);
  const categoryTooltipRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const firstAttachment = transaction.attachments?.[0];

  useEffect(() => {
    if (!categoryTooltipOpen) return;
    const t = setTimeout(() => setCategoryTooltipOpen(false), 2000);
    return () => clearTimeout(t);
  }, [categoryTooltipOpen]);

  useEffect(() => {
    if (!categoryTooltipOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (categoryTooltipRef.current && !categoryTooltipRef.current.contains(target)) {
        setCategoryTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', close, true);
    document.addEventListener('touchstart', close, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('touchstart', close, true);
    };
  }, [categoryTooltipOpen]);

  const handlers = useSwipeable({
    onSwipedLeft: () => setIsSwiped(true),
    onSwipedRight: () => setIsSwiped(false),
    trackMouse: true,
    preventDefaultTouchmoveEvent: true,
    delta: 10
  });

  const status = transaction.status ?? 'approved';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const needsReview = !!transaction.needsReview;
  const isIncome = transaction.type === 'income';
  const amountAbs = Math.round(Math.abs(transaction.amount));
  const amountPrefix = isIncome ? '+' : '-';
  const indicatorColor = categoryColor;

  const cardBgClass =
    isPending || needsReview
      ? 'bg-red-50 border-red-200'
      : isRejected
        ? 'bg-gray-50 border-gray-200'
        : transaction.isSalary
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-white border-gray-200';

  const showFeedActions = context === 'feed' && (editMode || (isPending && isTrustedForApproval));

  const hasReceipt = !!firstAttachment;
  const isSalary = !!transaction.isSalary;
  const isCashless = !!transaction.isCashless;
  const showNeedsReviewBadge = !!transaction.needsReview;

  const fuel = transaction.fuelData;
  const fuelStats = fuel?.derivedFuelStats;

  const fuelStatusMeta =
    fuelStats?.status === 'normal'
      ? { label: 'Норма', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : fuelStats?.status === 'warning'
        ? { label: 'Повышенный расход', className: 'bg-amber-50 text-amber-700 border-amber-200' }
        : fuelStats?.status === 'critical'
          ? { label: 'Подозрительно высокий расход', className: 'bg-red-50 text-red-700 border-red-200' }
          : fuelStats?.status === 'insufficient_data'
            ? { label: 'Недостаточно данных', className: 'bg-gray-50 text-gray-600 border-gray-200' }
            : null;

  return (
    <div className="relative overflow-hidden">
      <div
        className={`absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center transition-opacity duration-200 ${
          isSwiped ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {onDeleteRequest && (
          <button
            onClick={() => onDeleteRequest(transaction)}
            className="w-full h-full flex items-center justify-center text-sm font-medium text-white"
          >
            Удалить
          </button>
        )}
      </div>

      <div
        {...handlers}
        className={`relative transform transition-transform duration-200 ease-out ${
          isSwiped ? '-translate-x-24' : 'translate-x-0'
        }`}
        style={{ touchAction: 'pan-y' }}
      >
        <div className={`rounded-xl px-4 py-3 shadow-sm border ${cardBgClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div ref={categoryTooltipRef} className="relative flex-shrink-0 flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCategoryTooltipOpen((prev) => !prev);
                  }}
                  className="rounded-full cursor-pointer p-0.5 -m-0.5 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                  style={{
                    width: 10,
                    height: 10,
                    marginRight: 8,
                    backgroundColor: getDotHex(indicatorColor)
                  }}
                  aria-label={categoryName ? `Тип: ${categoryName}` : 'Категория операции'}
                />
                {categoryTooltipOpen && (
                  <div
                    role="tooltip"
                    className="absolute left-0 top-full mt-1.5 z-[60] px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap animate-fade-in"
                    style={{ animationDuration: '0.15s' }}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: getDotHex(indicatorColor) }} aria-hidden />
                    {categoryName ?? 'Прочее'}
                  </div>
                )}
              </div>
              <div className="mt-1 flex-shrink-0">
                {isIncome ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {fromCategoryId ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/transactions/history/${fromCategoryId}`);
                      }}
                      className="text-sm font-medium text-gray-900 cursor-pointer hover:opacity-80 hover:underline focus:outline-none focus:underline min-h-[32px] flex items-center"
                    >
                      {transaction.fromUser}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">
                      {transaction.fromUser}
                    </span>
                  )}
                  {transaction.editType === 'correction' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/transaction-history/${transaction.correctedFrom ?? transaction.id}`);
                      }}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer transition-opacity hover:opacity-[0.85]"
                      title="История изменений"
                      aria-label="История изменений"
                    >
                      Исправление
                    </button>
                  )}
                  {transaction.reversedAt && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      Отменено
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">
                      Не одобрено
                    </span>
                  )}
                  {status === 'rejected' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      Отклонено
                    </span>
                  )}
                  {/* Компактные статусные бейджи: ЗП, Безнал, Треб. ут. */}
                  {isSalary && (
                    <span className="inline-flex items-center rounded-full font-semibold text-[10px] leading-none py-[3px] px-2 bg-emerald-100 text-emerald-800 border border-emerald-200" title="Зарплата" aria-label="Зарплата">ЗП</span>
                  )}
                  {isCashless && (
                    <span className="inline-flex items-center rounded-full font-semibold text-[10px] leading-none py-[3px] px-2 bg-blue-100 text-blue-800 border border-blue-200" title="Безналичный перевод" aria-label="Безналичный перевод">Безнал</span>
                  )}
                  {showNeedsReviewBadge && (
                    <span className="inline-flex items-center rounded-full font-semibold text-[10px] leading-none py-[3px] px-2 bg-amber-100 text-amber-800 border border-amber-200" title="Требует уточнения" aria-label="Требует уточнения">Треб. ут.</span>
                  )}
                </div>
                {objectCategoryId ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/transactions/history/${objectCategoryId}`);
                    }}
                    className="text-left text-xs text-gray-500 min-h-[32px] flex items-center cursor-pointer hover:opacity-80 hover:underline focus:outline-none focus:underline"
                  >
                    {transaction.toUser}
                  </button>
                ) : (
                  <span className="text-xs text-gray-500 min-h-[32px] flex items-center">
                    {transaction.toUser}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={`text-[16px] font-semibold ${
                  isRejected
                    ? 'text-gray-500'
                    : isIncome
                    ? 'text-emerald-500'
                    : 'text-red-500'
                }`}
              >
                {amountPrefix}
                {amountAbs.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
              </span>
            </div>
          </div>

          {fuel && (
            <div className="mt-3 border-t border-gray-100 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                <div className="space-y-0.5">
                  <div>
                    <span className="font-medium">Заправка:</span>{' '}
                    {[fuel.vehicleName, fuel.odometerKm != null ? `${fuel.odometerKm} км` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                  <div className="space-x-2">
                    {fuel.liters != null && (
                      <span>{fuel.liters} л</span>
                    )}
                    {fuel.pricePerLiter != null && (
                      <span>{fuel.pricePerLiter} ₸/л</span>
                    )}
                    {fuel.fuelType && <span>{fuel.fuelType}</span>}
                    {fuel.gasStation && <span>АЗС: {fuel.gasStation}</span>}
                  </div>
                </div>
                {fuelStats && fuelStatusMeta && (
                  <div className={`px-2 py-1 rounded-md border text-[11px] font-medium ${fuelStatusMeta.className}`}>
                    {fuelStatusMeta.label}
                    {fuelStats.estimatedConsumptionLPer100 != null && (
                      <span className="ml-1">
                        · {fuelStats.estimatedConsumptionLPer100} л/100 км
                      </span>
                    )}
                  </div>
                )}
              </div>
              {fuelStats && (fuelStats.previousOdometerKm != null || fuelStats.distanceSincePrevFuelingKm != null) && (
                <div className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-2">
                  {fuelStats.previousOdometerKm != null && (
                    <span>Предыдущий пробег: {fuelStats.previousOdometerKm} км</span>
                  )}
                  {fuelStats.distanceSincePrevFuelingKm != null && (
                    <span>Пройдено: {fuelStats.distanceSincePrevFuelingKm} км</span>
                  )}
                </div>
              )}
              {fuelStats?.note && (
                <div className="mt-1 text-[11px] text-gray-500">
                  {fuelStats.note}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                {transaction.description && (
                  <span className="text-[13px] text-gray-400">
                    {transaction.description}
                  </span>
                )}
                {hasReceipt && (
                  <>
                    {onReceiptClick ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onReceiptClick(firstAttachment!);
                        }}
                        className="flex items-center justify-center min-w-[32px] min-h-[32px] p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded"
                        style={{ opacity: 0.85 }}
                        title="Просмотр чека"
                        aria-label="Просмотр чека"
                      >
                        <Receipt className="w-[18px] h-[18px]" strokeWidth={2} />
                      </button>
                    ) : (
                      <span className="flex items-center justify-center min-w-[32px] min-h-[32px] p-1.5 text-gray-400" title="Есть чек" aria-label="Есть чек">
                        <Receipt className="w-[18px] h-[18px]" strokeWidth={2} />
                      </span>
                    )}
                    {aiConfigured !== false && onUpdateCommentByReceipt && (firstAttachment!.type.startsWith('image/') || firstAttachment!.type === 'application/pdf') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onUpdateCommentByReceipt(transaction);
                        }}
                        className="text-[12px] text-emerald-600 hover:text-emerald-700 font-medium"
                        title="Обновить комментарий по чеку (AI)"
                      >
                        По чеку
                      </button>
                    )}
                  </>
                )}
              </div>
              {transaction.waybillNumber && onWaybillClick && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onWaybillClick(transaction);
                  }}
                  className="inline-flex items-center text-[13px] text-blue-600 hover:text-blue-700"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Накладная №{transaction.waybillNumber}
                </button>
              )}
              <span className="text-[12px] text-gray-400 whitespace-nowrap">
                {formatTime(transaction.date)}
              </span>
            </div>
            {showFeedActions && (
              <div className="flex flex-row items-center justify-end gap-2 flex-wrap mt-2">
                {editMode && onEdit && (
                  <button
                    onClick={() => onEdit(transaction)}
                    type="button"
                    title="Редактировать транзакцию"
                    className="inline-flex items-center font-medium text-[13px] rounded-[12px] hover:opacity-90 transition-opacity"
                    style={{
                      border: '1px solid #93c5fd',
                      color: '#2563eb',
                      background: 'transparent',
                      padding: '6px 12px'
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Редактировать
                  </button>
                )}
                {status === 'pending' && isTrustedForApproval && onApprove && (
                  <button
                    onClick={() => onApprove(transaction)}
                    type="button"
                    disabled={approvingTransactionId === transaction.id}
                    className="inline-flex items-center font-medium text-[13px] rounded-[12px] text-white hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      background: '#10b981',
                      padding: '6px 12px'
                    }}
                  >
                    {approvingTransactionId === transaction.id ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Одобрить'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
