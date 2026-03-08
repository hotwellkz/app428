import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TopStatType } from '../types';
import { useCompanyId } from '../contexts/CompanyContext';

export const useStats = () => {
  const companyId = useCompanyId();
  const [stats, setStats] = useState<TopStatType[]>([
    { label: 'Баланс', value: '0 ₸' },
    { label: 'Расходы', value: '0 ₸' }
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return () => {};
    }

    console.time('useStats-load');
    console.log('[PERF] useStats: Starting to load stats (transactions)...');
    
    try {
      const loadClientCategories = async () => {
        console.time('useStats-loadClientCategories');
        const clientCategoriesQuery = query(
          collection(db, 'categories'),
          where('companyId', '==', companyId),
          where('row', '==', 1)
        );
        const snapshot = await getDocs(clientCategoriesQuery);
        console.timeEnd('useStats-loadClientCategories');
        return snapshot.docs.map(doc => doc.id);
      };

      // Подписываемся на транзакции
      const q = query(
        collection(db, 'transactions'),
        where('companyId', '==', companyId),
        orderBy('date', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log('[PERF] useStats: Received transactions snapshot, docs count:', snapshot.docs.length);
        try {
          const clientCategoryIds = await loadClientCategories();
          
          let totalBalance = 0;
          let totalExpenses = 0;
          let latestSystemBalanceDoc = null;
          let latestSystemExpensesDoc = null;

          // Сначала найдем последние системные транзакции
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.type === 'system_adjustment') {
              if (data.categoryId === 'system_balance' && (!latestSystemBalanceDoc || data.date.toDate() > latestSystemBalanceDoc.date.toDate())) {
                latestSystemBalanceDoc = data;
              }
              if (data.categoryId === 'system_expenses' && (!latestSystemExpensesDoc || data.date.toDate() > latestSystemExpensesDoc.date.toDate())) {
                latestSystemExpensesDoc = data;
              }
            }
          });

          // Если есть системные транзакции, используем их значения
          if (latestSystemBalanceDoc) {
            totalBalance = latestSystemBalanceDoc.amount;
          }
          
          if (latestSystemExpensesDoc) {
            totalExpenses = Math.abs(latestSystemExpensesDoc.amount);
          } else {
            // Если нет системной транзакции для расходов, считаем обычным способом
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              const amount = data.amount;
              const categoryId = data.categoryId;
              
              if (amount < 0 && 
                  !clientCategoryIds.includes(categoryId) && 
                  !['system_balance', 'system_expenses'].includes(categoryId)) {
                totalExpenses += Math.abs(amount);
              }

              // Если нет системного баланса, учитываем все транзакции для баланса
              if (!latestSystemBalanceDoc && !['system_balance', 'system_expenses'].includes(categoryId)) {
                totalBalance += amount;
              }
            });
          }

          setStats([
            { label: 'Баланс', value: `${totalBalance.toLocaleString()} ₸` },
            { label: 'Расходы', value: `${totalExpenses.toLocaleString()} ₸` }
          ]);
          setLoading(false);
          console.timeEnd('useStats-load');
          console.log('[PERF] useStats: Stats loaded successfully');
        } catch (error) {
          console.error('Ошибка при обработке транзакций:', error);
          setError(error instanceof Error ? error.message : 'Ошибка при обработке транзакций');
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Ошибка в useStats:', error);
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
      setLoading(false);
    }
  }, [companyId]);

  return { stats, loading, error };
};