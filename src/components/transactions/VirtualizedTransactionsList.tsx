/**
 * Виртуализированный список транзакций (@tanstack/react-virtual).
 * Поддерживает динамическую высоту карточек (длинные комментарии, бейджи, чек).
 * Рендерит только видимые строки + overscan.
 */

import React, { memo, useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TransactionCard, TransactionCardTransaction } from './TransactionCard';
import type { TransactionCardContext } from './TransactionCard';

const ESTIMATE_DATE = 52;
const ESTIMATE_CARD = 140;
const ESTIMATE_FOOTER = 56;
const OVERSCAN = 5;
const LOAD_MORE_THRESHOLD = 10;

export type VirtualizedRowDate = {
  type: 'date';
  id: string;
  dateLabel: string;
  total: number;
};

export type VirtualizedRowTransaction = {
  type: 'transaction';
  id: string;
  transaction: TransactionCardTransaction;
  fromCategoryId?: string;
  objectCategoryId?: string;
  categoryColor?: string;
  categoryName?: string;
};

export type VirtualizedRowFooter = {
  type: 'footer';
  id: string;
  loading?: boolean;
  allLoaded?: boolean;
};

export type VirtualizedRow = VirtualizedRowDate | VirtualizedRowTransaction | VirtualizedRowFooter;

export function isDateRow(row: VirtualizedRow): row is VirtualizedRowDate {
  return row.type === 'date';
}

export function isTransactionRow(row: VirtualizedRow): row is VirtualizedRowTransaction {
  return row.type === 'transaction';
}

export function isFooterRow(row: VirtualizedRow): row is VirtualizedRowFooter {
  return row.type === 'footer';
}

/** Строка-заголовок даты */
const DateRow = memo(({ dateLabel, total }: { dateLabel: string; total: number }) => (
  <div className="px-1 py-2">
    <div className="flex items-baseline justify-between">
      <h2 className="text-sm font-medium text-gray-500">{dateLabel}</h2>
      <span className="text-xs font-medium text-gray-400">
        {Math.round(total).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
      </span>
    </div>
  </div>
));

DateRow.displayName = 'DateRow';

/** Футер: индикатор подгрузки или «Все загружены» */
const ListFooter = memo(({ loading, allLoaded }: { loading?: boolean; allLoaded?: boolean }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-4 bg-white rounded-lg shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-emerald-500" />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }
  if (allLoaded) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        Все транзакции загружены
      </div>
    );
  }
  return null;
});

ListFooter.displayName = 'ListFooter';

/** Одна строка списка (дата, карточка или футер) — без внешнего style/position, контейнер позиционирует */
const TransactionRowContent = memo(function TransactionRowContent({
  row,
  context,
  isTrustedForApproval,
  editMode,
  onReceiptClick,
  onWaybillClick,
  onApprove,
  onEdit,
  onDeleteRequest,
  onUpdateCommentByReceipt,
  canDeleteTransaction,
  approvingTransactionId,
  rejectingTransactionId,
  aiConfigured
}: {
  row: VirtualizedRow;
  context: TransactionCardContext;
  isTrustedForApproval?: boolean;
  editMode?: boolean;
  onReceiptClick?: (a: { url: string; type: string; name?: string }) => void;
  onWaybillClick?: (t: TransactionCardTransaction) => void;
  onApprove?: (t: TransactionCardTransaction) => void;
  onEdit?: (t: TransactionCardTransaction) => void;
  onDeleteRequest?: (t: TransactionCardTransaction) => void;
  onUpdateCommentByReceipt?: (t: TransactionCardTransaction) => void;
  canDeleteTransaction?: (t: TransactionCardTransaction) => boolean;
  approvingTransactionId?: string | null;
  rejectingTransactionId?: string | null;
  aiConfigured?: boolean;
}) {
  if (isDateRow(row)) {
    return <DateRow dateLabel={row.dateLabel} total={row.total} />;
  }
  if (isFooterRow(row)) {
    return <ListFooter loading={row.loading} allLoaded={row.allLoaded} />;
  }
  const showDelete = !canDeleteTransaction || canDeleteTransaction(row.transaction);
  return (
    <div className="px-0 pb-2">
      <TransactionCard
        transaction={row.transaction}
        context={context}
        fromCategoryId={row.fromCategoryId}
        objectCategoryId={row.objectCategoryId}
        categoryColor={row.categoryColor}
        categoryName={row.categoryName}
        isTrustedForApproval={isTrustedForApproval}
        editMode={editMode}
        onReceiptClick={onReceiptClick}
        onWaybillClick={onWaybillClick}
        onApprove={onApprove}
        onEdit={onEdit}
        onDeleteRequest={showDelete ? onDeleteRequest : undefined}
        onUpdateCommentByReceipt={onUpdateCommentByReceipt}
        aiConfigured={aiConfigured}
        approvingTransactionId={approvingTransactionId}
        rejectingTransactionId={rejectingTransactionId}
      />
    </div>
  );
});

export interface VirtualizedTransactionsListProps {
  rows: VirtualizedRow[];
  /** Требуется, если не передан scrollContainerRef (например, страница History). При scrollContainerRef — не используется. */
  height?: number;
  width: number | string;
  context: TransactionCardContext;
  isTrustedForApproval?: boolean;
  editMode?: boolean;
  onReceiptClick?: (a: { url: string; type: string; name?: string }) => void;
  onWaybillClick?: (t: TransactionCardTransaction) => void;
  onApprove?: (t: TransactionCardTransaction) => void;
  onEdit?: (t: TransactionCardTransaction) => void;
  onDeleteRequest?: (t: TransactionCardTransaction) => void;
  onUpdateCommentByReceipt?: (t: TransactionCardTransaction) => void;
  canDeleteTransaction?: (t: TransactionCardTransaction) => boolean;
  approvingTransactionId?: string | null;
  rejectingTransactionId?: string | null;
  /** AI ключ компании подключён (кнопка «По чеку» скрыта при false) */
  aiConfigured?: boolean;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  /** Внешний scroll container (Feed). Виртуализатор использует его как getScrollElement; компонент рендерит только контент. */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onTotalSizeChange?: (totalSize: number) => void;
  className?: string;
}

function VirtualizedTransactionsListInner({
  rows,
  height = 400,
  width,
  context,
  isTrustedForApproval,
  editMode,
  onReceiptClick,
  onWaybillClick,
  onApprove,
  onEdit,
  onDeleteRequest,
  onUpdateCommentByReceipt,
  canDeleteTransaction,
  approvingTransactionId,
  rejectingTransactionId,
  aiConfigured,
  hasMore,
  loading,
  onLoadMore,
  scrollContainerRef,
  onTotalSizeChange,
  className
}: VirtualizedTransactionsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const [scrollElementReady, setScrollElementReady] = useState(false);
  const useExternalScroll = !!scrollContainerRef && scrollElementReady;
  const effectiveHeight =
    !useExternalScroll && scrollContainerRef
      ? typeof window !== 'undefined'
        ? Math.max(400, window.innerHeight - 200)
        : 400
      : height;

  useEffect(() => {
    if (!scrollContainerRef) return;
    if (scrollContainerRef.current) {
      setScrollElementReady(true);
      return;
    }
    const raf = requestAnimationFrame(() => {
      if (scrollContainerRef.current) setScrollElementReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollContainerRef]);

  const estimateSize = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return ESTIMATE_CARD;
      if (row.type === 'date') return ESTIMATE_DATE;
      if (row.type === 'footer') return ESTIMATE_FOOTER;
      return ESTIMATE_CARD;
    },
    [rows]
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      useExternalScroll && scrollContainerRef?.current ? scrollContainerRef.current : parentRef.current,
    estimateSize,
    overscan: OVERSCAN
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const expectedMinHeight = React.useMemo(() => {
    let sum = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) {
        sum += ESTIMATE_CARD;
      } else if (row.type === 'date') {
        sum += ESTIMATE_DATE;
      } else if (row.type === 'footer') {
        sum += ESTIMATE_FOOTER;
      } else {
        sum += ESTIMATE_CARD;
      }
    }
    return sum;
  }, [rows]);

  const contentHeight = Math.max(totalSize, expectedMinHeight);

  useEffect(() => {
    onTotalSizeChange?.(contentHeight);
  }, [contentHeight, onTotalSizeChange]);

  const innerContent = (
    <div
      style={{
        height: `${contentHeight}px`,
        width: '100%',
        position: 'relative'
      }}
    >
      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            key={row.id}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <TransactionRowContent
              row={row}
              context={context}
              isTrustedForApproval={isTrustedForApproval}
              editMode={editMode}
              onReceiptClick={onReceiptClick}
              onWaybillClick={onWaybillClick}
              onApprove={onApprove}
              onEdit={onEdit}
              onDeleteRequest={onDeleteRequest}
              onUpdateCommentByReceipt={onUpdateCommentByReceipt}
              canDeleteTransaction={canDeleteTransaction}
              aiConfigured={aiConfigured}
              approvingTransactionId={approvingTransactionId}
              rejectingTransactionId={rejectingTransactionId}
            />
          </div>
        );
      })}
    </div>
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const el = parentRef.current;
    const rowTypes = { date: 0, transaction: 0, footer: 0 };
    rows.forEach((r) => {
      if (r.type === 'date') rowTypes.date++;
      else if (r.type === 'transaction') rowTypes.transaction++;
      else if (r.type === 'footer') rowTypes.footer++;
    });
    console.log('[Feed VirtualList] DIAG', {
      rows_length: rows.length,
      rowTypes,
      virtualizer_count: rows.length,
      virtualizer_getTotalSize: totalSize,
      expectedMinHeight,
      contentHeight,
      scrollContainer_clientHeight: el?.clientHeight ?? null,
      scrollContainer_scrollHeight: el?.scrollHeight ?? null,
      virtualItems_count: virtualItems.length
    });
  }, [rows, totalSize, expectedMinHeight, contentHeight, virtualItems.length]);

  useEffect(() => {
    if (loadingMoreRef.current || loading || !hasMore || virtualItems.length === 0) return;
    const hasFooter = rows.length > 0 && rows[rows.length - 1].type === 'footer';
    const dataLength = hasFooter ? rows.length - 1 : rows.length;
    if (dataLength <= 0) return;
    const lastVisible = virtualItems[virtualItems.length - 1];
    if (lastVisible && lastVisible.index >= dataLength - LOAD_MORE_THRESHOLD) {
      loadingMoreRef.current = true;
      onLoadMore();
      setTimeout(() => {
        loadingMoreRef.current = false;
      }, 300);
    }
  }, [rows, hasMore, loading, onLoadMore, virtualItems]);

  if (rows.length === 0) return null;

  if (useExternalScroll) {
    return <>{innerContent}</>;
  }

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        height: typeof effectiveHeight === 'number' ? effectiveHeight : '100%',
        width: width ?? '100%',
        overflow: 'auto'
      }}
    >
      {innerContent}
    </div>
  );
}

export const VirtualizedTransactionsList = memo(VirtualizedTransactionsListInner);

/** Строит плоский список строк из сгруппированных по дате транзакций (для Feed/History). */
export function buildFlattenedRowsFromGrouped(
  grouped: Record<string, { transactions: TransactionCardTransaction[]; total: number }>,
  options: {
    getDateLabel: (dateKey: string) => string;
    getFromCategoryId?: (t: TransactionCardTransaction) => string | undefined;
    getObjectCategoryId?: (t: TransactionCardTransaction) => string | undefined;
    getCategoryColor?: (t: TransactionCardTransaction) => string;
    getCategoryName?: (t: TransactionCardTransaction) => string | undefined;
  }
): VirtualizedRow[] {
  const rows: VirtualizedRow[] = [];
  const entries = Object.entries(grouped);
  const sorted = entries.sort((a, b) => {
    const aFirst = a[1].transactions[0];
    const bFirst = b[1].transactions[0];
    if (!aFirst?.date || !bFirst?.date) return 0;
    const aSec = typeof aFirst.date === 'object' && 'seconds' in aFirst.date ? aFirst.date.seconds : 0;
    const bSec = typeof bFirst.date === 'object' && 'seconds' in bFirst.date ? bFirst.date.seconds : 0;
    return bSec - aSec;
  });
  for (const [dateKey, { transactions, total }] of sorted) {
    rows.push({
      type: 'date',
      id: `date-${dateKey}`,
      dateLabel: options.getDateLabel(dateKey),
      total
    });
    for (const t of transactions) {
      rows.push({
        type: 'transaction',
        id: t.id,
        transaction: t,
        fromCategoryId: options.getFromCategoryId?.(t),
        objectCategoryId: options.getObjectCategoryId?.(t),
        categoryColor: options.getCategoryColor?.(t) ?? 'gray',
        categoryName: options.getCategoryName?.(t)
      });
    }
  }
  return rows;
}

/** Группирует транзакции по дате (ключ yyyy-MM-dd). Для страницы History. */
export function buildGroupedByDateKey(
  transactions: TransactionCardTransaction[]
): Record<string, { transactions: TransactionCardTransaction[]; total: number }> {
  const grouped: Record<string, { transactions: TransactionCardTransaction[]; total: number }> = {};
  for (const t of transactions) {
    if (!t.date) continue;
    const date = typeof t.date === 'object' && 'toDate' in t.date ? (t.date as { toDate(): Date }).toDate() : new Date((t.date as { seconds?: number }).seconds ? (t.date as { seconds: number }).seconds * 1000 : 0);
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!grouped[dateKey]) grouped[dateKey] = { transactions: [], total: 0 };
    grouped[dateKey].transactions.push(t);
    grouped[dateKey].total += Math.abs(t.amount);
  }
  return grouped;
}

/** Форматирует ключ даты (yyyy-MM-dd) в подпись для заголовка (Сегодня / Вчера / пн, 3 марта 2025). */
export function formatDateKeyAsLabel(dateKey: string): string {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Сегодня';
  if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Вчера';
  return format(date, 'EEE, d MMMM yyyy', { locale: ru });
}
