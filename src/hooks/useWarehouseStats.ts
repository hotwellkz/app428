import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from '../contexts/CompanyContext';

export const useWarehouseStats = () => {
  const companyId = useCompanyId();
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setTotalValue(0);
      setLoading(false);
      return;
    }
    const fetchTotalValue = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('companyId', '==', companyId)
        );
        const snapshot = await getDocs(q);
        const total = snapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const quantity = data.quantity || 0;
          const price = data.averagePurchasePrice || 0;
          return sum + (quantity * price);
        }, 0);
        if (import.meta.env.DEV) {
          console.log('[useWarehouseStats]', { companyId, collection: 'products', count: snapshot.size, totalValue: total });
        }
        setTotalValue(total);
      } catch (error) {
        console.error('Error calculating total value:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTotalValue();
  }, [companyId]);

  return { totalValue, loading };
};