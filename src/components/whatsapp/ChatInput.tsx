import React, { useRef } from 'react';
import { Send, Paperclip, Mic, Square } from 'lucide-react';

const MAX_ATTACHMENT_MB = 10;
const ACCEPT_ATTACHMENTS = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  /** На мобильных — fixed снизу */
  fixedBottom?: boolean;
  /** Есть выбранный файл для отправки (разрешаем Send) */
  hasAttachment?: boolean;
  /** Выбор файла для отправки */
  onFileSelect?: (file: File) => void;
  /** Запись голоса: начать */
  onStartVoice?: () => void;
  /** Запись голоса: остановить и отправить файл */
  onStopVoice?: () => void;
  /** Идёт запись голоса */
  isRecordingVoice?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  fixedBottom = false,
  hasAttachment = false,
  onFileSelect,
  onStartVoice,
  onStopVoice,
  isRecordingVoice = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = (value.trim().length > 0 || hasAttachment) && !disabled && !sending;

  const containerClass = fixedBottom
    ? 'fixed left-0 right-0 bottom-0 p-2 bg-gray-100 border-t border-gray-200'
    : 'flex-none p-3 bg-gray-100';

  const containerStyle = fixedBottom
    ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' as const }
    : undefined;

  return (
    <div className={`${containerClass} flex flex-col gap-1`} style={containerStyle}>
      <div className="flex gap-2">
        {onFileSelect && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTACHMENTS}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isRecordingVoice}
              title="Прикрепить файл"
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50 transition-colors"
              aria-label="Прикрепить файл"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            {onStartVoice && onStopVoice && (
              <button
                type="button"
                onClick={isRecordingVoice ? onStopVoice : onStartVoice}
                disabled={disabled || !!hasAttachment}
                title={isRecordingVoice ? 'Остановить запись' : 'Голосовое сообщение'}
                className={`rounded-lg p-2 transition-colors ${
                  isRecordingVoice
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50'
                }`}
                aria-label={isRecordingVoice ? 'Остановить запись' : 'Голосовое сообщение'}
              >
                {isRecordingVoice ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasAttachment ? 'Подпись к файлу (необязательно)' : 'Сообщение...'}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none md:px-4"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          title="Отправить"
          className="rounded-lg bg-green-600 text-white px-3 py-2 flex items-center gap-1.5 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors md:px-4 md:gap-2 min-w-[7rem]"
        >
          <Send className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
export { MAX_ATTACHMENT_MB, ACCEPT_ATTACHMENTS };
