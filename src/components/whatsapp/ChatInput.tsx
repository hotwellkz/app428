import React from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  /** На мобильных — fixed снизу */
  fixedBottom?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  fixedBottom = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const containerClass = fixedBottom
    ? 'fixed left-0 right-0 bottom-0 p-2 bg-gray-100 border-t border-gray-200'
    : 'flex-none p-3 bg-gray-100';

  const containerStyle = fixedBottom
    ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' as const }
    : undefined;

  return (
    <div className={`${containerClass} flex gap-2`} style={containerStyle}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Сообщение..."
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none md:px-4"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim() || disabled || sending}
        title="Отправить"
        className="rounded-lg bg-green-600 text-white px-3 py-2 flex items-center gap-1.5 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors md:px-4 md:gap-2 min-w-[7rem]"
      >
        <Send className="w-4 h-4 flex-shrink-0" />
        <span className="hidden sm:inline">Отправить</span>
      </button>
    </div>
  );
};

export default ChatInput;
