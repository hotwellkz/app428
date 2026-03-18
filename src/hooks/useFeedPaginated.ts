/**
 * Хук для пагинированной загрузки ленты транзакций
 * По умолчанию загружает последние 60 дней
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, startAfter, onSnapshot, getDocs, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from '../contexts/CompanyContext';

interface FeedTransaction {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  description: string;
  date: {
    seconds: number;
    nanoseconds: number;
  } | Timestamp;
  /** Для исправлений — дата оригинала, чтобы порядок в ленте не прыгал */
  feedSortDate?: { seconds: number; nanoseconds: number } | Timestamp;
  type: 'income' | 'expense';
  categoryId: string;
  expenseCategoryId?: string;
  waybillId?: string;
  waybillType?: 'income' | 'expense';
  waybillNumber?: string;
  waybillData?: any;
  editType?: 'reversal' | 'correction';
  reversalOf?: string;
  correctedFrom?: string;
  status?: 'pending' | 'approved' | 'rejected';
  needsReview?: boolean;
  isSalary?: boolean;
  isCashless?: boolean;
  attachments?: Array<{ name: string; url: string; type: string }>;
  reversedAt?: unknown;
  /** Данные заправки — для расширенного отображения в Ленте (как в истории «Заправка») */
  fuelData?: {
    vehicleId: string;
    vehicleName: string;
    odometerKm: number;
    liters?: number | null;
    pricePerLiter?: number | null;
    fuelType?: string | null;
    gasStation?: string | null;
    isFullTank?: boolean;
    derivedFuelStats?: {
      previousFuelTransactionId?: string | null;
      previousOdometerKm?: number | null;
      distanceSincePrevFuelingKm?: number | null;
      estimatedConsumptionLPer100?: number | null;
      status: 'normal' | 'warning' | 'critical' | 'insufficient_data';
      note?: string | null;
    } | null;
  };
}

const PAGE_SIZE = 30; // размер одной порции из Firestore (после фильтра может быть меньше)

interface UseFeedPaginatedOptions {
  defaultDays?: number;
  enabled?: boolean;
}

interface UseFeedPaginatedReturn {
  transactions: FeedTransaction[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  totalCount: number;
  /** Локальное обновление одной транзакции (для мгновенного UI после approve/reject). */
  patchTransaction: (transactionId: string, patch: Partial<FeedTransaction>) => void;
}

function processSnapshot(
  snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> },
  getDefaultStartDate: () => { seconds: number }
): { list: FeedTransaction[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null } {
  const startDateSeconds = getDefaultStartDate().seconds;
  const transactionsMap = new Map<string, FeedTransaction>();
  snapshot.docs.forEach((d) => {
    const data = d.data();
    const transactionDate = data.date && typeof (data.date as any).seconds === 'number' ? (data.date as any).seconds : 0;
    if (data.type !== 'expense' || transactionDate < startDateSeconds) return;
    if (data.status === 'cancelled' || data.editType === 'reversal') return;
    const transaction: FeedTransaction = {
      id: d.id,
      fromUser: data.fromUser as string,
      toUser: data.toUser as string,
      amount: data.amount as number,
      description: data.description as string,
      date: data.date as FeedTransaction['date'],
      feedSortDate: data.feedSortDate as FeedTransaction['feedSortDate'],
      type: data.type as 'expense',
      categoryId: data.categoryId as string,
      expenseCategoryId: data.expenseCategoryId as string | undefined,
      waybillId: data.waybillId,
      waybillType: data.waybillType,
      waybillNumber: data.waybillNumber,
      waybillData: data.waybillData,
      editType: data.editType,
      reversalOf: data.reversalOf,
      correctedFrom: data.correctedFrom,
      status: (data.status as FeedTransaction['status']) ?? 'approved',
      needsReview: !!data.needsReview,
      isSalary: !!data.isSalary,
      isCashless: !!data.isCashless,
      attachments: data.attachments as FeedTransaction['attachments'],
      reversedAt: data.reversedAt,
      fuelData: data.fuelData as FeedTransaction['fuelData']
    };
    transactionsMap.set(d.id, transaction);
  });
  const sortDate = (t: FeedTransaction) => {
    const d = t.feedSortDate ?? t.date;
    return d && typeof (d as any).seconds === 'number' ? (d as any).seconds : 0;
  };
  const compareFeed = (a: FeedTransaction, b: FeedTransaction) => {
    const byDate = sortDate(b) - sortDate(a);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  };
  const list = Array.from(transactionsMap.values()).sort(compareFeed);
  const lastDoc = snapshot.docs.length > 0 ? (snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot<DocumentData>) : null;
  return { list, lastDoc };
}

export const useFeedPaginated = ({
  defaultDays = 60,
  enabled = true
}: UseFeedPaginatedOptions = {}): UseFeedPaginatedReturn => {
  const companyId = useCompanyId();
  const [transactions, setTransactions] = useState<FeedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const initialPageFetchedRef = useRef(false);

  // Вычисляем дату начала по умолчанию
  const getDefaultStartDate = useCallback(() => {
    const date = new Date();
    date.setDate(date.getDate() - defaultDays);
    return Timestamp.fromDate(date);
  }, [defaultDays]);

  // Функция загрузки первой страницы — запрос только при наличии companyId
  const loadInitialData = useCallback(() => {
    if (!enabled || !companyId) {
      setLoading(false);
      setTransactions([]);
      return () => {};
    }

    setLoading(true);
    setTransactions([]);
    setLastDoc(null);
    setHasMore(true);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      orderBy('date', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const { list: sortedTransactions, lastDoc: newLastDoc } = processSnapshot(snapshot, getDefaultStartDate);
          setLastDoc(newLastDoc);
          setHasMore(snapshot.docs.length >= PAGE_SIZE);
          setLoading(false);
          initialPageFetchedRef.current = true;

          setTransactions((prev) => {
            if (prev.length === 0) {
              setTotalCount(sortedTransactions.length);
              return sortedTransactions;
            }
            if (prev.length <= sortedTransactions.length) {
              setTotalCount(sortedTransactions.length);
              return sortedTransactions;
            }
            const firstIds = new Set(sortedTransactions.map((t) => t.id));
            const rest = prev.filter((t) => !firstIds.has(t.id));
            const sortDate = (t: FeedTransaction) => {
              const d = t.feedSortDate ?? t.date;
              return d && typeof (d as any).seconds === 'number' ? (d as any).seconds : 0;
            };
            const compareFeed = (a: FeedTransaction, b: FeedTransaction) => {
              const byDate = sortDate(b) - sortDate(a);
              if (byDate !== 0) return byDate;
              return a.id.localeCompare(b.id);
            };
            const merged = [...sortedTransactions, ...rest].sort(compareFeed);
            setTotalCount(merged.length);
            return merged;
          });
        } catch (error) {
          console.error('Error processing transactions:', error);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching transactions:', error);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [enabled, getDefaultStartDate, companyId]);

  const loadMore = useCallback(async () => {
    if (!companyId || !hasMore || loading || loadingMore || !lastDoc || !enabled) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('companyId', '==', companyId),
        orderBy('date', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const { list: newList, lastDoc: newLastDoc } = processSnapshot(snapshot, getDefaultStartDate);
      if (newList.length > 0 || snapshot.docs.length > 0) {
        setLastDoc(newLastDoc);
        setHasMore(snapshot.docs.length >= PAGE_SIZE);
        setTransactions((prev) => {
          const combined = [...prev, ...newList];
          const byId = new Map(prev.map((t) => [t.id, t]));
          newList.forEach((t) => byId.set(t.id, t));
          const unique = Array.from(byId.values());
          const sortDate = (t: FeedTransaction) => {
            const d = t.feedSortDate ?? t.date;
            return d && typeof (d as any).seconds === 'number' ? (d as any).seconds : 0;
          };
          const compareFeed = (a: FeedTransaction, b: FeedTransaction) => {
            const byDate = sortDate(b) - sortDate(a);
            if (byDate !== 0) return byDate;
            return a.id.localeCompare(b.id);
          };
          return unique.sort(compareFeed);
        });
        setTotalCount((prev) => prev + newList.length);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, hasMore, loading, loadingMore, enabled, getDefaultStartDate, companyId]);

  // Функция обновления данных
  const refresh = useCallback(() => {
    loadInitialData();
  }, [loadInitialData]);

  /** Мгновенное обновление одной транзакции в state (optimistic / immediate UI после approve/reject). */
  const patchTransaction = useCallback((transactionId: string, patch: Partial<FeedTransaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, ...patch } : t))
    );
  }, []);

  // Загружаем данные при монтировании
  useEffect(() => {
    return loadInitialData();
  }, [loadInitialData]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    transactions,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    totalCount,
    patchTransaction
  };
};

