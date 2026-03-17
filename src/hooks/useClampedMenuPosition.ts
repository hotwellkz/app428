import { useRef, useState, useLayoutEffect } from 'react';

const PADDING = 8;

/**
 * Возвращает ref и стиль { left, top } для контекстного меню так, чтобы оно
 * не выходило за границы viewport. При открытии сначала рисуем по anchor, затем в useLayoutEffect подправляем.
 */
export function useClampedMenuPosition(
  isOpen: boolean,
  anchorX: number,
  anchorY: number
): { ref: React.RefObject<HTMLDivElement | null>; style: { left: number; top: number } } {
  const ref = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setClamped(null);
      return;
    }
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchorX;
    let top = anchorY;
    if (left + rect.width > vw - PADDING) left = vw - rect.width - PADDING;
    if (top + rect.height > vh - PADDING) top = vh - rect.height - PADDING;
    if (left < PADDING) left = PADDING;
    if (top < PADDING) top = PADDING;
    setClamped({ left, top });
  }, [isOpen, anchorX, anchorY]);

  return {
    ref,
    style: isOpen ? (clamped ?? { left: anchorX, top: anchorY }) : { left: 0, top: 0 },
  };
}
