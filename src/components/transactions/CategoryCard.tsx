import React, { useState, useEffect } from 'react';
import { CategoryCardType } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { formatAmount } from '../../utils/formatUtils';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Home } from 'lucide-react';
import { usePendingSummaryByCategoryId } from '../../contexts/PendingTransactionsContext';

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
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: category.id,
    data: category
  });
  const [warehouseTotal, setWarehouseTotal] = useState(0);
  const { pendingAmount, hasNeedsReview } = usePendingSummaryByCategoryId(category.id);

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

  // pendingAmount/hasNeedsReview берём из единого провайдера PendingTransactionsProvider (одна подписка на все pending транзакции)

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