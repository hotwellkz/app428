import React from 'react';
import { Reply, Forward, Copy, Star, Trash2, X, Languages } from 'lucide-react';

export interface MessageActionsSheetProps {
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onStar: () => void;
  onDelete: () => void;
  onTranslate?: () => void;
  hasText: boolean;
  isStarred?: boolean;
}

const MessageActionsSheet: React.FC<MessageActionsSheetProps> = ({
  open,
  onClose,
  onReply,
  onForward,
  onCopy,
  onStar,
  onDelete,
  onTranslate,
  hasText,
  isStarred = false,
}) => {
  if (!open) return null;

  const itemClass = "w-full flex items-center gap-3 px-4 py-3 text-left text-base text-gray-800 hover:bg-gray-50 active:bg-gray-100";

  return (
    <div
      className="fixed inset-0 z-[1100] flex flex-col justify-end bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-t-2xl shadow-xl pb-env(safe-area-inset-bottom)"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Действия над сообщением"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-medium text-gray-500">Действия</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="py-2">
          <button type="button" onClick={() => { onReply(); onClose(); }} className={itemClass}>
            <Reply className="w-5 h-5 text-gray-500" /> Ответить
          </button>
          <button type="button" onClick={() => { onForward(); onClose(); }} className={itemClass}>
            <Forward className="w-5 h-5 text-gray-500" /> Переслать
          </button>
          {hasText && (
            <button type="button" onClick={() => { onCopy(); onClose(); }} className={itemClass}>
              <Copy className="w-5 h-5 text-gray-500" /> Копировать
            </button>
          )}
          {hasText && onTranslate && (
            <button type="button" onClick={() => { onTranslate(); onClose(); }} className={itemClass}>
              <Languages className="w-5 h-5 text-gray-500" /> Перевести
            </button>
          )}
          <button type="button" onClick={() => { onStar(); onClose(); }} className={itemClass}>
            <Star className="w-5 h-5 text-gray-500" /> {isStarred ? 'Убрать из избранного' : 'В избранное'}
          </button>
          <button type="button" onClick={() => { onDelete(); onClose(); }} className={`${itemClass} text-red-600`}>
            <Trash2 className="w-5 h-5" /> Удалить
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageActionsSheet;
