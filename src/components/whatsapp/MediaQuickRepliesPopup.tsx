import React from 'react';
import { ImageIcon } from 'lucide-react';
import type { MediaQuickReply } from '../../types/mediaQuickReplies';

interface MediaQuickRepliesPopupProps {
  items: MediaQuickReply[];
  selectedIndex: number;
  onSelect: (item: MediaQuickReply) => void;
}

export const MediaQuickRepliesPopup: React.FC<MediaQuickRepliesPopupProps> = ({
  items,
  selectedIndex,
  onSelect
}) => {
  if (items.length === 0) return null;

  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.querySelector('[data-media-quick-selected]');
    selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  return (
    <div
      className="absolute left-2 right-2 md:left-3 md:right-3 bottom-full mb-1 z-50 max-h-[220px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
      role="listbox"
      aria-label="Медиа-шаблоны"
      ref={listRef}
    >
      {items.map((item, i) => {
        const isSelected = i === selectedIndex;
        const count = item.files?.length ?? 0;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-media-quick-selected={isSelected ? true : undefined}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 flex items-center gap-2 transition-colors ${
              isSelected ? 'bg-green-50 text-gray-900' : 'hover:bg-gray-50 text-gray-800'
            }`}
            onClick={() => onSelect(item)}
          >
            <ImageIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium truncate flex-1">
              {item.title || 'Без названия'}
            </span>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {count} {count === 1 ? 'изображение' : count < 5 ? 'изображения' : 'изображений'}
            </span>
          </button>
        );
      })}
    </div>
  );
};
