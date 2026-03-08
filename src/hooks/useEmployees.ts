import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee } from '../types/employee';
import { useCompanyId } from '../contexts/CompanyContext';

export const useEmployees = () => {
  const companyId = useCompanyId();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'employees'),
      where('companyId', '==', companyId),
      orderBy('lastName')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        if (import.meta.env.DEV) {
          console.log('[useEmployees]', { companyId, collection: 'employees', count: employeesData.length });
        }
        setEmployees(employeesData);
        setLoading(false);
      },
      (err: unknown) => {
        const code = (err as { code?: string })?.code;
        if (code === 'failed-precondition') {
          console.warn('[useEmployees] Firestore index building. Empty list until ready.');
          setEmployees([]);
        } else {
          console.error('useEmployees subscription error:', err);
        }
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [companyId]);

  return { employees, loading };
};