import React from 'react';
import { CategoryCardType } from '../types';
import { useDraggable } from '@dnd-kit/core';
import { Home } from 'lucide-react';

interface CategoryCardProps {
  category: CategoryCardType;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: category.id,
    data: category
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Безопасный рендер иконки с fallback
  const renderIcon = () => {
    if (category.icon && React.isValidElement(category.icon)) {
      return category.icon;
    }
    // Fallback иконка, если category.icon отсутствует или невалиден
    return <Home className="w-6 h-6 sm:w-7 sm:h-7 text-white" />;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col items-center space-y-1 cursor-grab active:cursor-grabbing"
    >
      <div className={`w-12 h-12 sm:w-14 sm:h-14 ${category.color || 'bg-emerald-500'} rounded-full flex items-center justify-center shadow-lg`}>
        {renderIcon()}
      </div>
      <div className="text-center">
        <div className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[70px] sm:max-w-[80px]">
          {category.title}
        </div>
        <div className={`text-xs sm:text-sm font-medium ${
          category.amount.includes('-') ? 'text-red-500' : 'text-emerald-500'
        }`}>
          {category.amount}
        </div>
      </div>
    </div>
  );
};