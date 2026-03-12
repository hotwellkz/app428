import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Square,
  Loader2,
  Camera,
  Image,
  FileText,
  Music,
  User,
  Smile,
  Sparkles,
  Zap,
  Target,
  Calculator
} from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Categories } from 'emoji-picker-react';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { QuickRepliesPopup, type QuickReplyItem } from './QuickRepliesPopup';
import { MediaQuickRepliesPopup } from './MediaQuickRepliesPopup';
import type { MediaQuickReply } from '../../types/mediaQuickReplies';

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
const TEXTAREA_MIN_HEIGHT_MOBILE = 40;
const TEXTAREA_MAX_HEIGHT_MOBILE = 140;
const TEXTAREA_MIN_HEIGHT_DESKTOP = 42;
const TEXTAREA_MAX_HEIGHT_DESKTOP = 160;

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
  /** Вызов AI-ответа по режиму */
  onAiReply?: (mode: 'normal' | 'short' | 'close') => void;
  /** Какой режим сейчас генерируется (для loader на кнопке) */
  aiModeLoading?: 'normal' | 'short' | 'close' | null;
  /** Автофокус на поле при изменении value (для AI-подстановки) */
  autoFocusOnChange?: boolean;
  /** Открыть калькулятор стоимости (drawer в чате) */
  onOpenCalculator?: () => void;
  /** Шаблоны быстрых ответов (подсказки по ключевым словам в поле ввода) */
  quickReplies?: QuickReplyItem[];
  /** При выборе шаблона с вложением — отправить текст и файл (вместо вставки в поле) */
  onQuickReplySelect?: (item: QuickReplyItem) => void;
  /** Медиа-шаблоны (вызов по команде / в поле ввода) */
  mediaQuickReplies?: MediaQuickReply[];
  /** При выборе медиа-шаблона — отправить все изображения подряд */
  onMediaQuickReplySelect?: (reply: MediaQuickReply) => void;
}

const QUICK_REPLIES_MAX = 5;
const QUICK_REPLIES_MIN_TRIGGER_LEN = 3;

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
  onAiReply,
  aiModeLoading = null,
  autoFocusOnChange = false,
  onOpenCalculator,
  quickReplies = [],
  onQuickReplySelect,
  mediaQuickReplies = [],
  onMediaQuickReplySelect
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const voicePointerUsedRef = useRef(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedQuickIndex, setSelectedQuickIndex] = useState(0);

  const triggerWord = useMemo(() => {
    const v = value;
    const lastSpace = v.lastIndexOf(' ');
    const word = lastSpace === -1 ? v : v.slice(lastSpace + 1);
    return word.trim().toLowerCase();
  }, [value]);

  const slashQuery = useMemo(() => {
    const v = value.trim();
    if (!v.startsWith('/')) return null;
    return v.slice(1).trim().toLowerCase();
  }, [value]);

  const filteredQuickReplies = useMemo(() => {
    if (slashQuery !== null) return [];
    if (!quickReplies.length || triggerWord.length < QUICK_REPLIES_MIN_TRIGGER_LEN) return [];
    const q = triggerWord;
    return quickReplies
      .filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const textMatch = (item.text || '').toLowerCase().includes(q);
        const keywordsList = (item.keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
        const keywordsMatch = keywordsList.some((k) => k.includes(q) || q.includes(k));
        return titleMatch || textMatch || keywordsMatch;
      })
      .slice(0, QUICK_REPLIES_MAX);
  }, [quickReplies, triggerWord, slashQuery]);

  const filteredMediaQuickReplies = useMemo(() => {
    if (!value.trim().startsWith('/')) return [];
    if (!mediaQuickReplies.length) return [];
    const q = slashQuery ?? '';
    if (!q) return mediaQuickReplies.slice(0, QUICK_REPLIES_MAX);
    return mediaQuickReplies
      .filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const keywordsList = (item.keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
        const keywordsMatch = keywordsList.some((k) => k.includes(q) || q.includes(k));
        return titleMatch || keywordsMatch;
      })
      .slice(0, QUICK_REPLIES_MAX);
  }, [mediaQuickReplies, slashQuery, value]);

  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  useEffect(() => {
    setSelectedQuickIndex(0);
  }, [filteredQuickReplies.length, triggerWord]);

  useEffect(() => {
    setSelectedMediaIndex(0);
  }, [filteredMediaQuickReplies.length, slashQuery]);

  const quickRepliesOpen = filteredQuickReplies.length > 0;
  const mediaQuickRepliesOpen = filteredMediaQuickReplies.length > 0;

  const insertQuickReply = useCallback(
    (item: QuickReplyItem) => {
      const v = value;
      const lastSpace = v.lastIndexOf(' ');
      const prefix = lastSpace === -1 ? '' : v.slice(0, lastSpace + 1);
      const newValue = prefix + (item.text ?? '');
      onChange(newValue);
      setSelectedQuickIndex(0);
      if (item.files?.length > 0 || item.attachmentUrl) {
        onQuickReplySelect?.(item);
      }
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          const len = newValue.length;
          el.setSelectionRange(len, len);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    },
    [value, onChange, onQuickReplySelect]
  );

  const selectMediaQuickReply = useCallback(
    (reply: MediaQuickReply) => {
      if (onMediaQuickReplySelect) onMediaQuickReplySelect(reply);
      onChange('');
      setSelectedMediaIndex(0);
    },
    [onMediaQuickReplySelect, onChange]
  );

  const {
    isSupported: isSpeechSupported,
    isListening: isDictating,
    transcript: speechTranscript,
    error: speechError,
    start: startDictation,
    stop: stopDictation,
    reset: resetDictation
  } = useSpeechToText({ lang: 'ru-RU' });

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

  // Когда появился новый распознанный текст — добавляем его в draft
  useEffect(() => {
    if (!speechTranscript.trim()) return;

    const el = textareaRef.current;
    const insert = speechTranscript.trim();

    // Сбросим локальное состояние хука, чтобы не переиспользовать старый текст
    resetDictation();

    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const base = value;
      const prefix = base.slice(0, start);
      const suffix = base.slice(end);
      const sepBefore = prefix && !prefix.endsWith(' ') ? ' ' : '';
      const sepAfter = suffix && !suffix.startsWith(' ') ? ' ' : '';
      const next = prefix + sepBefore + insert + sepAfter + suffix;
      onChange(next);

      // После обновления значения восстанавливаем каретку сразу после вставленного текста
      requestAnimationFrame(() => {
        const el2 = textareaRef.current;
        if (!el2) return;
        const pos = (prefix + sepBefore + insert).length;
        el2.focus();
        el2.setSelectionRange(pos, pos);
      });
    } else {
      const base = value;
      const sep = base && !base.endsWith(' ') ? ' ' : '';
      onChange(base + sep + insert);
    }
  }, [speechTranscript, onChange, resetDictation, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mediaQuickRepliesOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMediaIndex((i) => Math.min(i + 1, filteredMediaQuickReplies.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMediaIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const item = filteredMediaQuickReplies[selectedMediaIndex];
        if (item) selectMediaQuickReply(item);
        return;
      }
      if (e.key === 'Escape') {
        setSelectedMediaIndex(0);
        return;
      }
    }
    if (quickRepliesOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedQuickIndex((i) => Math.min(i + 1, filteredQuickReplies.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedQuickIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const item = filteredQuickReplies[selectedQuickIndex];
        if (item) insertQuickReply(item);
        return;
      }
      if (e.key === 'Escape') {
        setSelectedQuickIndex(0);
        return;
      }
    }
    if (e.key !== 'Enter') return;
    // Enter → отправить сообщение; Shift + Enter → перенос строки
    if (!e.shiftKey) {
      e.preventDefault();
      if (showSend && !isBusy) onSend();
    }
  };

  const isMobileWidth = () =>
    typeof window !== 'undefined' && window.innerWidth <= 768;
  const getTextareaMinHeight = () =>
    isMobileWidth() ? TEXTAREA_MIN_HEIGHT_MOBILE : TEXTAREA_MIN_HEIGHT_DESKTOP;
  const getTextareaMaxHeight = () =>
    isMobileWidth() ? TEXTAREA_MAX_HEIGHT_MOBILE : TEXTAREA_MAX_HEIGHT_DESKTOP;

  const updateTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = getTextareaMinHeight();
    const maxH = getTextareaMaxHeight();
    const newHeight = Math.max(minH, Math.min(el.scrollHeight, maxH));
    el.style.height = `${newHeight}px`;
    if (el.scrollHeight > maxH) {
      el.style.overflowY = 'auto';
    } else {
      el.style.overflowY = '';
    }
  }, []);

  useEffect(() => {
    updateTextareaHeight();
    const el = textareaRef.current;
    if (
      el &&
      autoFocusOnChange &&
      !disabled &&
      typeof document !== 'undefined' &&
      document.activeElement !== el
    ) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [value, autoFocusOnChange, disabled, updateTextareaHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onInput = () => updateTextareaHeight();
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [updateTextareaHeight]);

  useEffect(() => {
    const onResize = () => updateTextareaHeight();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateTextareaHeight]);

  const handleActionClick = (e?: React.MouseEvent) => {
    if (voicePointerUsedRef.current) {
      voicePointerUsedRef.current = false;
      e?.preventDefault();
      return;
    }
    if (isRecordingVoice && onStopVoice) onStopVoice();
    else if (showSend && !isBusy) onSend();
    else if (!showSend && onStartVoice && !hasAttachment) onStartVoice();
  };

  const handleVoicePointerDown = () => {
    if (!onStartVoice || hasAttachment) return;
    voicePointerUsedRef.current = true;
    onStartVoice();
  };
  const handleVoicePointerUp = () => {
    if (onStopVoice && isRecordingVoice) onStopVoice();
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

        {/* Контейнер ввода: [слева иконки] [textarea на всю ширину] [справа иконки + отправить] */}
        <div className="flex items-end gap-1.5 md:gap-2 max-w-full min-w-0">
          <div className="flex-1 min-w-0 relative flex flex-col">
            {mediaQuickRepliesOpen && (
              <MediaQuickRepliesPopup
                items={filteredMediaQuickReplies}
                selectedIndex={selectedMediaIndex}
                onSelect={selectMediaQuickReply}
              />
            )}
            {quickRepliesOpen && !mediaQuickRepliesOpen && (
              <QuickRepliesPopup
                items={filteredQuickReplies}
                selectedIndex={selectedQuickIndex}
                onSelect={insertQuickReply}
              />
            )}
            {/* Мобильный: 2 строки (textarea | иконки). Десктоп: 1 строка (иконки | textarea | иконки) */}
            <div className="chat-input flex flex-col md:flex-row md:items-end gap-1.5 md:gap-2 p-1.5 px-2 md:py-2 md:px-3 rounded-2xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 min-h-0 md:min-h-[42px]">
              <div className="chat-input-text order-1 md:order-2 w-full md:flex-1 md:min-w-0 flex flex-col">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder={hasAttachment ? 'Подпись к файлу (необязательно)' : 'Сообщение...'}
                  rows={TEXTAREA_MIN_ROWS}
                  className="message-input chat-textarea w-full min-h-[40px] max-h-[140px] md:min-h-[42px] md:max-h-[160px] resize-none bg-transparent border-0 outline-none rounded-2xl py-2 px-2.5 md:py-2.5 md:px-3 leading-[1.4] text-base md:text-sm overflow-y-auto"
                />
              </div>
              <div className="chat-actions chat-input-actions order-2 flex min-w-0 items-center justify-between gap-1.5 md:contents">
                <div className="left-icons flex flex-shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    data-emoji-picker-trigger
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    disabled={disabled}
                    title="Эмодзи"
                    className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 md:h-auto md:w-auto md:p-2"
                    aria-label="Эмодзи"
                    aria-pressed={showEmojiPicker}
                  >
                    <Smile className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                  {onOpenCalculator && (
                    <button
                      type="button"
                      onClick={onOpenCalculator}
                      disabled={disabled}
                      title="Калькулятор стоимости"
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 md:h-auto md:w-auto md:p-2"
                      aria-label="Калькулятор стоимости"
                    >
                      <Calculator className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  )}
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isDictating) stopDictation();
                        else startDictation();
                      }}
                      disabled={disabled || isRecordingVoice}
                      title="Голосовая диктовка"
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 md:h-auto md:w-auto md:p-2"
                      aria-label="Голосовая диктовка"
                      aria-pressed={isDictating}
                    >
                      {isDictating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                {onAiReply && (
                  <div className="ai-tools ai-buttons flex min-w-0 flex-1 justify-center gap-1 md:order-3 md:flex-shrink-0 md:gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAiReply('normal')}
                      disabled={disabled || !!aiModeLoading}
                      className="ai-generate rounded-[14px] px-2 py-1 text-sm border border-dashed border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 inline-flex items-center justify-center min-w-[32px]"
                      title="AI сгенерировать ответ"
                    >
                      {aiModeLoading === 'normal' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAiReply('short')}
                      disabled={disabled || !!aiModeLoading}
                      className="ai-fast rounded-[14px] px-2 py-1 text-sm border border-dashed border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 inline-flex items-center justify-center min-w-[32px]"
                      title="AI: очень коротко"
                    >
                      {aiModeLoading === 'short' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAiReply('close')}
                      disabled={disabled || !!aiModeLoading}
                      className="ai-target rounded-[14px] px-2 py-1 text-sm border border-dashed border-amber-300 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-50 inline-flex items-center justify-center min-w-[32px]"
                      title="AI: продвинуть сделку"
                    >
                      {aiModeLoading === 'close' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Target className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
                <div className="right-icons flex flex-shrink-0 items-center gap-1.5 md:order-4 md:gap-1">
                  {onFileSelect && (
                    <button
                      type="button"
                      onClick={() => setShowAttachmentSheet(true)}
                      disabled={disabled || isRecordingVoice}
                      title="Прикрепить"
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 md:h-auto md:w-auto md:p-2"
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
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 md:h-auto md:w-auto md:p-2"
                      aria-label="Камера"
                    >
                      <Camera className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleActionClick(e)}
                    onPointerDown={!showSend && onStartVoice && !hasAttachment ? handleVoicePointerDown : undefined}
                    onPointerUp={onStopVoice && isRecordingVoice ? handleVoicePointerUp : undefined}
                    onPointerLeave={onStopVoice && isRecordingVoice ? handleVoicePointerUp : undefined}
                    disabled={
                      disabled ||
                      (isRecordingVoice ? false : showSend ? isBusy : !(onStartVoice && !hasAttachment))
                    }
                    title={
                      isRecordingVoice ? 'Отпустите для отправки' : showSend ? 'Отправить' : 'Удерживайте для записи голосового'
                    }
                    className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full transition-[background-color,opacity,transform] duration-150 ease-out active:scale-95 md:h-11 md:w-11 ${
                      isRecordingVoice
                        ? 'bg-red-500 text-white hover:bg-red-600 disabled:opacity-70'
                        : 'bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    aria-label={isRecordingVoice ? 'Отпустите для отправки' : showSend ? 'Отправить' : 'Микрофон'}
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
            </div>
          </div>
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
