import React from 'react';

const MAX_PREVIEW_LEN = 80;

export interface QuickReplyFileItem {
  id: string;
  url: string;
  name: string;
  type: string;
  size?: number;
}

export interface QuickReplyItem {
  id: string;
  title: string;
  text: string;
  keywords: string;
  category: string;
  files?: QuickReplyFileItem[];
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file' | 'audio';
  attachmentFileName?: string;
}

interface QuickRepliesPopupProps {
  items: QuickReplyItem[];
  selectedIndex: number;
  onSelect: (item: QuickReplyItem) => void;
}

export const QuickRepliesPopup: React.FC<QuickRepliesPopupProps> = ({
  items,
  selectedIndex,
  onSelect
}) => {
  if (items.length === 0) return null;

  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.querySelector('[data-quick-reply-selected]');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  return (
    <div
      className="absolute left-2 right-2 md:left-3 md:right-3 bottom-full mb-1 z-50 max-h-[220px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
      role="listbox"
      aria-label="Быстрые ответы"
      ref={listRef}
    >
      {items.map((item, i) => {
        const preview = item.text.length > MAX_PREVIEW_LEN ? item.text.slice(0, MAX_PREVIEW_LEN) + '…' : item.text;
        const isSelected = i === selectedIndex;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-quick-reply-selected={isSelected ? true : undefined}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${
              isSelected ? 'bg-green-50 text-gray-900' : 'hover:bg-gray-50 text-gray-800'
            }`}
            onClick={() => onSelect(item)}
          >
            <div className="text-sm font-medium truncate">
              {item.title || 'Без названия'}
              {((item.files?.length ?? 0) > 0 || item.attachmentUrl) && <span className="ml-1 text-gray-500">📎</span>}
            </div>
            <div className="text-xs text-gray-600 truncate mt-0.5">{preview}</div>
          </button>
        );
      })}
    </div>
  );
};
