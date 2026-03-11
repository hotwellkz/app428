import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs, writeBatch, getDoc, Timestamp, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './config';
import { CategoryCardType } from '../../types';
import { formatAmount, parseAmount } from './categories';
import { sendTelegramNotification, formatTransactionMessage } from '../../services/telegramService';
import { Transaction } from '../../components/transactions/types';
import { deleteFileFromSupabase } from '../../utils/supabaseStorageUtils';
import { updateClientAggregatesOnTransaction, updateClientAggregatesOnDelete } from '../../utils/clientAggregates';
import { incrementExpenseCategoryUsage } from './expenseCategories';
import { getCanonicalCategoryId } from '../canonicalCategoryId';

interface TransactionPhoto {
  name: string;
  url: string;
  type: string;
  size: number;
  path: string;
}

type TransactionStatus = 'pending' | 'approved' | 'rejected';

/** Роль текущего пользователя из Firestore (users/{uid}.role). */
const getCurrentUserRole = async (): Promise<string | undefined> => {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) return undefined;
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userDoc.exists()) return undefined;
    return userDoc.data()?.role as string | undefined;
  } catch {
    return undefined;
  }
};

/** Статус новой транзакции: только global_admin получает approved, все остальные — pending (на одобрение). */
const getTransactionStatusForCurrentUser = async (): Promise<TransactionStatus> => {
  const role = await getCurrentUserRole();
  return role === 'global_admin' ? 'approved' : 'pending';
};

/** Может ли текущий пользователь одобрять/отклонять транзакции (только global_admin). */
const canApproveRejectTransactions = async (): Promise<boolean> => {
  const role = await getCurrentUserRole();
  return role === 'global_admin';
};

const DELETE_PASSWORD = (import.meta.env.VITE_TRANSACTION_DELETE_PASSWORD || '').trim();

export const secureDeleteTransaction = async (
  transactionId: string,
  password: string
): Promise<void> => {
  if (!DELETE_PASSWORD) {
    throw new Error('Пароль удаления транзакций не настроен');
  }
  if (!password || password !== DELETE_PASSWORD) {
    throw new Error('Неверный пароль администратора');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Необходимо войти в систему');
  }

  await deleteTransaction(transactionId, currentUser.uid);
};

interface TransferOptions {
  isSalary?: boolean;
  isCashless?: boolean;
  waybillNumber?: string;
  waybillData?: Transaction['waybillData'];
  expenseCategoryId?: string;
  skipTelegram?: boolean;
  needsReview?: boolean;
  metadata?: {
    editType?: 'reversal' | 'correction';
    reversalOf?: string;
    correctedFrom?: string;
  };
}

export const transferFunds = async ({
  sourceCategory,
  targetCategory,
  amount,
  description,
  attachments = [],
  waybillNumber,
  waybillData,
  isSalary,
  isCashless,
  expenseCategoryId,
  skipTelegram,
  needsReview,
  metadata,
  companyId
}: {
  sourceCategory: CategoryCardType;
  targetCategory: CategoryCardType;
  amount: number;
  description: string;
  attachments?: TransactionPhoto[];
  waybillNumber?: string;
  waybillData?: Transaction['waybillData'];
  isSalary?: boolean;
  isCashless?: boolean;
  expenseCategoryId?: string;
  skipTelegram?: boolean;
  needsReview?: boolean;
  companyId: string;
  metadata?: {
    editType?: 'reversal' | 'correction';
    reversalOf?: string;
    correctedFrom?: string;
  };
}): Promise<void> => {
  if (!amount || amount <= 0) {
    throw new Error('Сумма перевода должна быть больше нуля');
  }

  if (!description.trim()) {
    throw new Error('Необходимо указать комментарий к переводу');
  }
  if (!companyId) {
    throw new Error('companyId is required');
  }

  try {
    const status: TransactionStatus = await getTransactionStatusForCurrentUser();

    await runTransaction(db, async (transaction) => {
      const sourceRef = doc(db, 'categories', sourceCategory.id);
      const targetRef = doc(db, 'categories', targetCategory.id);
      
      const sourceDoc = await transaction.get(sourceRef);
      const targetDoc = await transaction.get(targetRef);

      if (!sourceDoc.exists()) {
        throw new Error('Категория отправителя не найдена');
      }

      if (!targetDoc.exists()) {
        throw new Error('Категория получателя не найдена');
      }

      const sourceBalance = parseAmount(sourceDoc.data().amount);
      const targetBalance = parseAmount(targetDoc.data().amount);

      // Создаем ID для транзакции заранее
      const withdrawalId = doc(collection(db, 'transactions')).id;
      const depositId = doc(collection(db, 'transactions')).id;

      const timestamp = serverTimestamp();
      
      const withdrawalData: Record<string, unknown> = {
        categoryId: sourceCategory.id,
        fromUser: sourceCategory.title,
        toUser: targetCategory.title,
        amount: -amount,
        description,
        type: 'expense',
        date: timestamp,
        relatedTransactionId: depositId,
        attachments,
        waybillNumber,
        waybillData,
        isSalary,
        isCashless,
        needsReview: !!needsReview,
        status,
        companyId
      };
      if (expenseCategoryId) {
        withdrawalData.expenseCategoryId = expenseCategoryId;
      }

      if (metadata) {
        if (metadata.editType) {
          withdrawalData.editType = metadata.editType;
        }
        if (metadata.reversalOf) {
          withdrawalData.reversalOf = metadata.reversalOf;
        }
        if (metadata.correctedFrom) {
          withdrawalData.correctedFrom = metadata.correctedFrom;
        }
      }

      // Данные для пополнения средств
      const depositData = {
        ...withdrawalData,
        categoryId: targetCategory.id,
        amount: amount,
        type: 'income',
        relatedTransactionId: withdrawalId,
      };
      
      transaction.set(doc(db, 'transactions', withdrawalId), withdrawalData);
      transaction.set(doc(db, 'transactions', depositId), depositData);
      // Балансы категорий меняем только для одобренных транзакций
      if (status === 'approved') {
        transaction.update(sourceRef, {
          amount: formatAmount(sourceBalance - amount)
        });

        transaction.update(targetRef, {
          amount: formatAmount(targetBalance + amount)
        });
      }

      if (!skipTelegram) {
        try {
          const message = formatTransactionMessage(
            sourceCategory.title,
            targetCategory.title,
            amount,
            description,
            'expense',
            waybillNumber
          );
          await sendTelegramNotification(message);
        } catch (error) {
          console.error('Error sending Telegram notification:', error);
        }
      }
    });

    // Для PENDING-транзакций агрегаты и usage не трогаем — они применятся при одобрении
    if (status === 'approved') {
      const transactionDate = Timestamp.now();

      try {
        await updateClientAggregatesOnTransaction(
          sourceCategory.id,
          -amount,
          transactionDate,
          companyId
        );
      } catch (error) {
        console.error('Error updating client aggregates for source:', error);
      }

      try {
        await updateClientAggregatesOnTransaction(
          targetCategory.id,
          amount,
          transactionDate,
          companyId
        );
      } catch (error) {
        console.error('Error updating client aggregates for target:', error);
      }

      if (expenseCategoryId) {
        try {
          await incrementExpenseCategoryUsage(expenseCategoryId);
        } catch (error) {
          console.error('Error incrementing expense category usage:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error in transferFunds:', error);
    throw error;
  }
};

interface TransactionEditLogPayload {
  transactionId: string;
  before: {
    from: string;
    to: string;
    amount: number;
    comment: string;
    category: string | null;
    isSalary?: boolean;
    isCashless?: boolean;
    needsReview?: boolean;
  };
  after: {
    from: string;
    to: string;
    amount: number;
    comment: string;
    category: string | null;
    isSalary?: boolean;
    isCashless?: boolean;
    needsReview?: boolean;
  };
}

export const createTransactionEditLog = async ({
  transactionId,
  before,
  after
}: TransactionEditLogPayload): Promise<void> => {
  const logsRef = collection(db, 'transaction_edit_logs');
  await addDoc(logsRef, {
    transactionId,
    editedAt: serverTimestamp(),
    editedBy: 'feed-password-mode',
    before,
    after
  });
};

export const createReversalTransaction = async (transactionId: string): Promise<void> => {
  const transactionRef = doc(db, 'transactions', transactionId);
  const transactionSnap = await getDoc(transactionRef);

  if (!transactionSnap.exists()) {
    throw new Error('Исходная транзакция не найдена');
  }

  const original = transactionSnap.data() as Transaction & { relatedTransactionId?: string };

  if (original.type !== 'expense') {
    throw new Error('Отменять можно только расходные транзакции');
  }

  if (!original.relatedTransactionId) {
    throw new Error('У транзакции нет связанной операции для отмены');
  }

  const relatedRef = doc(db, 'transactions', original.relatedTransactionId);
  const relatedSnap = await getDoc(relatedRef);

  if (!relatedSnap.exists()) {
    throw new Error('Связанная транзакция не найдена');
  }

  const related = relatedSnap.data() as Transaction;

  const amount = Math.abs(original.amount);

  const sourceCategory: CategoryCardType = {
    id: related.categoryId,
    title: related.fromUser,
    amount: '0 ₸',
    iconName: '',
    color: '#000000'
  };

  const targetCategory: CategoryCardType = {
    id: original.categoryId,
    title: original.fromUser,
    amount: '0 ₸',
    iconName: '',
    color: '#000000'
  };

  const companyId = (original as any).companyId;
  if (!companyId) throw new Error('Transaction has no companyId');
  await transferFunds({
    sourceCategory,
    targetCategory,
    amount,
    description: `Отмена транзакции: ${original.description}`,
    attachments: [],
    waybillNumber: original.waybillNumber,
    waybillData: original.waybillData,
    isSalary: original.isSalary,
    isCashless: original.isCashless,
    expenseCategoryId: original.expenseCategoryId,
    skipTelegram: true,
    companyId,
    metadata: {
      editType: 'reversal',
      reversalOf: transactionId
    }
  });

  // Помечаем оригинал и связанную запись как отменённые (для бейджа в ленте)
  await updateDoc(transactionRef, { reversedAt: serverTimestamp() });
  await updateDoc(relatedRef, { reversedAt: serverTimestamp() });
};

export const createCorrectionTransaction = async (
  sourceCategory: CategoryCardType,
  targetCategory: CategoryCardType,
  amount: number,
  description: string,
  originalTransactionId: string,
  expenseCategoryId?: string,
  companyId: string
): Promise<void> => {
  await transferFunds({
    sourceCategory,
    targetCategory,
    amount,
    description,
    attachments: [],
    waybillNumber: undefined,
    waybillData: undefined,
    isSalary: false,
    isCashless: false,
    expenseCategoryId,
    skipTelegram: true,
    companyId,
    metadata: {
      editType: 'correction',
      correctedFrom: originalTransactionId
    }
  });
};

export const editFeedTransaction = async (params: {
  originalTransactionId: string;
  newFromCategory: CategoryCardType;
  newToCategory: CategoryCardType;
  newAmount: number;
  newDescription: string;
  newIsSalary?: boolean;
  newIsCashless?: boolean;
  newNeedsReview?: boolean;
  audit: TransactionEditLogPayload;
}): Promise<void> => {
  const {
    originalTransactionId,
    newFromCategory,
    newToCategory,
    newAmount,
    newDescription,
    newIsSalary,
    newIsCashless,
    newNeedsReview,
    audit
  } = params;

  if (!newAmount || newAmount <= 0) {
    throw new Error('Сумма перевода должна быть больше нуля');
  }
  if (!newDescription.trim()) {
    throw new Error('Необходимо указать комментарий к переводу');
  }

  const nowForAggregates = Timestamp.now();

  // Для агрегатов клиентов (row === 1) обновляем как при создании транзакций (4 события: reversal+correction)
  const postCommitAggregateUpdates: Array<Promise<void>> = [];

  await runTransaction(db, async (tx) => {
    // ====================
    // 1. READ PHASE
    // ====================

    const originalRef = doc(db, 'transactions', originalTransactionId);
    const originalSnap = await tx.get(originalRef);
    if (!originalSnap.exists()) {
      throw new Error('Исходная транзакция не найдена');
    }

    const original = originalSnap.data() as Transaction & { relatedTransactionId?: string; categoryId: string };
    if (original.type !== 'expense') {
      throw new Error('Редактировать можно только расходные транзакции');
    }
    if (!original.relatedTransactionId) {
      throw new Error('У транзакции нет связанной операции');
    }

    const relatedRef = doc(db, 'transactions', original.relatedTransactionId);
    const relatedSnap = await tx.get(relatedRef);
    if (!relatedSnap.exists()) {
      throw new Error('Связанная транзакция не найдена');
    }
    const related = relatedSnap.data() as Transaction & { categoryId: string };

    const oldFromCategoryId = original.categoryId;
    const oldToCategoryId = related.categoryId;

    const oldAmount = Math.abs(Number(original.amount));
    const oldFromTitle = original.fromUser;
    const oldToTitle = original.toUser;

    // Готовим изменения балансов по categoryId
    const balanceDeltaByCategoryId = new Map<string, number>();
    const addDelta = (categoryId: string, delta: number) => {
      balanceDeltaByCategoryId.set(categoryId, (balanceDeltaByCategoryId.get(categoryId) ?? 0) + delta);
    };

    // reversal: oldTo -> oldFrom (undo old transfer)
    addDelta(oldToCategoryId, -oldAmount);
    addDelta(oldFromCategoryId, +oldAmount);

    // correction: newFrom -> newTo
    addDelta(newFromCategory.id, -newAmount);
    addDelta(newToCategory.id, +newAmount);

    // Читаем текущие балансы всех затронутых категорий
    const currentAmounts = new Map<string, number>();
    const categoryIdsToRead = Array.from(balanceDeltaByCategoryId.keys());
    for (const categoryId of categoryIdsToRead) {
      const categoryRef = doc(db, 'categories', categoryId);
      const categorySnap = await tx.get(categoryRef);
      if (!categorySnap.exists()) {
        throw new Error('Категория не найдена');
      }
      currentAmounts.set(categoryId, parseAmount(categorySnap.data().amount));
    }

    // ====================
    // 2. WRITE PHASE
    // ====================

    const timestamp = serverTimestamp();

    // 1) Помечаем старую пару отменённой
    const cancelPatch: Record<string, unknown> = {
      status: 'cancelled',
      cancelledAt: timestamp,
      cancelledBy: 'feed-password-mode',
      cancelledReason: 'edited'
    };
    tx.update(originalRef, cancelPatch);
    tx.update(relatedRef, cancelPatch);

    // 2) Создаём reversal транзакции (2 записи)
    const reversalWithdrawalId = doc(collection(db, 'transactions')).id;
    const reversalDepositId = doc(collection(db, 'transactions')).id;

    const companyId = (original as any).companyId;
    if (!companyId) throw new Error('Transaction has no companyId');
    const reversalBase: Record<string, unknown> = {
      fromUser: oldToTitle,
      toUser: oldFromTitle,
      description: `Отмена транзакции: ${original.description}`,
      date: timestamp,
      editType: 'reversal',
      reversalOf: originalTransactionId,
      companyId
    };

    tx.set(doc(db, 'transactions', reversalWithdrawalId), {
      ...reversalBase,
      categoryId: oldToCategoryId,
      amount: -oldAmount,
      type: 'expense',
      relatedTransactionId: reversalDepositId,
      attachments: []
    });
    tx.set(doc(db, 'transactions', reversalDepositId), {
      ...reversalBase,
      categoryId: oldFromCategoryId,
      amount: oldAmount,
      type: 'income',
      relatedTransactionId: reversalWithdrawalId,
      attachments: []
    });

    // 3) Создаём correction транзакции (2 записи)
    const correctionWithdrawalId = doc(collection(db, 'transactions')).id;
    const correctionDepositId = doc(collection(db, 'transactions')).id;

    const correctionBase: Record<string, unknown> = {
      fromUser: newFromCategory.title,
      toUser: newToCategory.title,
      description: newDescription.trim(),
      date: timestamp,
      feedSortDate: original.date,
      editType: 'correction',
      correctedFrom: originalTransactionId,
      isSalary: newIsSalary ?? original.isSalary ?? false,
      isCashless: newIsCashless ?? original.isCashless ?? false,
      needsReview: newNeedsReview ?? original.needsReview ?? false,
      status: original.status === 'rejected' ? 'rejected' : 'approved',
      companyId
    };

    const fromCategoryId = getCanonicalCategoryId(newFromCategory);
    const toCategoryId = getCanonicalCategoryId(newToCategory);
    // Расход: categoryId = счёт «откуда» — попадёт в историю операций счёта newFromCategory
    tx.set(doc(db, 'transactions', correctionWithdrawalId), {
      ...correctionBase,
      categoryId: fromCategoryId,
      amount: -newAmount,
      type: 'expense',
      relatedTransactionId: correctionDepositId,
      attachments: []
    });
    // Приход: categoryId = счёт «куда» — попадёт в историю операций счёта newToCategory (/transactions/history/:id)
    const incomeDocData = {
      ...correctionBase,
      categoryId: toCategoryId,
      amount: newAmount,
      type: 'income',
      relatedTransactionId: correctionWithdrawalId,
      attachments: []
    };
    if (process.env.NODE_ENV === 'development') {
      (window as any).__lastCorrectionIncomeCategoryId = toCategoryId;
      (window as any).__lastCorrectionIncomeCategoryTitle = newToCategory.title;
      console.log('CORRECTION DOC CREATED', {
        docId: correctionDepositId,
        categoryId: toCategoryId,
        categoryTitle: newToCategory.title,
        type: 'income',
        status: correctionBase.status,
        editType: correctionBase.editType,
        correctedFrom: correctionBase.correctedFrom
      });
      console.log('CORRECTION INCOME DOC FULL', {
        docId: correctionDepositId,
        categoryId: toCategoryId,
        categoryTitle: newToCategory.title,
        fromUser: correctionBase.fromUser,
        toUser: correctionBase.toUser,
        correctedFrom: correctionBase.correctedFrom,
        editType: correctionBase.editType,
        status: correctionBase.status,
        needsReview: correctionBase.needsReview,
        date: 'serverTimestamp',
        newFromCategoryId: typeof newFromCategory.id === 'string' ? newFromCategory.id : String(newFromCategory.id),
        newToCategoryId: toCategoryId,
        fullPayload: { ...incomeDocData, date: '[serverTimestamp]' }
      });
    }
    tx.set(doc(db, 'transactions', correctionDepositId), incomeDocData);

    // 4) Audit log (в той же транзакции)
    const logRef = doc(collection(db, 'transaction_edit_logs'));
    tx.set(logRef, {
      transactionId: audit.transactionId,
      editedAt: timestamp,
      editedBy: 'feed-password-mode',
      before: audit.before,
      after: audit.after
    });

    // 5) Обновляем балансы всех затронутых категорий
    for (const [categoryId, delta] of balanceDeltaByCategoryId.entries()) {
      const categoryRef = doc(db, 'categories', categoryId);
      const current = currentAmounts.get(categoryId) ?? 0;
      tx.update(categoryRef, {
        amount: formatAmount(current + delta),
        updatedAt: timestamp
      });
    }

    // Пост-коммит обновления агрегатов (сохраняем промисы, выполним после транзакции)
    // reversal events:
    postCommitAggregateUpdates.push(updateClientAggregatesOnTransaction(oldToCategoryId, -oldAmount, nowForAggregates, companyId));
    postCommitAggregateUpdates.push(updateClientAggregatesOnTransaction(oldFromCategoryId, oldAmount, nowForAggregates, companyId));
    // correction events:
    postCommitAggregateUpdates.push(updateClientAggregatesOnTransaction(newFromCategory.id, -newAmount, nowForAggregates, companyId));
    postCommitAggregateUpdates.push(updateClientAggregatesOnTransaction(newToCategory.id, newAmount, nowForAggregates, companyId));
  });

  // Не блокируем UX на агрегатах — они best-effort
  await Promise.allSettled(postCommitAggregateUpdates);
};

export const approveTransaction = async (transactionId: string): Promise<void> => {
  if (!transactionId) throw new Error('ID транзакции обязателен');

  const canApprove = await canApproveRejectTransactions();
  if (!canApprove) {
    throw new Error('У вас нет прав для одобрения транзакций');
  }

  await runTransaction(db, async (tx) => {
    const expenseRef = doc(db, 'transactions', transactionId);
    const expenseSnap = await tx.get(expenseRef);
    if (!expenseSnap.exists()) throw new Error('Транзакция не найдена');

    const expense = expenseSnap.data() as any;
    if (expense.type !== 'expense') {
      throw new Error('Одобрять можно только расходные транзакции');
    }
    const currentStatus: TransactionStatus = expense.status ?? 'approved';
    if (currentStatus === 'approved') {
      throw new Error('Транзакция уже одобрена');
    }
    if (currentStatus === 'rejected') {
      throw new Error('Нельзя одобрить отклонённую транзакцию');
    }

    const relatedId = expense.relatedTransactionId;
    if (!relatedId) throw new Error('У транзакции нет связанной операции');

    const incomeRef = doc(db, 'transactions', relatedId);
    const incomeSnap = await tx.get(incomeRef);
    if (!incomeSnap.exists()) throw new Error('Связанная транзакция не найдена');
    const income = incomeSnap.data() as any;

    const amount = Math.abs(Number(expense.amount));
    const sourceCategoryId = expense.categoryId as string;
    const targetCategoryId = income.categoryId as string;

    const sourceRef = doc(db, 'categories', sourceCategoryId);
    const targetRef = doc(db, 'categories', targetCategoryId);
    const sourceSnap = await tx.get(sourceRef);
    const targetSnap = await tx.get(targetRef);
    if (!sourceSnap.exists() || !targetSnap.exists()) {
      throw new Error('Категория отправителя или получателя не найдена');
    }

    const sourceBalance = parseAmount(sourceSnap.data().amount);
    const targetBalance = parseAmount(targetSnap.data().amount);

    const timestamp = serverTimestamp();

    tx.update(sourceRef, {
      amount: formatAmount(sourceBalance - amount),
      updatedAt: timestamp
    });
    tx.update(targetRef, {
      amount: formatAmount(targetBalance + amount),
      updatedAt: timestamp
    });

    tx.update(expenseRef, {
      status: 'approved',
      approvedAt: timestamp,
      approvedBy: currentEmail
    });
    tx.update(incomeRef, {
      status: 'approved',
      approvedAt: timestamp,
      approvedBy: currentEmail
    });
  });

  // После успешного применения — обновляем агрегаты и usage
  const expenseSnap = await getDoc(doc(db, 'transactions', transactionId));
  if (!expenseSnap.exists()) return;
  const expense = expenseSnap.data() as any;
  const relatedId = expense.relatedTransactionId as string | undefined;
  if (!relatedId) return;
  const incomeSnap = await getDoc(doc(db, 'transactions', relatedId));
  if (!incomeSnap.exists()) return;
  const income = incomeSnap.data() as any;

  const amount = Math.abs(Number(expense.amount));
  const transactionDate = Timestamp.now();

  const companyId = expense.companyId;
  if (companyId) {
  try {
    await updateClientAggregatesOnTransaction(
      expense.categoryId,
      -amount,
      transactionDate,
      companyId
    );
  } catch (error) {
    console.error('Error updating client aggregates for approved source:', error);
  }

  try {
    await updateClientAggregatesOnTransaction(
      income.categoryId,
      amount,
      transactionDate,
      companyId
    );
  } catch (error) {
    console.error('Error updating client aggregates for approved target:', error);
  }
  }

  if (expense.expenseCategoryId) {
    try {
      await incrementExpenseCategoryUsage(expense.expenseCategoryId);
    } catch (error) {
      console.error('Error incrementing expense category usage on approve:', error);
    }
  }
};

export const rejectTransaction = async (transactionId: string): Promise<void> => {
  if (!transactionId) throw new Error('ID транзакции обязателен');

  const canReject = await canApproveRejectTransactions();
  if (!canReject) {
    throw new Error('У вас нет прав для отклонения транзакций');
  }

  await runTransaction(db, async (tx) => {
    // 1. READ PHASE: все get до любых write
    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await tx.get(txRef);
    if (!txSnap.exists()) throw new Error('Транзакция не найдена');
    const data = txSnap.data() as any;
    const currentStatus: TransactionStatus = data.status ?? 'approved';
    if (currentStatus === 'approved') {
      throw new Error('Нельзя отклонить уже одобренную транзакцию');
    }
    if (currentStatus === 'rejected') {
      return;
    }

    const relatedId = data.relatedTransactionId as string | undefined;
    let relatedSnap: Awaited<ReturnType<typeof tx.get>> | null = null;
    if (relatedId) {
      const relatedRef = doc(db, 'transactions', relatedId);
      relatedSnap = await tx.get(relatedRef);
    }

    const timestamp = serverTimestamp();

    // 2. WRITE PHASE: только update/set после всех read
    tx.update(txRef, {
      status: 'rejected',
      rejectedAt: timestamp,
      rejectedBy: currentEmail
    });

    if (relatedId && relatedSnap?.exists()) {
      const relatedRef = doc(db, 'transactions', relatedId);
      tx.update(relatedRef, {
        status: 'rejected',
        rejectedAt: timestamp,
        rejectedBy: currentEmail
      });
    }
  });
};
export const deleteTransaction = async (transactionId: string, userId: string): Promise<void> => {
  if (!transactionId) {
    throw new Error('ID транзакции обязателен');
  }

  if (!userId) {
    throw new Error('ID пользователя обязателен');
  }

  try {
    console.log('[DELETE TX START]', {
      transactionId,
      userId
    });
    // Проверяем роль пользователя
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('Пользователь не найден');
    }

    const userRole = userDoc.data().role;
    if (userRole !== 'admin') {
      throw new Error('Только администратор может удалять транзакции');
    }

    const batch = writeBatch(db);
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error('Транзакция не найдена');
    }

    const transactionData = transactionSnap.data();
    const relatedTransactionId = transactionData.relatedTransactionId;
    const categoryId = transactionData.categoryId;
    const amount = Number(transactionData.amount);

    // Удаляем прикрепленные файлы из Supabase
    if (transactionData.attachments && transactionData.attachments.length > 0) {
      for (const attachment of transactionData.attachments) {
        try {
          await deleteFileFromSupabase(attachment.path);
        } catch (error) {
          console.error('Error deleting file from Supabase:', error);
          // Продолжаем удаление других файлов даже если один не удалился
        }
      }
    }

    batch.delete(transactionRef);

    const companyId = transactionData.companyId;

    // Обновляем агрегаты для клиента перед удалением транзакции
    try {
      await updateClientAggregatesOnDelete(categoryId, amount, companyId);
    } catch (error) {
      console.error('Error updating client aggregates on delete:', error);
      // Не прерываем выполнение, если обновление агрегатов не удалось
    }

    // Получаем текущий баланс категории
    const categoryRef = doc(db, 'categories', categoryId);
    const categorySnap = await getDoc(categoryRef);

    if (categorySnap.exists()) {
      const currentAmount = parseAmount(categorySnap.data().amount);
      // При удалении:
      // Для расхода (amount отрицательный) - прибавляем модуль суммы
      // Для дохода (amount положительный) - вычитаем сумму
      const newAmount = currentAmount + (amount * -1);

      batch.update(categoryRef, {
        amount: formatAmount(newAmount),
        updatedAt: serverTimestamp()
      });
    }

    // Ищем связанные транзакции двумя способами:
    // 1. Транзакции, на которые ссылается текущая
    // 2. Транзакции, которые ссылаются на текущую
    let relatedTransaction = null;

    // 1. Проверяем транзакцию, на которую ссылается текущая
    if (relatedTransactionId) {
      const relatedRef = doc(db, 'transactions', relatedTransactionId);
      const relatedSnap = await getDoc(relatedRef);
      if (relatedSnap.exists()) {
        relatedTransaction = { ...relatedSnap.data(), id: relatedSnap.id };
      }
    }

    // 2. Ищем транзакции, которые ссылаются на текущую (только в своей компании)
    if (!relatedTransaction && companyId) {
      const relatedQuery = query(
        collection(db, 'transactions'),
        where('companyId', '==', companyId),
        where('relatedTransactionId', '==', transactionId)
      );
      const relatedQuerySnap = await getDocs(relatedQuery);
      if (!relatedQuerySnap.empty) {
        const doc = relatedQuerySnap.docs[0];
        relatedTransaction = { ...doc.data(), id: doc.id };
      }
    }

    // Если нашли связанную транзакцию, удаляем её и обновляем баланс её категории
    if (relatedTransaction) {
      const relatedRef = doc(db, 'transactions', relatedTransaction.id);

      // Удаляем прикрепленные файлы связанной транзакции
      if (relatedTransaction.attachments && relatedTransaction.attachments.length > 0) {
        for (const attachment of relatedTransaction.attachments) {
          try {
            await deleteFileFromSupabase(attachment.path);
          } catch (error) {
            console.error('Error deleting related transaction file from Supabase:', error);
            // Продолжаем удаление других файлов даже если один не удалился
          }
        }
      }

      batch.delete(relatedRef);

      try {
        await updateClientAggregatesOnDelete(
          relatedTransaction.categoryId,
          relatedTransaction.amount,
          (relatedTransaction as any).companyId
        );
      } catch (error) {
        console.error('Error updating client aggregates for related transaction:', error);
      }

      const relatedCategoryRef = doc(db, 'categories', relatedTransaction.categoryId);
      const relatedCategorySnap = await getDoc(relatedCategoryRef);

      if (relatedCategorySnap.exists()) {
        const currentAmount = parseAmount(relatedCategorySnap.data().amount);
        const relatedAmount = Number(relatedTransaction.amount);
        const newAmount = currentAmount + (relatedAmount * -1);

        batch.update(relatedCategoryRef, {
          amount: formatAmount(newAmount),
          updatedAt: serverTimestamp()
        });
      }
    }

    console.log('[DELETE TX RELATED]', {
      transactionId,
      categoryId,
      amount,
      relatedTransactionId,
      transactionData,
      relatedTransaction
    });

    await batch.commit();

    // Если это складская операция, откатываем количество товаров на складе.
    // Источник истины — категория "Склад" (row === 4). Откатываем ТОЛЬКО ту
    // транзакцию из пары, которая относится к этой категории, чтобы избежать
    // двойного rollback при isWarehouseOperation=true на обеих сторонах.
    const isPotentialWarehouseOp =
      (transactionData && transactionData.isWarehouseOperation) ||
      (relatedTransaction && relatedTransaction.isWarehouseOperation);

    if (isPotentialWarehouseOp) {
      // Находим все категории склада (обычно одна)
      const warehouseCategoriesSnap = await getDocs(
        query(
          collection(db, 'categories'),
          where('title', '==', 'Склад'),
          where('row', '==', 4)
        )
      );
      const warehouseCategoryIds = new Set<string>(
        warehouseCategoriesSnap.docs.map((d) => d.id)
      );

      const rollbackWarehouseForTransaction = async (txData: any, label: 'primary' | 'related') => {
        if (
          !txData ||
          !txData.isWarehouseOperation ||
          !txData.waybillData ||
          !Array.isArray(txData.waybillData.items)
        ) {
          return;
        }

        const categoryIdForTx = txData.categoryId as string | undefined;
        if (!categoryIdForTx || !warehouseCategoryIds.has(categoryIdForTx)) {
          // Это не категория склада → на склад не влияет
          return;
        }

        const txType = txData.type as string | undefined;
        const items: any[] = txData.waybillData.items;

        console.log('[ROLLBACK CALL]', {
          caller: 'deleteTransaction',
          label,
          txId: (txData as any).id || transactionId,
          categoryId: categoryIdForTx,
          type: txType,
          isWarehouseOperation: txData.isWarehouseOperation,
          waybillNumber: txData.waybillNumber,
          itemCount: items.length
        });

        await Promise.all(
          items.map(async (item) => {
            const name = item.product?.name;
            const unit = item.product?.unit;
            const qty = Number(item.quantity) || 0;
            if (!name || !unit || !qty) return;

            // Ищем товар по имени и единице измерения
            const productsQuery = query(
              collection(db, 'products'),
              where('name', '==', name),
              where('unit', '==', unit)
            );
            const productsSnap = await getDocs(productsQuery);
            if (productsSnap.empty) {
              console.warn('Product for rollback not found', { name, unit });
              return;
            }

            const productDoc = productsSnap.docs[0];
            const productRef = productDoc.ref;

            await runTransaction(db, async (tx) => {
              const freshSnap = await tx.get(productRef);
              if (!freshSnap.exists()) return;
              const freshData = freshSnap.data() as any;
              const freshQty = Number(freshData.quantity) || 0;

              // Для расхода склада (type='expense'): при создании qty уменьшали → при удалении увеличиваем
              // Для прихода на склад (type='income'): при создании qty увеличивали → при удалении уменьшаем
              const delta = txType === 'expense' ? qty : txType === 'income' ? -qty : 0;
              const finalQty = freshQty + delta;

              console.log('[WAREHOUSE MUTATION]', {
                source: 'deleteTransaction.rollbackWarehouseForTransaction',
                label,
                productId: productDoc.id,
                productName: freshData.name,
                beforeQty: freshQty,
                delta,
                afterQty: finalQty,
                transactionId,
                txType,
                categoryId: categoryIdForTx,
                fromUser: txData.fromUser,
                toUser: txData.toUser,
                isWarehouseOperation: txData.isWarehouseOperation
              });

              tx.update(productRef, {
                quantity: finalQty,
                updatedAt: serverTimestamp()
              });
            });
          })
        );
      };

      try {
        await rollbackWarehouseForTransaction(transactionData, 'primary');
        if (relatedTransaction) {
          await rollbackWarehouseForTransaction(relatedTransaction, 'related');
        }
      } catch (warehouseError) {
        console.error('Error rolling back warehouse quantities on delete:', warehouseError);
      }
    }
  } catch (error) {
    console.error('Error in deleteTransaction:', error);
    throw error;
  }
};