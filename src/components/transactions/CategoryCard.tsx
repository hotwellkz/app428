import React, { useState, useEffect } from 'react';
import { CategoryCardType } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { formatAmount } from '../../utils/formatUtils';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Home } from 'lucide-react';
import { useCompanyId } from '../../contexts/CompanyContext';

interface CategoryCardProps {
  category: CategoryCardType;
  onHistoryClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ 
  category, 
  onHistoryClick,
  isDragging = false
}) => {
  const companyId = useCompanyId();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: category.id,
    data: category
  });
  const [warehouseTotal, setWarehouseTotal] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [hasNeedsReview, setHasNeedsReview] = useState(false);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const cardOpacity = isDragging ? 'opacity-50' : 'opacity-100';

  useEffect(() => {
    if (category.row === 4 && category.title === 'Склад') {
      const q = query(collection(db, 'products'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const total = snapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          return sum + (data.quantity || 0) * (data.price || 0);
        }, 0);
        setWarehouseTotal(total);
      });

      return () => unsubscribe();
    }
  }, [category.row, category.title]);

  // Реальное время: сумма НЕОДОБРЕННЫХ (pending) входящих транзакций для этой категории
  useEffect(() => {
    if (!category.id) return;

    const q = query(
      collection(db, 'transactions'),
      where('companyId', '==', companyId),
      where('categoryId', '==', category.id),
      where('status', '==', 'pending'),
      where('type', '==', 'income')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        let total = 0;
        let anyNeedsReview = false;
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as any;
          const amount = Number(data.amount) || 0;
          total += amount;
          if (data.needsReview) {
            anyNeedsReview = true;
          }
        });
        setPendingAmount(total > 0 ? total : 0);
        setHasNeedsReview(anyNeedsReview);
      } catch (error) {
        console.error('Error computing pendingAmount for category', category.id, error);
        setPendingAmount(0);
        setHasNeedsReview(false);
      }
    });

    return () => unsubscribe();
  }, [category.id, companyId]);

  const formatPendingAmountCompact = (value: number): string => {
    const abs = Math.abs(value);
    if (abs < 1000) {
      return Math.round(abs).toString();
    }
    if (abs < 1_000_000) {
      const v = abs / 1000;
      return v % 1 === 0 ? `${v.toFixed(0)}k` : `${v.toFixed(1)}k`;
    }
    const v = abs / 1_000_000;
    return v % 1 === 0 ? `${v.toFixed(0)}M` : `${v.toFixed(1)}M`;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onHistoryClick) {
      onHistoryClick(e);
    }
  };

  // Безопасный рендер иконки с fallback
  const renderIcon = () => {
    if (category.icon && React.isValidElement(category.icon)) {
      return category.icon;
    }
    // Fallback иконка, если category.icon отсутствует или невалиден
    return <Home className="w-6 h-6 text-white" />;
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`relative flex flex-col items-center space-y-1 py-1 ${cardOpacity} ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } touch-none select-none`}
    >
      <div className={`relative w-12 h-12 ${category.color || 'bg-emerald-500'} rounded-full flex items-center justify-center shadow-lg`}>
        {renderIcon()}
        {pendingAmount > 0 && (
          <div
            className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 sm:px-2 rounded-full shadow-md"
            style={{
              backgroundColor: hasNeedsReview ? '#FAAD14' : '#FF4D4F',
              color: '#FFFFFF',
              minWidth: 20,
              height: 18,
              fontSize: 10,
              fontWeight: 600,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transformOrigin: 'center',
              transition: 'transform 150ms ease-out'
            }}
            title={
              hasNeedsReview
                ? 'Есть операции, требующие уточнения'
                : `Ожидает одобрения: ${formatAmount(pendingAmount)} ₸`
            }
          >
            <span className="text-[10px] leading-none sm:text-[11px]">
              {formatPendingAmountCompact(pendingAmount)}
            </span>
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-[10px] font-medium text-gray-700 truncate max-w-[60px]">
          {category.title}
        </div>
        {category.row === 4 && category.title === 'Склад' ? (
          <div className="text-[10px] font-medium text-emerald-500">
            {formatAmount(warehouseTotal)}
          </div>
        ) : (
          <div className={`text-[10px] font-medium ${parseFloat(category.amount.replace(/[^\d.-]/g, '')) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {formatAmount(parseFloat(category.amount.replace(/[^\d.-]/g, '')))}
          </div>
        )}
      </div>
    </div>
  );
};