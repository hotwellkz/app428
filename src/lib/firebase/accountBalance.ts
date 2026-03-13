/**
 * Единый расчёт баланса счёта (категории) по всем транзакциям.
 * Баланс = SUM(amount) по строкам, где amount > 0 — приход на счёт, < 0 — расход.
 * Исключаются: cancelled, reversal, строки, заменённые корректировкой (correctedFrom).
 */
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  startAfter,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

const PAGE = 500;

export type AccountBalanceResult = {
  balance: number;
  turnover: number;
  transactionCount: number;
  salaryTotal: number;
  cashlessTotal: number;
};

function isValidLedgerRow(t: {
  status?: string;
  editType?: string;
  amount?: number;
}): boolean {
  if (t.status === 'cancelled') return false;
  if (t.editType === 'reversal') return false;
  return typeof t.amount === 'number' && !Number.isNaN(t.amount);
}

/**
 * Полная выборка транзакций счёта и расчёт баланса (приход − расход по знаку amount).
 */
export async function calculateAccountBalance(
  companyId: string,
  categoryId: string
): Promise<AccountBalanceResult> {
  if (!companyId || !categoryId) {
    return {
      balance: 0,
      turnover: 0,
      transactionCount: 0,
      salaryTotal: 0,
      cashlessTotal: 0,
    };
  }

  const all: Array<{
    id: string;
    amount: number;
    correctedFrom?: string;
    status?: string;
    editType?: string;
    isSalary?: boolean;
    isCashless?: boolean;
  }> = [];

  let last: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const q = last
      ? query(
          collection(db, 'transactions'),
          where('companyId', '==', companyId),
          where('categoryId', '==', categoryId),
          orderBy('date', 'desc'),
          startAfter(last),
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

    snap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      all.push({
        id: docSnap.id,
        amount: Number(d.amount) || 0,
        correctedFrom: d.correctedFrom as string | undefined,
        status: d.status as string | undefined,
        editType: d.editType as string | undefined,
        isSalary: !!d.isSalary,
        isCashless: !!d.isCashless,
      });
    });

    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) break;
  }

  const correctedFromIds = new Set(
    all.filter((t) => t.correctedFrom).map((t) => t.correctedFrom as string)
  );

  let balance = 0;
  let turnover = 0;
  let transactionCount = 0;
  let salaryTotal = 0;
  let cashlessTotal = 0;

  for (const t of all) {
    if (!isValidLedgerRow(t)) continue;
    if (correctedFromIds.has(t.id)) continue;
    balance += t.amount;
    const abs = Math.abs(t.amount);
    turnover += abs;
    transactionCount += 1;
    if (t.isSalary) salaryTotal += abs;
    if (t.isCashless) cashlessTotal += abs;
  }

  return {
    balance,
    turnover,
    transactionCount,
    salaryTotal,
    cashlessTotal,
  };
}
