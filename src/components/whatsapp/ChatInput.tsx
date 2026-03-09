import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Paperclip, Mic, Square, Loader2, Camera, Image, FileText, Music, User, Smile } from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Categories } from 'emoji-picker-react';

const MAX_ATTACHMENT_MB = 10;

/** Русская локализация emoji picker: категории и подписи */
const EMOJI_PICKER_RU = {
  searchPlaceholder: 'Поиск эмодзи...',
  previewCaption: 'Выберите эмодзи',
  categories: [
    { category: Categories.SUGGESTED, name: 'Недавние' },
    { category: Categories.SMILEYS_PEOPLE, name: 'Смайлы и люди' },
    { category: Categories.ANIMALS_NATURE, name: 'Животные и природа' },
    { category: Categories.FOOD_DRINK, name: 'Еда и напитки' },
    { category: Categories.TRAVEL_PLACES, name: 'Путешествия и места' },
    { category: Categories.ACTIVITIES, name: 'Активности' },
    { category: Categories.OBJECTS, name: 'Объекты' },
    { category: Categories.SYMBOLS, name: 'Символы' },
    { category: Categories.FLAGS, name: 'Флаги' }
  ] as Array<{ category: Categories; name: string }>
};
const ACCEPT_ATTACHMENTS = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt';
/** Только камера: на mobile с capture открывает съёмку напрямую */
const ACCEPT_CAMERA = 'image/*,video/*';
const ACCEPT_GALLERY = 'image/*,video/*';
const ACCEPT_DOCUMENT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,application/pdf';
const ACCEPT_AUDIO = 'audio/*';

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const hasText = value.trim().length > 0;
  const showSend = hasText || hasAttachment;
  const isBusy = sending;

  const openCamera = () => {
    setShowAttachmentSheet(false);
    cameraInputRef.current?.click();
  };
  const openGallery = () => {
    setShowAttachmentSheet(false);
    galleryInputRef.current?.click();
  };
  const openDocument = () => {
    setShowAttachmentSheet(false);
    documentInputRef.current?.click();
  };
  const openAudio = () => {
    setShowAttachmentSheet(false);
    audioInputRef.current?.click();
  };

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

  const handleEmojiClick = useCallback(
    (data: EmojiClickData) => {
      const el = textareaRef.current;
      if (el) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const newVal = value.slice(0, start) + data.emoji + value.slice(end);
        onChange(newVal);
        el.focus();
        requestAnimationFrame(() => {
          const pos = start + data.emoji.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        onChange(value + data.emoji);
      }
    },
    [value, onChange]
  );

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-emoji-picker-trigger]')
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const containerClass = fixedBottom
    ? 'fixed left-0 right-0 border-t border-gray-200 bg-[#f0f2f5]'
    : 'flex-none bg-[#f0f2f5]';
  const containerStyle = fixedBottom
    ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' as const }
    : undefined;

  return (
    <>
      <div className={`${containerClass} py-2 px-2 md:px-3 relative`} style={containerStyle}>
        {/* Скрытые инпуты (вне визуального потока) */}
        {onFileSelect && (
          <>
            <input ref={galleryInputRef} type="file" accept={ACCEPT_GALLERY} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }} />
            <input ref={documentInputRef} type="file" accept={ACCEPT_DOCUMENT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }} />
            <input ref={audioInputRef} type="file" accept={ACCEPT_AUDIO} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }} />
          </>
        )}
        {onCameraCapture && (
          <input ref={cameraInputRef} type="file" accept={ACCEPT_CAMERA} capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCameraCapture(f); e.target.value = ''; }} aria-label="Камера" />
        )}

        {/* Порядок как в WhatsApp: [emoji] [поле + скрепка + камера] [зелёная кнопка] */}
        <div className="flex items-end gap-1.5 md:gap-2 max-w-full">
          {/* Input area (pill): слева emoji, центр textarea, справа скрепка и камера */}
          <div className="flex-1 min-w-0 flex items-end rounded-2xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 min-h-[40px]">
            <button
              type="button"
              data-emoji-picker-trigger
              onClick={() => setShowEmojiPicker((v) => !v)}
              disabled={disabled}
              title="Эмодзи"
              className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-l-2xl transition-colors disabled:opacity-50"
              aria-label="Эмодзи"
              aria-pressed={showEmojiPicker}
            >
              <Smile className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowEmojiPicker(false)}
              placeholder={hasAttachment ? 'Подпись к файлу (необязательно)' : 'Сообщение...'}
              rows={TEXTAREA_MIN_ROWS}
              className="flex-1 min-w-0 resize-none bg-transparent border-0 px-1 py-2.5 text-sm outline-none min-h-[36px] max-h-[120px] overflow-y-auto rounded-none"
              style={{ lineHeight: `${LINE_HEIGHT_PX}px` }}
            />
            {onFileSelect && (
              <button
                type="button"
                onClick={() => setShowAttachmentSheet(true)}
                disabled={disabled || isRecordingVoice}
                title="Прикрепить"
                className={`flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 ${onCameraCapture && showCameraButton ? 'rounded-r-none' : 'rounded-r-2xl'}`}
                aria-label="Прикрепить"
              >
                <Paperclip className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}
            {onCameraCapture && showCameraButton && (
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled || isRecordingVoice}
                title="Камера"
                className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-r-2xl transition-colors disabled:opacity-50"
                aria-label="Камера"
              >
                <Camera className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}
          </div>

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

      {/* Emoji picker: над панелью ввода */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute left-2 right-2 bottom-full mb-1 z-10 rounded-xl overflow-hidden shadow-lg"
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="light"
            width="100%"
            height={320}
            searchPlaceHolder={EMOJI_PICKER_RU.searchPlaceholder}
            searchPlaceholder={EMOJI_PICKER_RU.searchPlaceholder}
            categories={EMOJI_PICKER_RU.categories}
            previewConfig={{ defaultCaption: EMOJI_PICKER_RU.previewCaption }}
          />
        </div>
      )}
    </div>

      {/* Attachment bottom sheet (WhatsApp-style): скрепка → меню вложений */}
      {showAttachmentSheet && onFileSelect && (
        <div
          className="fixed inset-0 z-[1100] flex flex-col justify-end"
          aria-modal="true"
          role="dialog"
          aria-label="Выбор вложения"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAttachmentSheet(false)}
            aria-label="Закрыть"
          />
          <div
            className="relative bg-white rounded-t-2xl shadow-xl pb-[env(safe-area-inset-bottom)] pt-2"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" aria-hidden />
            <div className="grid grid-cols-4 gap-3 px-4 pb-2">
              <button
                type="button"
                onClick={openGallery}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <span className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <Image className="w-6 h-6 text-gray-700" />
                </span>
                <span className="text-xs text-gray-700">Галерея</span>
              </button>
              {onCameraCapture && (
                <button
                  type="button"
                  onClick={openCamera}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <span className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-700" />
                  </span>
                  <span className="text-xs text-gray-700">Камера</span>
                </button>
              )}
              <button
                type="button"
                onClick={openDocument}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <span className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-700" />
                </span>
                <span className="text-xs text-gray-700">Документ</span>
              </button>
              <button
                type="button"
                onClick={openAudio}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <span className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <Music className="w-6 h-6 text-gray-700" />
                </span>
                <span className="text-xs text-gray-700">Аудио</span>
              </button>
              <button
                type="button"
                disabled
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl opacity-50 cursor-not-allowed"
                title="Скоро"
              >
                <span className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </span>
                <span className="text-xs text-gray-500">Контакт</span>
                <span className="text-[10px] text-gray-400">Скоро</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatInput;
export { MAX_ATTACHMENT_MB, ACCEPT_ATTACHMENTS };
