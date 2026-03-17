import React, { useEffect, useRef } from 'react';
import { Reply, Forward, Copy, Star, Trash2, Info, Languages } from 'lucide-react';

export interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onStar: () => void;
  onDelete: () => void;
  onInfo?: () => void;
  /** Перевести сообщение RU↔KZ */
  onTranslate?: () => void;
  /** Какие действия показывать */
  hasText: boolean;
  isStarred?: boolean;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  x,
  y,
  onClose,
  onReply,
  onForward,
  onCopy,
  onStar,
  onDelete,
  onInfo,
  onTranslate,
  hasText,
  isStarred = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + rect.width > vw - 8) left = vw - rect.width - 8;
    if (top + rect.height > vh - 8) top = vh - rect.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-[1100] min-w-[180px] py-1 bg-white rounded-lg shadow-xl border border-gray-200"
      style={{ left: x, top: y }}
      role="menu"
    >
      <button
        type="button"
        onClick={() => { onReply(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        role="menuitem"
      >
        <Reply className="w-4 h-4" /> Ответить
      </button>
      <button
        type="button"
        onClick={() => { onForward(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        role="menuitem"
      >
        <Forward className="w-4 h-4" /> Переслать
      </button>
      {hasText && (
        <button
          type="button"
          onClick={() => { onCopy(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
        >
          <Copy className="w-4 h-4" /> Копировать
        </button>
      )}
      {hasText && onTranslate && (
        <button
          type="button"
          onClick={() => { onTranslate(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
        >
          <Languages className="w-4 h-4" /> Перевести
        </button>
      )}
      <button
        type="button"
        onClick={() => { onStar(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        role="menuitem"
      >
        <Star className="w-4 h-4" /> {isStarred ? 'Убрать из избранного' : 'В избранное'}
      </button>
      <button
        type="button"
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        role="menuitem"
      >
        <Trash2 className="w-4 h-4" /> Удалить
      </button>
      {onInfo && (
        <button
          type="button"
          onClick={() => { onInfo(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
          role="menuitem"
        >
          <Info className="w-4 h-4" /> Сведения
        </button>
      )}
    </div>
  );
};

export default MessageContextMenu;
