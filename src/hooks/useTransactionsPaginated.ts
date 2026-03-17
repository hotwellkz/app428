import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  onSnapshot,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from '../contexts/CompanyContext';
import { Transaction } from '../components/transactions/types';

interface UseTransactionsPaginatedProps {
  categoryId: string;
  pageSize?: number;
  enabled?: boolean;
}

interface UseTransactionsPaginatedReturn {
  transactions: Transaction[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  totalAmount: number;
  salaryTotal: number;
  cashlessTotal: number;
}

export const useTransactionsPaginated = ({
  categoryId,
  pageSize = 50,
  enabled = true
}: UseTransactionsPaginatedProps): UseTransactionsPaginatedReturn => {
  const companyId = useCompanyId();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Мемоизируем вычисления сумм (только одобренные транзакции влияют на баланс/итоги счёта)
  const { totalAmount, salaryTotal, cashlessTotal } = useMemo(() => {
    const approved = transactions.filter(
      (t) => (t as { status?: string }).status === undefined || (t as { status?: string }).status === 'approved'
    );
    const total = approved.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const salarySum = approved.reduce((sum, t) => 
      t.isSalary ? sum + Math.abs(t.amount) : sum, 0
    );
    const cashlessSum = approved.reduce((sum, t) => 
      t.isCashless ? sum + Math.abs(t.amount) : sum, 0
    );
    
    return { totalAmount: total, salaryTotal: salarySum, cashlessTotal: cashlessSum };
  }, [transactions]);

  // Функция загрузки первой страницы — только при наличии companyId
  const loadInitialData = useCallback(() => {
    if (!enabled || !companyId || !categoryId) {
      setLoading(false);
      setTransactions([]);
      return () => {};
    }

    setLoading(true);
    setTransactions([]);
    setLastDoc(null);
    setHasMore(true);

    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      where('categoryId', '==', categoryId),
      orderBy('date', 'desc'),
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const raw = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Transaction & { status?: string; editType?: string; correctedFrom?: string; categoryTitle?: string })[];
      if (process.env.NODE_ENV === 'development') {
        console.log('TRANSACTIONS PAGE RAW RESULT', {
          routeId: categoryId,
          totalFetched: raw.length,
          docs: raw.map(t => ({ id: t.id, categoryId: t.categoryId, categoryTitle: (t as any).categoryTitle, editType: t.editType, status: t.status, correctedFrom: t.correctedFrom }))
        });
      }
      const correctedFromIds = new Set(
        raw.filter(t => t.correctedFrom).map(t => t.correctedFrom as string)
      );
      const transactionsData = raw.filter(
        t =>
          t.status !== 'cancelled' &&
          t.editType !== 'reversal' &&
          !correctedFromIds.has(t.id)
      ) as Transaction[];
      if (process.env.NODE_ENV === 'development') {
        console.log('TRANSACTIONS PAGE FILTERED RESULT', {
          routeId: categoryId,
          totalVisible: transactionsData.length,
          docs: transactionsData.map(t => ({ id: t.id, categoryId: t.categoryId, editType: (t as any).editType, status: (t as any).status, correctedFrom: (t as any).correctedFrom }))
        });
      }

      setTransactions(transactionsData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === pageSize);
      setLoading(false);
    });

    return unsubscribe;
  }, [categoryId, pageSize, enabled, companyId]);

  // Загрузка следующей страницы — один раз через getDocs (не onSnapshot), чтобы не дублировать записи и не оставлять лишние подписки
  const loadMore = useCallback(async () => {
    if (!companyId || !categoryId || !hasMore || loading || !lastDoc) return;

    setLoading(true);

    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      where('categoryId', '==', categoryId),
      orderBy('date', 'desc'),
      startAfter(lastDoc),
      limit(pageSize)
    );

    try {
      const snapshot = await getDocs(q);
      const raw = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as (Transaction & { status?: string; editType?: string; correctedFrom?: string })[];
      if (process.env.NODE_ENV === 'development' && raw.length > 0) {
        console.log('TRANSACTIONS PAGE RAW RESULT (loadMore)', { routeId: categoryId, totalFetched: raw.length, docIds: raw.map((t) => t.id) });
      }
      const correctedFromIds = new Set(
        raw.filter((t) => t.correctedFrom).map((t) => t.correctedFrom as string)
      );
      const newTransactions = raw.filter(
        (t) =>
          t.status !== 'cancelled' &&
          t.editType !== 'reversal' &&
          !correctedFromIds.has(t.id)
      ) as Transaction[];

      const receivedFullPage = snapshot.docs.length === pageSize;
      const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

      setTransactions((prev) => (newTransactions.length > 0 ? [...prev, ...newTransactions] : prev));
      if (newLastDoc) setLastDoc(newLastDoc);
      setHasMore(receivedFullPage);
    } catch (err) {
      console.error('useTransactionsPaginated loadMore:', err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [categoryId, pageSize, companyId, lastDoc, hasMore, loading]);

  // Загружаем данные при изменении categoryId
  useEffect(() => {
    return loadInitialData();
  }, [loadInitialData]);

  return {
    transactions,
    loading,
    hasMore,
    loadMore,
    totalAmount,
    salaryTotal,
    cashlessTotal
  };
}; 