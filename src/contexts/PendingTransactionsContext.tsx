import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from './CompanyContext';

export interface PendingSummary {
  /** Чистая сумма pending для сущности (net): income = плюс, expense = минус */
  pendingAmount: number;
  pendingCount: number;
  hasNeedsReview: boolean;
}

type PendingByCategoryId = Record<string, PendingSummary>;

const PendingTransactionsContext = createContext<PendingByCategoryId | null>(null);

export function PendingTransactionsProvider({ children }: { children: React.ReactNode }) {
  const companyId = useCompanyId();
  const [byCategoryId, setByCategoryId] = useState<PendingByCategoryId>({});
  const devLoggedMissingCategoryIdRef = useRef(false);

  useEffect(() => {
    if (!companyId) {
      setByCategoryId({});
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      where('status', '==', 'pending')
    );

    return onSnapshot(
      q,
      (snap) => {
        const next: PendingByCategoryId = {};
        const statusCounts: Record<string, number> = {};
        let nanAmounts = 0;

        snap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const categoryId = (data.categoryId as string | undefined) ?? '';
          const amountRaw = Number(data.amount);
          if (!Number.isFinite(amountRaw)) nanAmounts++;
          const safeAmount = Number.isFinite(amountRaw) ? amountRaw : 0;
          const needsReview = data.needsReview === true;
          const status = (data.status as string | undefined) ?? 'pending';
          statusCounts[status] = (statusCounts[status] ?? 0) + 1;

          if (!categoryId) {
            if (import.meta.env.DEV && !devLoggedMissingCategoryIdRef.current) {
              // eslint-disable-next-line no-console
              console.warn('[PendingTransactions] pending tx without categoryId (first occurrence)', {
                id: d.id,
                status,
                amount: amountRaw
              });
              devLoggedMissingCategoryIdRef.current = true;
            }
            return;
          }

          const cur = next[categoryId] ?? { pendingAmount: 0, pendingCount: 0, hasNeedsReview: false };
          next[categoryId] = {
            // В pending транзакциях amount уже имеет знак относительно categoryId:
            // income -> +amount, expense -> -amount. Поэтому суммируем как есть.
            pendingAmount: cur.pendingAmount + safeAmount,
            pendingCount: cur.pendingCount + 1,
            hasNeedsReview: cur.hasNeedsReview || needsReview
          };
        });

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[PendingTransactions] snapshot', {
            companyId,
            pendingDocs: snap.size,
            categoriesWithPending: Object.keys(next).length,
            statusCounts,
            nanAmounts
          });
        }

        setByCategoryId(next);
      },
      (err) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[PendingTransactions] subscribe error', err);
        }
        setByCategoryId({});
      }
    );
  }, [companyId]);

  const value = useMemo(() => byCategoryId, [byCategoryId]);

  return (
    <PendingTransactionsContext.Provider value={value}>
      {children}
    </PendingTransactionsContext.Provider>
  );
}

export function usePendingSummaryByCategoryId(categoryId: string | null | undefined): PendingSummary {
  const ctx = useContext(PendingTransactionsContext);
  if (!ctx || !categoryId) return { pendingAmount: 0, pendingCount: 0, hasNeedsReview: false };
  return ctx[categoryId] ?? { pendingAmount: 0, pendingCount: 0, hasNeedsReview: false };
}

