import React, { useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square, Loader2, Camera } from 'lucide-react';

const MAX_ATTACHMENT_MB = 10;
const ACCEPT_ATTACHMENTS = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt';
/** На мобильном открывает камеру (capture), на десктопе — выбор файла фото/видео */
const ACCEPT_CAMERA = 'image/*,video/*';

const TEXTAREA_MIN_ROWS = 1;
const TEXTAREA_MAX_ROWS = 5;
const LINE_HEIGHT_PX = 20;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  fixedBottom?: boolean;
  hasAttachment?: boolean;
  onFileSelect?: (file: File) => void;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  isRecordingVoice?: boolean;
  /** Съёмка фото/видео с камеры (на mobile — нативная камера) */
  onCameraCapture?: (file: File) => void;
  /** Показывать кнопку камеры (mobile WhatsApp-style) */
  showCameraButton?: boolean;
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
  onCameraCapture,
  showCameraButton = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;
  const showSend = hasText || hasAttachment;
  const isBusy = sending;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSend && !isBusy) onSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineCount = Math.min(Math.max(el.value.split('\n').length, TEXTAREA_MIN_ROWS), TEXTAREA_MAX_ROWS);
    el.style.height = `${lineCount * LINE_HEIGHT_PX + 24}px`;
  }, [value]);

  const handleActionClick = () => {
    if (isRecordingVoice && onStopVoice) onStopVoice();
    else if (showSend && !isBusy) onSend();
    else if (!showSend && onStartVoice && !hasAttachment) onStartVoice();
  };

  const containerClass = fixedBottom
    ? 'fixed left-0 right-0 border-t border-gray-200 bg-[#f0f2f5]'
    : 'flex-none bg-[#f0f2f5]';
  const containerStyle = fixedBottom
    ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' as const }
    : undefined;

  return (
    <div className={`${containerClass} py-2 px-2 md:px-3`} style={containerStyle}>
      <div className="flex items-end gap-1.5 md:gap-2 max-w-full">
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
              title="Прикрепить"
              className="flex-shrink-0 p-2 rounded-full text-gray-600 hover:bg-gray-300/80 active:scale-95 transition-all disabled:opacity-50"
              aria-label="Прикрепить"
            >
              <Paperclip className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </>
        )}

        <div className="flex-1 min-w-0 flex items-end">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasAttachment ? 'Подпись к файлу (необязательно)' : 'Сообщение...'}
            rows={TEXTAREA_MIN_ROWS}
            className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none min-h-[40px] max-h-[120px] overflow-y-auto"
            style={{ lineHeight: `${LINE_HEIGHT_PX}px` }}
          />
        </div>

        {onCameraCapture && showCameraButton && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept={ACCEPT_CAMERA}
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCameraCapture(file);
                e.target.value = '';
              }}
              aria-label="Камера"
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isRecordingVoice}
              title="Камера"
              className="flex-shrink-0 p-2 rounded-full text-gray-600 hover:bg-gray-300/80 active:scale-95 transition-all disabled:opacity-50"
              aria-label="Камера"
            >
              <Camera className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleActionClick}
          disabled={
            disabled ||
            (isRecordingVoice ? false : showSend ? isBusy : !(onStartVoice && !hasAttachment))
          }
          title={
            isRecordingVoice ? 'Остановить запись' : showSend ? 'Отправить' : 'Голосовое сообщение'
          }
          className={`flex-shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-[background-color,opacity,transform] duration-150 ease-out active:scale-95 ${
            isRecordingVoice
              ? 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-70'
              : 'bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
          aria-label={isRecordingVoice ? 'Остановить' : showSend ? 'Отправить' : 'Микрофон'}
        >
          <span className="inline-flex items-center justify-center transition-opacity duration-150">
            {isBusy && showSend && !isRecordingVoice ? (
              <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
            ) : isRecordingVoice ? (
              <Square className="w-5 h-5 md:w-6 md:h-6 fill-current" />
            ) : showSend ? (
              <Send className="w-5 h-5 md:w-6 md:h-6" />
            ) : (
              <Mic className="w-5 h-5 md:w-6 md:h-6" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
export { MAX_ATTACHMENT_MB, ACCEPT_ATTACHMENTS };
