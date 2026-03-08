import { useState, useEffect, useRef } from 'react';
import {
  subscribeExpenseCategories,
  seedDefaultExpenseCategories
} from '../lib/firebase/expenseCategories';
import type { ExpenseCategory } from '../types/expenseCategory';

/**
 * Подписка на категории расходов из Firebase.
 * Если передан userId и коллекция пуста, один раз создаёт начальные категории.
 */
export const useExpenseCategories = (userId?: string | null) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeExpenseCategories((list) => {
      setCategories(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !userId || seededRef.current || categories.length > 0) return;
    seededRef.current = true;
    seedDefaultExpenseCategories(userId).catch((err) => {
      console.error('Seed expense categories:', err);
      seededRef.current = false;
    });
  }, [loading, userId, categories.length]);

  return { categories, loading };
};
