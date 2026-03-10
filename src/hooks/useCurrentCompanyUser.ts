import { useState, useEffect } from 'react';
import { auth } from '../lib/firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { getCompanyUser } from '../lib/firebase/companies';
import type { CompanyUserRow } from '../lib/firebase/companies';
import type { MenuAccess } from '../types/menuAccess';
import { canAccessSection } from '../types/menuAccess';

export function useCurrentCompanyUser() {
  const [companyUser, setCompanyUser] = useState<CompanyUserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCompanyUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const cu = await getCompanyUser(user.uid);
        setCompanyUser(cu);
      } catch (e) {
        console.error('useCurrentCompanyUser:', e);
        setCompanyUser(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const menuAccess: MenuAccess | undefined = companyUser?.menuAccess;

  const canAccess = (section: Parameters<typeof canAccessSection>[1]) =>
    canAccessSection(menuAccess, section);

  return { companyUser, menuAccess, canAccess, loading };
}
