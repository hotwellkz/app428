import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from '../contexts/CompanyContext';
import { Building2, Car, Globe, Hammer, Home, Package, User, Wallet } from 'lucide-react';
import { CategoryCardType } from '../types';
import React from 'react';

const iconMap: { [key: string]: React.ElementType } = {
  Car,
  User,
  Building2,
  Wallet,
  Home,
  Hammer,
  Globe,
  Package
};

// Кэш для иконок
const iconCache = new Map<string, React.ReactElement>();

// Функция для создания иконки с кэшированием
const createCachedIcon = (iconName: string | undefined | null): React.ReactElement => {
  // Безопасная обработка отсутствующего или невалидного iconName
  const safeIconName = iconName && typeof iconName === 'string' ? iconName : 'Home';
  const cacheKey = `${safeIconName}_24_text-white`;
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const IconComponent = iconMap[safeIconName] || Home;
  const icon = React.createElement(IconComponent, { 
    size: 24,
    className: "text-white"
  });
  
  iconCache.set(cacheKey, icon);
  return icon;
};

interface ProcessedCategory {
  id: string;
  title: string;
  amount: string;
  icon: React.ReactElement;
  iconName: string;
  color: string;
  row: number;
  isVisible: boolean;
  type?: string;
  companyId?: string;
}

export const useCategories = () => {
  const companyId = useCompanyId();
  const [categories, setCategories] = useState<CategoryCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Мемоизированная функция обработки изменений
  const processChanges = useCallback((changes: any[]) => {
    const updates = new Map<string, ProcessedCategory | null>();
    
    changes.forEach(change => {
      if (change.type === 'removed') {
        updates.set(change.doc.id, null);
      } else {
        const data = change.doc.data();
        // Безопасное создание иконки с проверкой
        const icon = createCachedIcon(data.icon);
        
        updates.set(change.doc.id, {
          id: change.doc.id,
          title: data.title || 'Без названия',
          amount: String(data.amount || 0),
          icon,
          iconName: data.icon || 'Home',
          color: data.color || 'bg-emerald-500',
          row: parseInt(data.row) || 1,
          isVisible: data.isVisible !== undefined ? data.isVisible : true,
          type: data.type,
          companyId: data.companyId as string | undefined
        });
      }
    });
    
    return updates;
  }, []);

  // Мемоизированная функция обновления состояния
  const updateCategories = useCallback((updates: Map<string, ProcessedCategory | null>) => {
    setCategories(prev => {
      const newCategories = [...prev];

      updates.forEach((value, key) => {
        const index = newCategories.findIndex(cat => cat.id === key);
        
        if (value === null && index !== -1) {
          // Удаляем категорию
          newCategories.splice(index, 1);
        } else if (value) {
          if (index === -1) {
            // Добавляем новую категорию
            newCategories.push(value as CategoryCardType);
          } else {
            // Обновляем существующую категорию
            newCategories[index] = value as CategoryCardType;
          }
        }
      });

      // Сортируем по строкам для стабильного порядка
      return newCategories.sort((a, b) => (a.row || 0) - (b.row || 0));
    });
  }, []);

  // Жёсткая изоляция: наружу отдаём только категории текущей компании (никогда чужие)
  const safeCategories = useMemo(
    () => (companyId ? categories.filter((c) => c.companyId === companyId) : []),
    [categories, companyId]
  );

  const derivedValues = useMemo(() => {
    const visibleCategories = safeCategories.filter(c => c.isVisible !== false);
    return {
      visibleCategories,
      clientCategories: visibleCategories.filter(c => c.row === 1),
      employeeCategories: visibleCategories.filter(c => c.row === 2),
      projectCategories: visibleCategories.filter(c => c.row === 3),
      warehouseCategories: visibleCategories.filter(c => c.row === 4),
      totalCategories: safeCategories.length,
      visibleCount: visibleCategories.length
    };
  }, [safeCategories]);

  useEffect(() => {
    if (!companyId) {
      setCategories([]);
      setLoading(false);
      setError(null);
      return () => {};
    }

    // Критично: при смене компании сразу очищаем список, иначе docChanges()
    // будет мержиться со старым состоянием и в списке останутся категории другой компании.
    setCategories([]);
    setLoading(true);

    let unsubscribe: () => void;

    try {
      const q = query(
        collection(db, 'categories'),
        where('companyId', '==', companyId)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            // Всегда заменяем список полным набором из snapshot, а не мержим docChanges.
            // Иначе при смене компании старые категории оставались в состоянии и смешивались с новыми.
            const fullList: CategoryCardType[] = snapshot.docs
              .filter((docSnap) => (docSnap.data().companyId as string) === companyId)
              .map((docSnap) => {
                const data = docSnap.data();
                const icon = createCachedIcon(data.icon);
                return {
                  id: docSnap.id,
                  title: data.title || 'Без названия',
                  amount: String(data.amount || 0),
                  icon,
                  iconName: data.icon || 'Home',
                  color: data.color || 'bg-emerald-500',
                  row: parseInt(data.row) || 1,
                  isVisible: data.isVisible !== undefined ? data.isVisible : true,
                  type: data.type,
                  companyId: data.companyId as string | undefined
                } as CategoryCardType;
              });
            if (import.meta.env?.DEV && fullList.length > 0) {
              const projects = fullList.filter((c) => c.row === 3);
              if (projects.length > 0) {
                console.log('[TX_CATEGORIES] категории (row=3 проекты) из Firestore:', projects.map((c) => ({ id: c.id, title: c.title, amount: c.amount })));
              }
            }
            setCategories(fullList.sort((a, b) => (a.row || 0) - (b.row || 0)));
            setLoading(false);
            setError(null);
          } catch (snapshotError) {
            console.error('Error processing snapshot:', snapshotError);
            setError('Ошибка обработки данных');
          }
        },
        (error) => {
          console.error('Categories subscription error:', error);
          setError('Ошибка получения данных');
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('Error in useCategories:', error);
      setError('Ошибка при инициализации подписки');
      setLoading(false);
      unsubscribe = () => {};
    }

    return () => unsubscribe?.();
  }, [processChanges, updateCategories, companyId]);

  const getCategoryById = useCallback((id: string) => {
    return safeCategories.find(cat => cat.id === id);
  }, [safeCategories]);

  const getCategoriesByRow = useCallback((row: number) => {
    return safeCategories.filter(cat => cat.row === row && cat.isVisible !== false);
  }, [safeCategories]);

  return { 
    categories: safeCategories, 
    loading, 
    error,
    ...derivedValues,
    getCategoryById,
    getCategoriesByRow
  };
};