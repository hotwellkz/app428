import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCompanyUsers } from '../lib/firebase/companies';
import type { CompanyUserRow } from '../lib/firebase/companies';
import { useCompanyId } from '../contexts/CompanyContext';

const LOG = '[useCompanyUsers]';

export interface CompanyUserWithDisplay extends CompanyUserRow {
  displayName: string | null;
  /** Запись осиротела: company_users есть, users/{userId} нет (пользователь удалён). */
  isOrphan?: boolean;
}

async function fetchCompanyUsersWithDisplay(companyId: string): Promise<{
  users: CompanyUserWithDisplay[];
  orphans: CompanyUserWithDisplay[];
}> {
  const list = await getCompanyUsers(companyId);
  const withDisplay = await Promise.all(
    list.map(async (cu) => {
      let displayName: string | null = null;
      let usersExists = false;
      try {
        const uSnap = await getDoc(doc(db, 'users', cu.userId));
        usersExists = uSnap.exists();
        if (usersExists) {
          displayName = (uSnap.data().displayName as string) || null;
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn(LOG, 'users fetch failed', cu.userId, e);
      }
      return {
        ...cu,
        displayName: displayName ?? null,
        isOrphan: !usersExists
      } as CompanyUserWithDisplay;
    })
  );
  const users = withDisplay.filter((r) => !r.isOrphan);
  const orphans = withDisplay.filter((r) => r.isOrphan);
  return { users, orphans };
}

export function useCompanyUsers(): {
  users: CompanyUserWithDisplay[];
  orphans: CompanyUserWithDisplay[];
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const companyId = useCompanyId();
  const [users, setUsers] = useState<CompanyUserWithDisplay[]>([]);
  const [orphans, setOrphans] = useState<CompanyUserWithDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { users: u, orphans: o } = await fetchCompanyUsersWithDisplay(companyId);
      setUsers(u);
      setOrphans(o);
    } catch (e) {
      if (import.meta.env.DEV) console.error(LOG, e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setUsers([]);
      setOrphans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCompanyUsersWithDisplay(companyId)
      .then(({ users: u, orphans: o }) => {
        setUsers(u);
        setOrphans(o);
      })
      .catch((e) => {
        setUsers([]);
        setOrphans([]);
        if (import.meta.env.DEV) console.error(LOG, e);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  return { users, orphans, loading, refetch };
}
