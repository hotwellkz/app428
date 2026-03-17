import React, { useState, useEffect } from 'react';
import { CategoryCardType } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { formatAmount } from '../../utils/formatUtils';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Home, Lock } from 'lucide-react';
import { usePendingSummaryByCategoryId } from '../../contexts/PendingTransactionsContext';

interface CategoryCardProps {
  category: CategoryCardType;
  onHistoryClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  /** Скрыть сумму (для чужих карточек сотрудников при ограничении прав). */
  maskAmount?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ 
  category, 
  onHistoryClick,
  isDragging = false,
  maskAmount = false
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
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs < 1000) {
      return `${sign}${Math.round(abs)}`;
    }
    if (abs < 1_000_000) {
      const v = abs / 1000;
      const body = v % 1 === 0 ? `${v.toFixed(0)}k` : `${v.toFixed(1)}k`;
      return `${sign}${body}`;
    }
    const v = abs / 1_000_000;
    const body = v % 1 === 0 ? `${v.toFixed(0)}M` : `${v.toFixed(1)}M`;
    return `${sign}${body}`;
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
        {!maskAmount && pendingAmount !== 0 && (
          <div
            className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 sm:px-2 rounded-full shadow-md"
            style={{
              // Цвет по знаку net pending: плюс — зелёный, минус — красный
              backgroundColor: pendingAmount > 0 ? '#10b981' : '#FF4D4F',
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
                ? `Есть операции, требующие уточнения. Net: ${formatAmount(pendingAmount)} ₸`
                : `Ожидает одобрения (net): ${formatAmount(pendingAmount)} ₸`
            }
          >
            <span className="text-[10px] leading-none sm:text-[11px]">
              {formatPendingAmountCompact(pendingAmount)}
            </span>
            {hasNeedsReview && (
              <span
                className="absolute -left-1 -bottom-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: '#FAAD14', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                title="Есть операции, требующие уточнения"
              />
            )}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="text-[10px] font-medium text-gray-700 truncate max-w-[60px]">
          {category.title}
        </div>
        {maskAmount ? (
          <div className="text-[10px] font-medium text-gray-400 flex items-center gap-0.5 justify-center" title="Недостаточно прав для просмотра">
            <Lock className="w-3 h-3 flex-shrink-0" />
            <span>Скрыто</span>
          </div>
        ) : category.row === 4 && category.title === 'Склад' ? (
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