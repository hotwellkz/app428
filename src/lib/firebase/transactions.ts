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
import { getCompanyUser } from './companies';

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

/**
 * Статус новой транзакции при создании.
 * approved: global_admin всегда; owner — только для транзакций своей компании (companyId совпадает).
 * Иначе pending (требует одобрения).
 * Экспортируется для использования в NewIncome/NewExpense.
 */
export const getTransactionStatusForCompany = async (transactionCompanyId: string): Promise<TransactionStatus> => {
  const globalRole = await getCurrentUserRole();
  if (globalRole === 'global_admin') return 'approved';

  const uid = auth.currentUser?.uid;
  if (!uid) return 'pending';
  try {
    const cu = await getCompanyUser(uid);
    if (cu?.role === 'owner' && cu.companyId === transactionCompanyId) return 'approved';
  } catch {
    // ignore
  }
  return 'pending';
};

/** Может ли текущий пользователь одобрять/отклонять транзакции: global_admin, owner своей компании или право approveTransactions. */
const canApproveRejectTransactions = async (transactionCompanyId?: string): Promise<boolean> => {
  const globalRole = await getCurrentUserRole();
  if (globalRole === 'global_admin') return true;

  if (!transactionCompanyId) return false;
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  try {
    const cu = await getCompanyUser(uid);
    if (!cu || cu.companyId !== transactionCompanyId) return false;
    if (cu.role === 'owner') return true;
    return cu.permissions?.approveTransactions === true;
  } catch {
    return false;
  }
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

interface FuelData {
  vehicleId: string;
  vehicleName: string;
  odometerKm: number;
  liters?: number | null;
  pricePerLiter?: number | null;
  fuelType?: string | null;
  gasStation?: string | null;
  isFullTank?: boolean;
  receiptRecognized?: boolean;
  receiptFileUrl?: string | null;
  receiptRef?: string | null;
  recognizedAt?: unknown;
  recognizedSource?: 'ai' | 'manual';
  derivedFuelStats?: {
    previousFuelTransactionId?: string | null;
    previousOdometerKm?: number | null;
    distanceSincePrevFuelingKm?: number | null;
    estimatedConsumptionLPer100?: number | null;
    status: 'normal' | 'warning' | 'critical' | 'insufficient_data';
    note?: string | null;
  } | null;
}

const FUEL_CONSUMPTION_NORMAL_MAX = 14.5;
const FUEL_CONSUMPTION_WARNING_MAX = 15.5;

async function computeDerivedFuelStats(
  companyId: string,
  fuelData: FuelData
): Promise<FuelData['derivedFuelStats']> {
  const liters = fuelData.liters ?? null;
  const currentOdo = fuelData.odometerKm;
  if (!companyId || liters == null || !Number.isFinite(liters) || !Number.isFinite(currentOdo)) {
    return {
      previousFuelTransactionId: null,
      previousOdometerKm: null,
      distanceSincePrevFuelingKm: null,
      estimatedConsumptionLPer100: null,
      status: 'insufficient_data',
      note: 'Недостаточно данных для расчёта расхода топлива'
    };
  }

  try {
    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      where('type', '==', 'expense'),
      where('status', '==', 'approved'),
      where('fuelData.vehicleId', '==', fuelData.vehicleId || ''),
      orderBy('date', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return {
        previousFuelTransactionId: null,
        previousOdometerKm: null,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Не найдена предыдущая заправка для этой машины'
      };
    }
    const prevDoc = snap.docs[0];
    const prevData = prevDoc.data() as Transaction & { fuelData?: FuelData };
    const prevFuel = prevData.fuelData;
    const prevOdo = prevFuel?.odometerKm;
    if (!Number.isFinite(prevOdo)) {
      return {
        previousFuelTransactionId: prevDoc.id,
        previousOdometerKm: null,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'У предыдущей заправки не указан пробег'
      };
    }
    const distance = currentOdo - prevOdo!;
    if (!Number.isFinite(distance) || distance <= 0) {
      return {
        previousFuelTransactionId: prevDoc.id,
        previousOdometerKm: prevOdo!,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Текущий пробег меньше или равен предыдущему'
      };
    }
    const distanceRounded = Math.round(distance * 10) / 10;
    const consumptionRaw = (liters / distance) * 100;
    const consumption = Math.round(consumptionRaw * 10) / 10;

    let status: 'normal' | 'warning' | 'critical';
    if (consumption <= FUEL_CONSUMPTION_NORMAL_MAX) status = 'normal';
    else if (consumption <= FUEL_CONSUMPTION_WARNING_MAX) status = 'warning';
    else status = 'critical';

    return {
      previousFuelTransactionId: prevDoc.id,
      previousOdometerKm: prevOdo!,
      distanceSincePrevFuelingKm: distanceRounded,
      estimatedConsumptionLPer100: consumption,
      status,
      note: null
    };
  } catch (e) {
    console.error('[fuel] computeDerivedFuelStats failed', e);
    return {
      previousFuelTransactionId: null,
      previousOdometerKm: null,
      distanceSincePrevFuelingKm: null,
      estimatedConsumptionLPer100: null,
      status: 'insufficient_data',
      note: 'Ошибка при расчёте расхода топлива'
    };
  }
}

interface TransferOptions {
  isSalary?: boolean;
  isCashless?: boolean;
  waybillNumber?: string;
  waybillData?: Transaction['waybillData'];
  expenseCategoryId?: string;
  skipTelegram?: boolean;
  needsReview?: boolean;
  fuelData?: FuelData;
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
  fuelData,
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
  fuelData?: FuelData;
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
    let enrichedFuelData: FuelData | undefined = fuelData;
    if (fuelData && companyId) {
      const derived = await computeDerivedFuelStats(companyId, fuelData);
      enrichedFuelData = { ...fuelData, derivedFuelStats: derived };
    }

    const status: TransactionStatus = await getTransactionStatusForCompany(companyId);

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

      if (enrichedFuelData) {
        withdrawalData.fuelData = enrichedFuelData;
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
          await sendTelegramNotification(message, { parseMode: 'HTML' });
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

export type TransactionEditLogBeforeAfter = {
  from: string;
  to: string;
  amount: number;
  comment: string;
  category: string | null;
  isSalary?: boolean;
  isCashless?: boolean;
  needsReview?: boolean;
};

export interface TransactionEditLogChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface TransactionEditLogPayload {
  transactionId: string;
  before: TransactionEditLogBeforeAfter;
  after: TransactionEditLogBeforeAfter;
}

/** Сравнивает before/after и возвращает список изменённых полей. Пустой массив — изменений нет. */
export function buildEditLogChanges(
  before: TransactionEditLogBeforeAfter,
  after: TransactionEditLogBeforeAfter
): TransactionEditLogChange[] {
  const changes: TransactionEditLogChange[] = [];
  const keys: (keyof TransactionEditLogBeforeAfter)[] = [
    'from', 'to', 'amount', 'comment', 'category', 'isSalary', 'isCashless', 'needsReview'
  ];
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (key === 'amount') {
      if (Number(b) === Number(a)) continue;
    } else if (b === a) {
      continue;
    }
    changes.push({ field: key, before: b, after: a });
  }
  return changes;
}

export const createTransactionEditLog = async ({
  transactionId,
  before,
  after
}: TransactionEditLogPayload): Promise<void> => {
  const changes = buildEditLogChanges(before, after);
  if (changes.length === 0) return;
  const logsRef = collection(db, 'transaction_edit_logs');
  await addDoc(logsRef, {
    transactionId,
    editedAt: serverTimestamp(),
    editedBy: 'feed-password-mode',
    before,
    after,
    changes
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

/** Обновить только описание (комментарий) транзакции. Сумма, дата, статус и прочее не меняются. */
export const updateTransactionDescription = async (
  transactionId: string,
  description: string
): Promise<void> => {
  const ref = doc(db, 'transactions', transactionId);
  await updateDoc(ref, { description: description.trim() });
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
  newExpenseCategoryId?: string;
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
    newExpenseCategoryId,
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
    const withdrawalPayload: Record<string, unknown> = {
      ...correctionBase,
      categoryId: fromCategoryId,
      amount: -newAmount,
      type: 'expense',
      relatedTransactionId: correctionDepositId,
      attachments: []
    };
    if (newExpenseCategoryId) {
      withdrawalPayload.expenseCategoryId = newExpenseCategoryId;
    }
    tx.set(doc(db, 'transactions', correctionWithdrawalId), withdrawalPayload);
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

    // 4) Audit log — только если есть изменения
    const editLogChanges = buildEditLogChanges(audit.before, audit.after);
    if (editLogChanges.length > 0) {
      const logRef = doc(collection(db, 'transaction_edit_logs'));
      tx.set(logRef, {
        transactionId: audit.transactionId,
        editedAt: timestamp,
        editedBy: 'feed-password-mode',
        before: audit.before,
        after: audit.after,
        changes: editLogChanges
      });
    }

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

  const expenseRef = doc(db, 'transactions', transactionId);
  const expenseSnapForCheck = await getDoc(expenseRef);
  if (!expenseSnapForCheck.exists()) throw new Error('Транзакция не найдена');
  const transactionCompanyId = (expenseSnapForCheck.data() as any)?.companyId as string | undefined;

  const canApprove = await canApproveRejectTransactions(transactionCompanyId);
  if (!canApprove) {
    throw new Error('У вас нет прав для одобрения транзакций');
  }

  const currentUser = auth.currentUser;
  const approvedBy = currentUser?.email ?? currentUser?.uid ?? 'unknown';

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
    // Железное правило: отправитель = expense (списание), получатель = income (пополнение). Знак не зависит от типа сущности.
    const sourceCategoryId = expense.categoryId as string; // отправитель — всегда минус
    const targetCategoryId = income.categoryId as string;   // получатель — всегда плюс

    if (sourceCategoryId === targetCategoryId) {
      throw new Error('Отправитель и получатель не могут совпадать');
    }

    const sourceRef = doc(db, 'categories', sourceCategoryId);
    const targetRef = doc(db, 'categories', targetCategoryId);
    const sourceSnap = await tx.get(sourceRef);
    const targetSnap = await tx.get(targetRef);
    if (!sourceSnap.exists() || !targetSnap.exists()) {
      throw new Error('Категория отправителя или получателя не найдена');
    }

    const safeParseBalance = (raw: unknown): number => {
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const s = String(raw ?? '0');
      const n = parseAmount(s);
      return Number.isFinite(n) ? n : 0;
    };
    const sourceBalance = safeParseBalance(sourceSnap.data().amount);
    const targetBalance = safeParseBalance(targetSnap.data().amount);
    const newSourceBalance = sourceBalance - amount;
    const newTargetBalance = targetBalance + amount;

    if (import.meta.env?.DEV) {
      console.log('[TX_APPROVE]', {
        transactionId,
        senderCategoryId: sourceCategoryId,
        senderFromUser: expense.fromUser,
        receiverCategoryId: targetCategoryId,
        receiverToUser: expense.toUser,
        amount,
        sourceBalanceBefore: sourceBalance,
        targetBalanceBefore: targetBalance,
        sourceBalanceAfter: newSourceBalance,
        targetBalanceAfter: newTargetBalance,
        rule: 'sender=decrease, receiver=increase'
      });
    }

    if (!Number.isFinite(newSourceBalance) || !Number.isFinite(newTargetBalance)) {
      throw new Error('Некорректный расчёт баланса после одобрения');
    }

    const timestamp = serverTimestamp();

    tx.update(sourceRef, {
      amount: formatAmount(newSourceBalance),
      updatedAt: timestamp
    });
    tx.update(targetRef, {
      amount: formatAmount(newTargetBalance),
      updatedAt: timestamp
    });

    tx.update(expenseRef, {
      status: 'approved',
      approvedAt: timestamp,
      approvedBy
    });
    tx.update(incomeRef, {
      status: 'approved',
      approvedAt: timestamp,
      approvedBy
    });
  });

  // Диагностика: что реально записалось в Firestore (только в dev)
  if (import.meta.env?.DEV) {
    try {
      const expenseSnapAfter = await getDoc(doc(db, 'transactions', transactionId));
      const expenseAfter = expenseSnapAfter.data() as any;
      if (expenseAfter?.categoryId && expenseAfter?.relatedTransactionId) {
        const incomeSnapAfter = await getDoc(doc(db, 'transactions', expenseAfter.relatedTransactionId));
        const incomeAfter = incomeSnapAfter.data() as any;
        const srcCat = await getDoc(doc(db, 'categories', expenseAfter.categoryId));
        const tgtCat = await getDoc(doc(db, 'categories', incomeAfter?.categoryId));
        console.log('[TX_APPROVE] после записи Firestore:', {
          senderCategoryId: expenseAfter.categoryId,
          senderAmountInFirestore: srcCat.data()?.amount,
          receiverCategoryId: incomeAfter?.categoryId,
          receiverAmountInFirestore: tgtCat.data()?.amount
        });
      }
    } catch (e) {
      console.warn('[TX_APPROVE] проверка после записи', e);
    }
  }

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

  const txRefForCheck = doc(db, 'transactions', transactionId);
  const txSnapForCheck = await getDoc(txRefForCheck);
  if (!txSnapForCheck.exists()) throw new Error('Транзакция не найдена');
  const transactionCompanyId = (txSnapForCheck.data() as any)?.companyId as string | undefined;

  const canReject = await canApproveRejectTransactions(transactionCompanyId);
  if (!canReject) {
    throw new Error('У вас нет прав для отклонения транзакций');
  }

  const currentUser = auth.currentUser;
  const rejectedBy = currentUser?.email ?? currentUser?.uid ?? 'unknown';

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
      rejectedBy
    });

    if (relatedId && relatedSnap?.exists()) {
      const relatedRef = doc(db, 'transactions', relatedId);
      tx.update(relatedRef, {
        status: 'rejected',
        rejectedAt: timestamp,
        rejectedBy
      });
    }
  });
};
/**
 * Проверка: может ли текущий пользователь удалить транзакцию.
 * allowed: true если global_admin или owner компании транзакции.
 * requiresPassword: true только для global_admin (owner удаляет без пароля).
 */
export const canDeleteTransaction = async (
  transactionId: string
): Promise<{ allowed: boolean; requiresPassword: boolean }> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return { allowed: false, requiresPassword: false };

  const transactionSnap = await getDoc(doc(db, 'transactions', transactionId));
  if (!transactionSnap.exists()) return { allowed: false, requiresPassword: false };
  const transactionCompanyId = (transactionSnap.data() as any)?.companyId as string | undefined;

  const globalRole = await getCurrentUserRole();
  if (globalRole === 'global_admin' || globalRole === 'superAdmin' || globalRole === 'admin') {
    return { allowed: true, requiresPassword: true };
  }

  if (!transactionCompanyId) return { allowed: false, requiresPassword: false };
  try {
    const cu = await getCompanyUser(uid);
    if (cu?.role === 'owner' && cu.companyId === transactionCompanyId) {
      return { allowed: true, requiresPassword: false };
    }
  } catch {
    // ignore
  }
  return { allowed: false, requiresPassword: false };
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

    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error('Транзакция не найдена');
    }

    const transactionData = transactionSnap.data();
    const transactionCompanyId = transactionData.companyId as string | undefined;

    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('Пользователь не найден');
    }
    const globalRole = userDoc.data().role as string | undefined;

    let mayDelete = false;
    if (globalRole === 'global_admin' || globalRole === 'superAdmin' || globalRole === 'admin') {
      mayDelete = true;
    } else if (transactionCompanyId) {
      try {
        const cu = await getCompanyUser(userId);
        if (cu?.role === 'owner' && cu.companyId === transactionCompanyId) mayDelete = true;
      } catch {
        // ignore
      }
    }
    if (!mayDelete) {
      throw new Error('Доступ запрещен. Только для администраторов или владельца компании.');
    }

    const batch = writeBatch(db);
    const relatedTransactionId = transactionData.relatedTransactionId;
    const categoryId = transactionData.categoryId;
    const amount = Number(transactionData.amount);

    // Откат балансов/агрегатов только если транзакция была реально проведена (одобрена).
    // Pending-транзакции при создании не меняют балансы — при удалении ничего не откатываем.
    const status = (transactionData.status as TransactionStatus | undefined) ?? 'approved';
    const wasApplied = status === 'approved';

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

    if (wasApplied) {
      // Обновляем агрегаты для клиента перед удалением транзакции (только если транзакция была проведена)
      try {
        await updateClientAggregatesOnDelete(categoryId, amount, companyId);
      } catch (error) {
        console.error('Error updating client aggregates on delete:', error);
      }

      // Откат баланса категории (источник/получатель) — только для проведённых транзакций
      const categoryRef = doc(db, 'categories', categoryId);
      const categorySnap = await getDoc(categoryRef);

      if (categorySnap.exists()) {
        const currentAmount = parseAmount(categorySnap.data().amount);
        const newAmount = currentAmount + (amount * -1);

        batch.update(categoryRef, {
          amount: formatAmount(newAmount),
          updatedAt: serverTimestamp()
        });
      }
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

    // Если нашли связанную транзакцию, удаляем её из БД; откат баланса/агрегатов — только если пара была проведена
    if (relatedTransaction) {
      const relatedRef = doc(db, 'transactions', relatedTransaction.id);

      if (relatedTransaction.attachments && relatedTransaction.attachments.length > 0) {
        for (const attachment of relatedTransaction.attachments) {
          try {
            await deleteFileFromSupabase(attachment.path);
          } catch (error) {
            console.error('Error deleting related transaction file from Supabase:', error);
          }
        }
      }

      batch.delete(relatedRef);

      if (wasApplied) {
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

    // Складской откат — только если транзакция была проведена (одобрена); pending не менял остатки.
    const isPotentialWarehouseOp =
      (transactionData && transactionData.isWarehouseOperation) ||
      (relatedTransaction && relatedTransaction.isWarehouseOperation);

    if (wasApplied && isPotentialWarehouseOp && companyId) {
      // Находим категории склада только текущей компании (изоляция по companyId)
      const warehouseCategoriesSnap = await getDocs(
        query(
          collection(db, 'categories'),
          where('companyId', '==', companyId),
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

            // Ищем товар по имени и единице измерения только в рамках компании
            const productsQuery = query(
              collection(db, 'products'),
              where('companyId', '==', companyId),
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