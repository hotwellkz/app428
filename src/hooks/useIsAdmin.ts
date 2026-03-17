import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [companyRole, setCompanyRole] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setRole(undefined);
        setCompanyRole(undefined);
        setLoading(false);
        return;
      }

      try {
        const [userDoc, cuDoc] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'company_users', user.uid))
        ]);
        if (userDoc.exists()) {
          const dataRole = userDoc.data().role as string | undefined;
          setRole(dataRole);
          setIsAdmin(dataRole === 'global_admin');
        } else {
          setRole(undefined);
        }
        if (cuDoc.exists() && cuDoc.data()?.role) {
          setCompanyRole(cuDoc.data().role as string);
        } else {
          setCompanyRole(undefined);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /** Доступ к разделу «Сотрудники»: владелец/админ компании или global_admin */
  const canAccessEmployees =
    companyRole === 'owner' || companyRole === 'admin' || role === 'global_admin';

  /** Может управлять пользователями и их правами доступа к разделам */
  const canManageUsers = canAccessEmployees;

  /** Может менять роли пользователей: только владелец компании или global_admin (не обычный админ) */
  const canChangeUserRoles = companyRole === 'owner' || role === 'global_admin';

  return { isAdmin, role, companyRole, canAccessEmployees, canManageUsers, canChangeUserRoles, loading };
};