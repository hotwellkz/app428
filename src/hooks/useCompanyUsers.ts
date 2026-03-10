import { useState, useEffect } from 'react';
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

export function useCompanyUsers(): {
  users: CompanyUserWithDisplay[];
  orphans: CompanyUserWithDisplay[];
  loading: boolean;
} {
  const companyId = useCompanyId();
  const [users, setUsers] = useState<CompanyUserWithDisplay[]>([]);
  const [orphans, setOrphans] = useState<CompanyUserWithDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setUsers([]);
      setOrphans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getCompanyUsers(companyId)
      .then(async (list) => {
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
              if (import.meta.env.DEV) {
                console.warn(LOG, 'users fetch failed', cu.userId, e);
              }
            }
            const row: CompanyUserWithDisplay = {
              ...cu,
              displayName: displayName ?? null,
              isOrphan: !usersExists
            };
            if (import.meta.env.DEV) {
              console.log(LOG, {
                source: 'company_users',
                userId: cu.userId,
                companyId: cu.companyId,
                hasUsersDoc: usersExists,
                hasCompanyUsersDoc: true,
                email: cu.email,
                reason: usersExists ? 'в списке (пользователь есть)' : 'осиротевшая запись (users отсутствует)'
              });
            }
            return row;
          })
        );
        const live = withDisplay.filter((r) => !r.isOrphan);
        const orphanList = withDisplay.filter((r) => r.isOrphan);
        setUsers(live);
        setOrphans(orphanList);
        if (import.meta.env.DEV && orphanList.length > 0) {
          console.warn(LOG, 'осиротевшие записи:', orphanList.length, orphanList.map((o) => ({ userId: o.userId, email: o.email })));
        }
      })
      .catch((e) => {
        setUsers([]);
        setOrphans([]);
        if (import.meta.env.DEV) console.error(LOG, e);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  return { users, orphans, loading };
}
