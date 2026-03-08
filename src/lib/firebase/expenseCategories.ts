import {
  collection,
  addDoc,
  doc,
  updateDoc,
  increment,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import type { ExpenseCategory, ExpenseCategoryCreate } from '../../types/expenseCategory';

export const DEFAULT_EXPENSE_CATEGORY_NAME = 'Прочее';

/** Палитра цветов для категорий (если не задан color в документе — назначается по индексу) */
export const EXPENSE_CATEGORY_COLORS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink'
] as const;

export function getCategoryColor(color: string | undefined, index: number): string {
  if (color && EXPENSE_CATEGORY_COLORS.includes(color as (typeof EXPENSE_CATEGORY_COLORS)[number])) {
    return color;
  }
  return EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length];
}

const COLLECTION = 'expense_categories';

const DEFAULT_CATEGORIES = [
  'Материалы',
  'Доставка',
  'Техника',
  'Зарплата',
  'Инструменты',
  'Прочее'
];

/**
 * Создаёт категорию расхода в Firebase
 */
export const createExpenseCategory = async (
  name: string,
  createdBy: string
): Promise<string> => {
  if (!name?.trim()) {
    throw new Error('Название категории обязательно');
  }
  const data: Omit<ExpenseCategoryCreate, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp>; usageCount: number; color: string } = {
    name: name.trim(),
    createdAt: serverTimestamp(),
    createdBy,
    usageCount: 0,
    color: EXPENSE_CATEGORY_COLORS[0]
  };
  const docRef = await addDoc(collection(db, COLLECTION), data);
  return docRef.id;
};

/** Сортировка по популярности (usageCount desc), при отсутствии usageCount считаем 0 */
const sortByUsageCount = (a: ExpenseCategory, b: ExpenseCategory) =>
  (b.usageCount ?? 0) - (a.usageCount ?? 0);

/**
 * Подписка на список категорий расходов в реальном времени (сортировка по популярности: usageCount desc)
 */
export const subscribeExpenseCategories = (
  onUpdate: (categories: ExpenseCategory[]) => void
): (() => void) => {
  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const categories: ExpenseCategory[] = snapshot.docs
        .map((doc, idx) => {
          const d = doc.data();
          const color = d.color ?? getCategoryColor(undefined, idx);
          return {
            id: doc.id,
            name: d.name ?? '',
            createdAt: d.createdAt ?? Timestamp.now(),
            createdBy: d.createdBy ?? '',
            usageCount: d.usageCount ?? 0,
            color
          };
        })
        .sort(sortByUsageCount);
      onUpdate(categories);
    },
    (err) => {
      console.error('expense_categories subscription error:', err);
      onUpdate([]);
    }
  );
};

/**
 * Загружает текущий список категорий один раз (сортировка по популярности)
 */
export const getExpenseCategories = async (): Promise<ExpenseCategory[]> => {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs
    .map((doc, idx) => {
      const d = doc.data();
      const color = d.color ?? getCategoryColor(undefined, idx);
      return {
        id: doc.id,
        name: d.name ?? '',
        createdAt: d.createdAt ?? Timestamp.now(),
        createdBy: d.createdBy ?? '',
        usageCount: d.usageCount ?? 0,
        color
      };
    })
    .sort(sortByUsageCount);
};

/**
 * Добавляет начальные категории, если коллекция пуста
 */
export const seedDefaultExpenseCategories = async (userId: string): Promise<void> => {
  const existing = await getExpenseCategories();
  if (existing.length > 0) return;
  for (let idx = 0; idx < DEFAULT_CATEGORIES.length; idx++) {
    const name = DEFAULT_CATEGORIES[idx];
    await addDoc(collection(db, COLLECTION), {
      name,
      createdAt: serverTimestamp(),
      createdBy: userId,
      usageCount: 0,
      color: EXPENSE_CATEGORY_COLORS[idx % EXPENSE_CATEGORY_COLORS.length]
    });
  }
};

/**
 * Обновляет название категории расхода (id не меняется, старые транзакции остаются привязанными)
 */
export const updateExpenseCategory = async (
  categoryId: string,
  newName: string
): Promise<void> => {
  if (!newName?.trim()) {
    throw new Error('Название категории обязательно');
  }
  const ref = doc(db, COLLECTION, categoryId);
  await updateDoc(ref, {
    name: newName.trim(),
    updatedAt: serverTimestamp()
  });
};

/**
 * Находит категорию "Прочее" или создаёт её. Возвращает id категории.
 */
export const ensureDefaultExpenseCategory = async (userId: string): Promise<string> => {
  const existing = await getExpenseCategories();
  const other = existing.find((c) => c.name === DEFAULT_EXPENSE_CATEGORY_NAME);
  if (other) return other.id;
  return createExpenseCategory(DEFAULT_EXPENSE_CATEGORY_NAME, userId);
};

/**
 * Увеличивает счётчик использований категории на 1 (после создания транзакции с этой категорией).
 * Если у документа нет поля usageCount, Firestore increment создаст его со значением 1.
 */
export const incrementExpenseCategoryUsage = async (categoryId: string): Promise<void> => {
  if (!categoryId) return;
  const ref = doc(db, COLLECTION, categoryId);
  await updateDoc(ref, {
    usageCount: increment(1)
  });
};
