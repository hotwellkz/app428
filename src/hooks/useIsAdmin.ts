import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setRole(undefined);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const dataRole = userDoc.data().role as string | undefined;
          setRole(dataRole);
          setIsAdmin(dataRole === 'global_admin');
        } else {
          setRole(undefined);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /** Доступ к разделу «Сотрудники»: владелец компании или global_admin */
  const canAccessEmployees = role === 'owner' || role === 'global_admin';

  return { isAdmin, role, canAccessEmployees, loading };
};