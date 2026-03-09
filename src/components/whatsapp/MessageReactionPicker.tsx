import React, { useRef, useEffect } from 'react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MORE_REACTIONS = ['🔥', '👏', '😊', '😍', '🤔', '👎'];

export interface MessageReactionPickerProps {
  messageId: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Показать расширенный набор (ещё) */
  expanded?: boolean;
  isMobile?: boolean;
}

const MessageReactionPicker: React.FC<MessageReactionPickerProps> = ({
  onSelect,
  onClose,
  anchorRef,
  expanded = false,
  isMobile = false,
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const el = pickerRef.current;
      const anchor = anchorRef.current;
      if (el && !el.contains(e.target as Node) && anchor && !anchor.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, anchorRef]);

  const emojis = expanded ? [...QUICK_REACTIONS, ...MORE_REACTIONS] : QUICK_REACTIONS;

  return (
    <div
      ref={pickerRef}
      className={`flex flex-wrap items-center gap-1 p-2 bg-white rounded-xl shadow-lg border border-gray-200 ${
        isMobile ? 'text-2xl' : 'text-lg'
      }`}
      role="listbox"
      aria-label="Выберите реакцию"
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="p-1 rounded-lg hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          onClick={() => onSelect(emoji)}
          role="option"
          aria-label={`Реакция ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default MessageReactionPicker;
export { QUICK_REACTIONS, MORE_REACTIONS };
