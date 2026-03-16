import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from '../contexts/CompanyContext';
import { Transaction } from '../components/transactions/types';
import { getClientAggregates } from '../utils/clientAggregates';

export interface ClientTransactionsData {
  transactions: Transaction[];
  totalAmount: number;
  loading: boolean;
  categoryId: string | null;
}

/**
 * Хук для получения транзакций клиента
 * Использует categoryId из агрегатов клиента для получения транзакций
 */
export const useClientTransactions = (clientId: string): ClientTransactionsData => {
  const companyId = useCompanyId();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !clientId) {
      setTransactions([]);
      setTotalAmount(0);
      setLoading(false);
      setCategoryId(null);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const loadTransactions = async () => {
      try {
        let clientCategoryId: string | null = null;

        // Сначала пытаемся получить categoryId из агрегатов клиента
        const aggregates = await getClientAggregates(clientId);
        
        if (aggregates && aggregates.categoryId) {
          clientCategoryId = aggregates.categoryId;
        } else {
          // Fallback: ищем категорию по имени клиента
          try {
            const clientDoc = await getDoc(doc(db, 'clients', clientId));
            if (clientDoc.exists()) {
              const clientData = clientDoc.data();
              const clientName = `${clientData.lastName || ''} ${clientData.firstName || ''}`.trim();
              const objectName = clientData.objectName || '';

              // Ищем категорию по имени клиента (row === 1 означает клиента)
              if (clientName) {
                const clientNameQuery = query(
                  collection(db, 'categories'),
                  where('companyId', '==', companyId),
                  where('title', '==', clientName),
                  where('row', '==', 1)
                );
                const clientNameSnapshot = await getDocs(clientNameQuery);
                if (!clientNameSnapshot.empty) {
                  clientCategoryId = clientNameSnapshot.docs[0].id;
                }
              }

              // Если не нашли по имени, ищем по названию объекта
              if (!clientCategoryId && objectName) {
                const objectNameQuery = query(
                  collection(db, 'categories'),
                  where('companyId', '==', companyId),
                  where('title', '==', objectName),
                  where('row', '==', 1)
                );
                const objectNameSnapshot = await getDocs(objectNameQuery);
                if (!objectNameSnapshot.empty) {
                  clientCategoryId = objectNameSnapshot.docs[0].id;
                }
              }
            }
          } catch (error) {
            console.error('Error finding client category:', error);
          }
        }

        if (!clientCategoryId) {
          // Категория не найдена - значит транзакций нет
          setLoading(false);
          setCategoryId(null);
          return;
        }

        setCategoryId(clientCategoryId);

        // Подписываемся на транзакции клиента
        const q = query(
          collection(db, 'transactions'),
          where('companyId', '==', companyId),
          where('categoryId', '==', clientCategoryId),
          orderBy('date', 'desc')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const transactionsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Transaction[];

          // Сумма только по одобренным транзакциям (pending/rejected не влияют на баланс)
          const approvedOnly = transactionsData.filter(
            (t) => (t as { status?: string }).status === undefined || (t as { status?: string }).status === 'approved'
          );
          const total = approvedOnly.reduce((sum, t) => sum + Math.abs(t.amount), 0);

          setTransactions(transactionsData);
          setTotalAmount(total);
          setLoading(false);
        }, (error) => {
          console.error('Error loading client transactions:', error);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error loading client transactions:', error);
        setLoading(false);
      }
    };

    loadTransactions();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [clientId, companyId]);

  return {
    transactions,
    totalAmount,
    loading,
    categoryId
  };
};

