/**
 * Сумма на иконке счёта на /transactions:
 * - project: SUM(|amount|) по всем операциям счёта (общий расход проекта)
 * - иначе: не считаем здесь — остаётся categories.amount (чистый баланс)
 */
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

const PAGE = 500;

export type CategoryKind = 'project' | 'employee' | 'system' | 'client';

/** Поле type в Firestore + запас по row (ряд интерфейса) */
export function categoryKind(category: {
  type?: string;
  row?: number;
}): CategoryKind {
  const t = (category.type || '').toLowerCase();
  if (t === 'project') return 'project';
  if (t === 'employee') return 'employee';
  if (t === 'system') return 'system';
  if (category.row === 3) return 'project';
  if (category.row === 2) return 'employee';
  if (category.row === 4) return 'system';
  if (category.row === 1) return 'client';
  return 'client';
}

export function isProjectCategory(category: { type?: string; row?: number }): boolean {
  return categoryKind(category) === 'project';
}

type Tx = {
  id: string;
  amount?: number;
  status?: string;
  editType?: string;
  correctedFrom?: string;
};

/** Транзакция учитывается в балансе/сумме счёта только если одобрена (или без статуса — legacy). */
function isApprovedForBalance(t: Tx): boolean {
  return t.status === undefined || t.status === 'approved';
}

function applyLedgerFilters(raw: Tx[]): Tx[] {
  const correctedFromIds = new Set(
    raw.filter((t) => t.correctedFrom).map((t) => t.correctedFrom as string)
  );
  return raw.filter(
    (t) =>
      isApprovedForBalance(t) &&
      t.status !== 'cancelled' &&
      t.editType !== 'reversal' &&
      !correctedFromIds.has(t.id)
  );
}

/** SUM(|amount|) по счёту — для проектов (расход проекта) */
export async function sumAbsAmountByCategory(
  companyId: string,
  categoryId: string
): Promise<number> {
  let sum = 0;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  for (;;) {
    const q = lastDoc
      ? query(
          collection(db, 'transactions'),
          where('companyId', '==', companyId),
          where('categoryId', '==', categoryId),
          orderBy('date', 'desc'),
          startAfter(lastDoc),
          limit(PAGE)
        )
      : query(
          collection(db, 'transactions'),
          where('companyId', '==', companyId),
          where('categoryId', '==', categoryId),
          orderBy('date', 'desc'),
          limit(PAGE)
        );

    const snap = await getDocs(q);
    if (snap.empty) break;

    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Tx[];
    for (const t of applyLedgerFilters(raw)) {
      sum += Math.abs(Number(t.amount) || 0);
    }

    if (snap.docs.length < PAGE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return sum;
}
