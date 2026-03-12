import React from 'react';
import { X, Reply, Forward, Trash2, Star, MoreHorizontal } from 'lucide-react';

export interface MessageActionBarProps {
  selectedCount: number;
  onClose: () => void;
  onReply?: () => void;
  onForward: () => void;
  onDelete: () => void;
  onStar: () => void;
  onMore: () => void;
  /** Скрыть Reply при multi-select */
  showReply?: boolean;
  isMobile?: boolean;
}

const MessageActionBar: React.FC<MessageActionBarProps> = ({
  selectedCount,
  onClose,
  onReply,
  onForward,
  onDelete,
  onStar,
  onMore,
  showReply = true,
  isMobile = false,
}) => {
  return (
    <div
      className="flex-none flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 min-h-[48px]"
      style={isMobile ? { paddingTop: 'max(0.5rem, env(safe-area-inset-top))' } : undefined}
    >
      <button
        type="button"
        onClick={onClose}
        className="p-2 -ml-1 rounded-lg hover:bg-gray-100 text-gray-700 flex items-center gap-1"
        aria-label="Отменить выбор"
      >
        <X className="w-5 h-5" />
        {isMobile && <span className="text-sm font-medium">Отмена</span>}
      </button>
      <span className="text-sm font-medium text-gray-700 flex-1 text-center">
        Выбрано: {selectedCount}
      </span>
      <div className="flex items-center gap-0.5">
        {showReply && onReply && (
          <button
            type="button"
            onClick={onReply}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
            aria-label="Ответить"
            title="Ответить"
          >
            <Reply className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onStar}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
          aria-label="В избранное"
          title="В избранное"
        >
          <Star className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-red-50 text-red-600"
          aria-label="Удалить"
          title="Удалить"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onForward}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1"
          aria-label="Переслать"
          title="Переслать"
        >
          <Forward className="w-5 h-5" />
          {!isMobile && <span className="text-xs font-medium">Переслать</span>}
        </button>
        <button
          type="button"
          onClick={onMore}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
          aria-label="Ещё"
          title="Ещё"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default MessageActionBar;
