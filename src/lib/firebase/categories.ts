import { collection, addDoc, deleteDoc, doc, getDoc, updateDoc, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { CategoryData } from '../../types';

// Вспомогательная функция для форматирования суммы
export const formatAmount = (amount: number): string => {
  return `${amount} ₸`;
};

// Вспомогательная функция для парсинга суммы из строки
export const parseAmount = (amountStr: string): number => {
  return parseFloat(amountStr.replace(/[^\d.-]/g, ''));
};

export const addCategory = async (categoryData: CategoryData, companyId: string) => {
  try {
    const docRef = await addDoc(collection(db, 'categories'), {
      ...categoryData,
      amount: '0 ₸',
      companyId,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId: string, data: any) => {
  try {
    const categoryRef = doc(db, 'categories', categoryId);
    await updateDoc(categoryRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

export const deleteCategory = async (
  categoryId: string,
  categoryTitle: string,
  deleteAll: boolean,
  companyId: string
) => {
  const categoryRef = doc(db, 'categories', categoryId);
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Категория не найдена');
  }
  const categoryCompanyId = categorySnap.data()?.companyId as string | undefined;
  if (categoryCompanyId !== companyId) {
    throw new Error('Нет прав на удаление объекта другой компании');
  }

  const batch = writeBatch(db);

  try {
    if (deleteAll) {
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('companyId', '==', companyId),
        where('categoryId', '==', categoryId)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      transactionsSnapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });

      const categoriesQuery = query(
        collection(db, 'categories'),
        where('companyId', '==', companyId),
        where('title', '==', categoryTitle)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      categoriesSnapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();
    } else {
      await deleteDoc(categoryRef);
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};