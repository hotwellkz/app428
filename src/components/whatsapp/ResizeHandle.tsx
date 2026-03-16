import React, { useCallback, useRef } from 'react';

export interface ResizeHandleProps {
  /** Направление: 'left' — тянем вправо = увеличиваем левую панель; 'right' — тянем влево = увеличиваем правую */
  direction: 'left' | 'right';
  onResize: (deltaPx: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}

/**
 * Вертикальный разделитель для изменения ширины панелей (desktop).
 * При hover — cursor col-resize; при перетаскивании вызывает onResize(deltaPx).
 */
export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onResize,
  onDragStart,
  onDragEnd,
  className = '',
}) => {
  const startX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX.current = e.clientX;
      onDragStart?.();

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        startX.current = ev.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        onDragEnd?.();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onResize, onDragStart, onDragEnd]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={undefined}
      onMouseDown={handleMouseDown}
      className={`
        w-1 flex-shrink-0 flex-grow-0 cursor-col-resize
        bg-gray-200 hover:bg-green-400/50 active:bg-green-500/60
        transition-colors duration-150
        hover:w-1.5
        ${className}
      `}
      style={{ minWidth: 4 }}
    />
  );
};
