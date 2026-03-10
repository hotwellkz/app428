import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, ensureUserDoc } from '../lib/firebase/auth';
import { getCompanyIdForUser, getCompany } from '../lib/firebase/companies';

interface CompanyContextValue {
  companyId: string | null;
  loading: boolean;
  companyBlocked: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue>({
  companyId: null,
  loading: true,
  companyBlocked: false,
  refresh: async () => {}
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyBlocked, setCompanyBlocked] = useState(false);

  const resolve = useCallback(async (uid: string) => {
    try {
      let id = await getCompanyIdForUser(uid);
      if (id == null) {
        await ensureUserDoc(uid, auth.currentUser?.email ?? null);
        id = await getCompanyIdForUser(uid);
      }
      setCompanyId(id ?? null);
      if (id) {
        const company = await getCompany(id);
        setCompanyBlocked(company?.status === 'blocked' || company?.status === 'deleted');
      } else {
        setCompanyBlocked(false);
      }
    } catch (e) {
      console.error('CompanyContext: getCompanyIdForUser failed', e);
      try {
        await ensureUserDoc(uid, auth.currentUser?.email ?? null);
        const id = await getCompanyIdForUser(uid);
        setCompanyId(id ?? null);
        if (id) {
          const company = await getCompany(id);
          setCompanyBlocked(company?.status === 'blocked' || company?.status === 'deleted');
        } else {
          setCompanyBlocked(false);
        }
      } catch (e2) {
        setCompanyId(null);
        setCompanyBlocked(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setCompanyId(null);
      setCompanyBlocked(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    await resolve(user.uid);
  }, [resolve]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setCompanyId(null);
        setCompanyBlocked(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      await resolve(user.uid);
    });
    return () => unsubscribe();
  }, [resolve]);

  const value: CompanyContextValue = {
    companyId,
    loading,
    companyBlocked,
    refresh
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

/** Возвращает companyId текущего пользователя или null, пока не загружен. Никогда не возвращает fallback "hotwell". */
export function useCompanyId(): string | null {
  const { companyId, loading } = useContext(CompanyContext);
  if (loading) return null;
  return companyId;
}

export function useCompanyContext(): CompanyContextValue {
  return useContext(CompanyContext);
}
