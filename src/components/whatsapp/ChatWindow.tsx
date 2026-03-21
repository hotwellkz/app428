import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Image, Video, Music, FileText, X, Play, Pause, User, Shield, Send, Trash2, Mic } from 'lucide-react';
import ChatInput from './ChatInput';
import { WhatsAppCalculatorDrawer } from './WhatsAppCalculatorDrawer';
import MessageBubble from './MessageBubble';
import { PdfThumbnail } from './PdfThumbnail';
import { PdfViewer } from './PdfViewer';
import MessageActionBar from './MessageActionBar';
import MessageContextMenu from './MessageContextMenu';
import MessageReactionPicker from './MessageReactionPicker';
import MessageActionsSheet from './MessageActionsSheet';
import ReplyComposerPreview from './ReplyComposerPreview';
import type { WhatsAppMessage, MessageAttachment } from '../../types/whatsappDb';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';
import type { MobileWhatsappAiCrmConfig } from './MobileWhatsappAiComposer';
import { getAuthToken } from '../../lib/firebase/auth';
import { useAIConfigured } from '../../hooks/useAIConfigured';
import { transcribeVoiceBatch, getVoiceMessagesToTranscribe, type TranscribeVoiceBatchResult } from '../../utils/transcribeVoiceBatch';
import { getMessageTextContentForAi } from '../../utils/whatsappAiMessageContent';
import { capMessagesForTransport } from '../../utils/buildAiReplyContext';
import { detectRuKzLang, getTargetLangForTranslate, translateRuKz } from '../../utils/translateRuKz';
import toast from 'react-hot-toast';

interface PendingAttachment {
  file: File;
  preview?: string;
}

interface ChatWindowProps {
  selectedItem: ConversationListItem;
  /** Имя клиента из CRM для шапки чата; если нет — показывается номер */
  displayTitle?: string | null;
  messages: WhatsAppMessage[];
  inputText: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  onBack?: () => void;
  /** На мобильных — фиксированный инпут и скролл по calc(100vh - header - input) */
  isMobile?: boolean;
  /** Выбранный файл перед отправкой */
  pendingAttachment?: PendingAttachment | null;
  onFileSelect?: (file: File) => void;
  onClearAttachment?: () => void;
  /** 'uploading' | 'sending' — блокировать кнопку отправки */
  uploadState?: 'idle' | 'uploading' | 'sending';
  sendError?: string | null;
  /** Подготовка медиа (сжатие) перед загрузкой */
  mediaPreparing?: boolean;
  onDismissError?: () => void;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  isRecordingVoice?: boolean;
  /** Время начала записи (Date.now()) для таймера */
  recordingStartedAt?: number | null;
  onVoiceRecordCancel?: () => void;
  /** Запись закреплена свайпом вверх — отпускание не отправляет */
  voiceRecordingLocked?: boolean;
  onVoiceLock?: () => void;
  onCameraCapture?: (file: File) => void;
  showCameraButton?: boolean;
  /** Режим выбора сообщений */
  selectedMessageIds?: string[];
  onToggleSelectMessage?: (messageId: string) => void;
  onLongPressMessage?: (messageId: string) => void;
  onContextMenuMessage?: (e: React.MouseEvent, messageId: string) => void;
  onCloseSelection?: () => void;
  onReplyToMessage?: (messageId: string) => void;
  onForwardMessages?: (messageIds: string[]) => void;
  onDeleteMessages?: (messageIds: string[]) => void;
  onStarMessages?: (messageIds: string[]) => void;
  onCopyMessage?: (messageId: string) => void;
  onSelectionMore?: () => void;
  onReactionSelect?: (messageId: string, emoji: string) => void;
  /** Сообщение, на которое отвечаем (превью над полем ввода) */
  replyToMessage?: WhatsAppMessage | null;
  onCancelReply?: () => void;
  /** Контекстное меню (desktop) */
  contextMenu?: { messageId: string; x: number; y: number } | null;
  onCloseContextMenu?: () => void;
  /** Сообщение для быстрых реакций (mobile) */
  reactionPickerMessageId?: string | null;
  /** Сообщение для bottom sheet «Ещё» (mobile) */
  actionsSheetMessageId?: string | null;
  /** Режим инкогнито: просмотр без отметки о прочтении и без отправки */
  incognitoMode?: boolean;
  /** Переключение режима инкогнито (для кнопки в шапке на мобильном) */
  onToggleIncognito?: () => void;
  /** Открытие карточки клиента (mobile bottom sheet) */
  onOpenClientInfo?: () => void;
  /** Записи базы знаний компании для AI-ответов */
  knowledgeBase?: Array<{ title: string; content: string; category?: string }>;
  /** Шаблоны быстрых ответов (поиск по ключевым словам в поле ввода + контекст для AI) */
  quickReplies?: Array<{
    id: string;
    title: string;
    text: string;
    keywords: string;
    category: string;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'video' | 'file' | 'audio';
    attachmentFileName?: string;
  }>;
  /** При выборе шаблона с вложением — отправить текст и файл в чат */
  onQuickReplySelect?: (item: {
    id: string;
    title: string;
    text: string;
    keywords: string;
    category: string;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'video' | 'file' | 'audio';
    attachmentFileName?: string;
  }) => void;
  /** Медиа-шаблоны (вызов по / в поле ввода) */
  mediaQuickReplies?: Array<{ id: string; title: string; keywords: string; files: Array<{ url: string; order: number; fileName?: string }> }>;
  /** При выборе медиа-шаблона — отправить все изображения подряд */
  onMediaQuickReplySelect?: (reply: { id: string; title: string; keywords: string; files: Array<{ url: string; order: number; fileName?: string }> }) => void;
  /** Отправить сгенерированное КП (изображение) в чат */
  onSendProposalImage?: (blob: Blob, caption: string) => Promise<void>;
  /** Мобильный чат: CRM AI для компактных кнопок в поле ввода (режим/бот) */
  mobileCrmAiComposer?: MobileWhatsappAiCrmConfig | null;
  /** Показывать блок отладки AI-ответа (найденные шаблоны и база знаний) — для админов */
  showAiDebug?: boolean;
  /** При перетаскивании файлов в чат (только desktop) — отправить файлы */
  onFilesDrop?: (files: File[]) => void;
  /** Дизейблить кнопку «Расшифровать всё», когда идёт подготовка к анализу (prepare for analysis) */
  disableTranscribeAllButton?: boolean;
  /** Сообщить родителю, что массовая расшифровка запущена/завершена (чтобы дизейблить «Проанализировать чат») */
  onBatchTranscribeRunningChange?: (running: boolean) => void;
}

const CHAT_HEADER_HEIGHT = 56;

function formatVoiceTimer(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function VoiceRecordingStrip({
  recordingStartedAt,
  locked,
  onCancel,
  onSend
}: {
  recordingStartedAt: number;
  locked: boolean;
  onCancel?: () => void;
  onSend?: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000));
    update();
    const t = setInterval(update, 250);
    return () => clearInterval(t);
  }, [recordingStartedAt]);
  return (
    <div className="flex-none flex flex-col gap-2 px-3 py-3 bg-[#1e2a30] border-t border-[#2a3942] rounded-t-xl safe-area-pb">
      <div className="flex items-center gap-3 min-h-[44px]">
        <div className="flex items-center gap-2 text-white">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="font-mono text-base tabular-nums font-semibold tracking-wide">
            {formatVoiceTimer(seconds)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {locked ? (
            <p className="text-sm text-[#8696a0]">Запись закреплена · Отправьте или удалите</p>
          ) : (
            <p className="text-xs text-[#8696a0] leading-tight">
              Отпустите — отправить · Тяните <span className="text-emerald-400">↑</span> — без удержания
            </p>
          )}
        </div>
        {locked && (
          <div className="flex items-center gap-2 shrink-0">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2a3942] text-[#ea0038] hover:bg-[#3d4a54]"
                aria-label="Удалить запись"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            {onSend && (
              <button
                type="button"
                onClick={onSend}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-white hover:bg-[#06cf9c]"
                aria-label="Отправить голосовое"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {!locked && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-xs font-medium text-[#8696a0] hover:text-white underline"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}

type AttachmentCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'office' | 'unknown';

function getAttachmentCategory(att: MessageAttachment): AttachmentCategory {
  const mime = att.mimeType?.toLowerCase() ?? '';
  const name = att.fileName?.toLowerCase() ?? '';
  const urlPath = att.url ? att.url.split('?')[0].toLowerCase() : '';

  if (att.type === 'image' || mime.startsWith('image/')) return 'image';
  if (att.type === 'video' || mime.startsWith('video/')) return 'video';
  if (att.type === 'voice' || att.type === 'audio' || mime.startsWith('audio/')) return 'audio';

  if (mime === 'application/pdf' || name.endsWith('.pdf') || urlPath.endsWith('.pdf')) return 'pdf';

  if (
    mime === 'text/plain' ||
    name.endsWith('.txt') ||
    mime === 'application/json' ||
    name.endsWith('.json')
  ) {
    return 'text';
  }

  if (
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx')
  ) {
    return 'office';
  }

  return 'unknown';
}

function canPreviewInline(att: MessageAttachment): boolean {
  const cat = getAttachmentCategory(att);
  return cat === 'image' || cat === 'video' || cat === 'audio' || cat === 'pdf' || cat === 'text';
}

interface AttachmentPreviewModalProps {
  attachment: MessageAttachment;
  onClose: () => void;
}

const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({ attachment, onClose }) => {
  const category = getAttachmentCategory(attachment);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  useEffect(() => {
    if (category !== 'text') return;
    let cancelled = false;
    setTextLoading(true);
    setTextError(null);
    fetch(attachment.url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const txt = await res.text();
        if (!cancelled) {
          setTextContent(txt);
          setTextLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTextError(
            import.meta.env.DEV
              ? `Не удалось загрузить текст: ${String(err)}`
              : 'Не удалось загрузить текст файла'
          );
          setTextLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.url, category]);

  const title = attachment.fileName || 'Файл';
  const mimeLabel = attachment.mimeType || getAttachmentCategory(attachment);

  const openOriginal = () => {
    window.open(attachment.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/80 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-gray-900 text-white rounded-lg shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-gray-300 truncate">{mimeLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-white"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-3 md:p-4 flex items-center justify-center">
          {category === 'image' && (
            <img
              src={attachment.url}
              alt={attachment.fileName ?? ''}
              className="max-w-full max-h-[70vh] object-contain rounded bg-black"
            />
          )}
          {category === 'video' && (
            <video
              src={attachment.url}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[70vh] rounded bg-black"
            />
          )}
          {category === 'audio' && (
            <div className="w-full max-w-lg">
              <audio src={attachment.url} controls className="w-full" />
            </div>
          )}
          {category === 'pdf' && (
            <div className="w-full h-[70vh] min-h-0 rounded overflow-hidden flex flex-col">
              <PdfViewer
                url={attachment.url}
                fileName={attachment.fileName ?? title}
                onClose={onClose}
                toolbar
              />
            </div>
          )}
          {category === 'text' && (
            <div className="w-full max-h-[70vh] overflow-auto bg-black/60 rounded p-3 text-xs md:text-sm">
              {textLoading && <p className="text-gray-300">Загрузка содержимого…</p>}
              {textError && <p className="text-red-300">{textError}</p>}
              {!textLoading && !textError && (
                <pre className="whitespace-pre-wrap break-words font-mono text-gray-100">
                  {textContent ?? ''}
                </pre>
              )}
            </div>
          )}
          {(category === 'office' || category === 'unknown') && (
            <div className="text-center text-sm text-gray-200 space-y-2">
              <p>Предпросмотр для этого типа файла внутри CRM недоступен.</p>
              <p className="text-xs text-gray-400">
                Используйте «Открыть оригинал» или «Скачать», чтобы просмотреть документ.
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 text-xs md:text-sm">
          <div className="text-gray-300 truncate">{attachment.url}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openOriginal}
              className="text-green-400 hover:text-green-200 underline"
            >
              Открыть оригинал
            </button>
            <a
              href={attachment.url}
              download={attachment.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-200 hover:text-white underline"
            >
              Скачать
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Только один аудио-элемент воспроизводится одновременно (глобально в чате). */
let activeAudioRef: HTMLAudioElement | null = null;
function setActiveAudio(el: HTMLAudioElement | null) {
  if (activeAudioRef && activeAudioRef !== el) {
    activeAudioRef.pause();
  }
  activeAudioRef = el;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function AudioMessageBubble({ att }: { att: MessageAttachment }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setLoaded(true);
    };
    const onTimeUpdate = () => {
      if (!isDragging) setCurrentTime(el.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveAudio(null);
    };
    const onPause = () => {
      setIsPlaying(false);
      setActiveAudio(null);
    };
    const onPlay = () => setIsPlaying(true);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    el.addEventListener('play', onPlay);
    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('play', onPlay);
    };
  }, [att.url, isDragging]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setActiveAudio(null);
    } else {
      setActiveAudio(el);
      el.play().catch(() => setActiveAudio(null));
    }
  };

  const seekToPercent = useCallback(
    (percent: number) => {
      const pct = Math.max(0, Math.min(1, percent));
      const newTime = duration ? pct * duration : 0;
      setCurrentTime(newTime);
      const el = audioRef.current;
      if (el && Number.isFinite(newTime)) el.currentTime = newTime;
    },
    [duration]
  );

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekToPercent(pct);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekToPercent(pct);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const r = progressBarRef.current?.getBoundingClientRect();
      if (!r) return;
      const percent = (moveEvent.clientX - r.left) / r.width;
      seekToPercent(percent);
    };
    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const percent = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="mt-1 flex items-center gap-2 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={att.url} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors"
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          ref={progressBarRef}
          role="progressbar"
          aria-valuenow={duration ? percent * 100 : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-1.5 bg-gray-300 rounded-full cursor-pointer overflow-visible select-none"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          <div
            className="absolute inset-y-0 left-0 bg-green-600 rounded-full pointer-events-none transition-none"
            style={{ width: `${percent * 100}%` }}
          />
          <div
            className="absolute top-1/2 w-3 h-3 -mt-1.5 -ml-1.5 rounded-full bg-[#25D366] border-2 border-white shadow cursor-grab active:cursor-grabbing pointer-events-none"
            style={{ left: `${percent * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-0.5 flex justify-between">
          <span>{formatDuration(currentTime)}</span>
          <span>{loaded ? formatDuration(duration) : '…'}</span>
        </p>
      </div>
    </div>
  );
}

/** Кадр с ~0.5 с для poster (без скачивания; в чате как WhatsApp). */
function useVideoPoster(videoUrl: string, existingPoster?: string | null): string | undefined {
  const [poster, setPoster] = useState<string | undefined>(existingPoster ?? undefined);
  useEffect(() => {
    if (existingPoster) {
      setPoster(existingPoster);
      return;
    }
    let cancelled = false;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    const url = videoUrl;
    v.src = url;

    const capture = () => {
      if (cancelled || !v.videoWidth) return;
      try {
        const c = document.createElement('canvas');
        const w = Math.min(320, v.videoWidth);
        const h = Math.round((w / v.videoWidth) * v.videoHeight);
        c.width = w;
        c.height = h || 180;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const data = c.toDataURL('image/jpeg', 0.72);
        if (!cancelled) setPoster(data);
      } catch {
        /* CORS / tainted canvas — остаётся первый кадр из metadata */
      }
    };

    const onSeeked = () => capture();
    const onError = () => {
      if (!cancelled) setPoster(undefined);
    };
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('error', onError);
    v.addEventListener('loadeddata', () => {
      try {
        v.currentTime = Math.min(0.5, (v.duration && isFinite(v.duration) ? v.duration * 0.05 : 0) || 0.5);
      } catch {
        v.currentTime = 0.5;
      }
    });

    return () => {
      cancelled = true;
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onError);
      v.src = '';
    };
  }, [videoUrl, existingPoster]);
  return poster;
}

function VideoMessageBubble({ att }: { att: MessageAttachment }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generatedPoster = useVideoPoster(att.url, att.thumbnailUrl);
  const poster = att.thumbnailUrl || generatedPoster;

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    setDuration(isFinite(el.duration) ? el.duration : null);
  };

  const handleError = () => {
    setError('Не удалось загрузить видео');
    if (import.meta.env.DEV) {
      console.warn('[WhatsApp] video playback error:', {
        url: att.url,
        mimeType: att.mimeType,
        fileName: att.fileName
      });
    }
  };

  const durationLabel =
    duration != null && Number.isFinite(duration) ? formatDuration(duration) : null;

  const mime = att.mimeType?.startsWith('video/') ? att.mimeType : 'video/mp4';

  return (
    <div className="mt-1 rounded-xl overflow-hidden max-w-[260px] bg-black">
      {!error ? (
        <div className="relative w-full">
          <video
            ref={videoRef}
            className="chat-video block w-full max-w-[260px] max-h-[320px] object-contain bg-black rounded-xl"
            controls
            playsInline
            preload="metadata"
            poster={poster}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
          >
            <source src={att.url} type={mime} />
          </video>
          {durationLabel && (
            <div
              className="pointer-events-none absolute bottom-10 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white text-[11px] tabular-nums"
              aria-hidden
            >
              {durationLabel}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 text-sm text-gray-200">{error}</div>
      )}
    </div>
  );
}

function AttachmentBlock({
  att,
  onPreview
}: {
  att: MessageAttachment;
  onPreview?: (att: MessageAttachment) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isImage =
    att.type === 'image' || (att.type === 'file' && getAttachmentCategory(att) === 'image');
  const isVideo =
    att.type === 'video' || (att.type === 'file' && getAttachmentCategory(att) === 'video');
  const isAudio =
    att.type === 'audio' ||
    att.type === 'voice' ||
    (att.type === 'file' && getAttachmentCategory(att) === 'audio');
  const label =
    att.type === 'image'
      ? 'Изображение'
      : att.type === 'video'
        ? 'Видео'
        : att.type === 'voice'
          ? 'Голосовое сообщение'
          : att.type === 'audio'
            ? 'Аудио'
            : att.fileName || 'Файл';

  const link = (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:underline break-all"
    >
      {isImage && <Image className="w-4 h-4 flex-shrink-0" />}
      {isVideo && <Video className="w-4 h-4 flex-shrink-0" />}
      {isAudio && <Music className="w-4 h-4 flex-shrink-0" />}
      {att.type === 'file' && <FileText className="w-4 h-4 flex-shrink-0" />}
      <span>{label}</span>
    </a>
  );

  const handleOpen = () => {
    if (onPreview && canPreviewInline(att)) {
      onPreview(att);
    } else {
      window.open(att.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (isImage && !imgError) {
    return (
      <div className="mt-1 rounded overflow-hidden max-w-full">
        <button
          type="button"
          onClick={() => onPreview?.(att)}
          className="block focus:outline-none"
        >
          <img
            src={att.url}
            alt=""
            className="max-h-48 max-w-full object-contain rounded border border-gray-200"
            onError={() => setImgError(true)}
          />
        </button>
      </div>
    );
  }
  if (isImage && imgError) {
    return (
      <div className="mt-1 p-2 rounded bg-gray-100 border border-gray-200">
        {link}
        <span className="text-xs text-gray-500 ml-1">(превью недоступно)</span>
      </div>
    );
  }
  if (isVideo) {
    return <VideoMessageBubble att={att} />;
  }
  if (isAudio) {
    return <AudioMessageBubble att={att} />;
  }
  // PDF: карточка с превью первой страницы, открытие в модалке (не скачивание)
  if (getAttachmentCategory(att) === 'pdf') {
    const openInModal = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPreview?.(att);
    };
    return (
      <div className="mt-1 rounded-lg border border-gray-200 bg-white overflow-hidden max-w-[280px] shadow-sm">
        <button
          type="button"
          onClick={openInModal}
          className="block w-full text-left focus:outline-none"
          aria-label="Открыть PDF"
        >
          <PdfThumbnail url={att.url} className="w-full" />
        </button>
        <div className="p-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-800 truncate">{att.fileName || 'Документ.pdf'}</p>
          {att.size != null && (
            <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={openInModal}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
          >
            Открыть
          </button>
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                const res = await fetch(att.url, { mode: 'cors' });
                if (!res.ok) throw new Error('Fetch failed');
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = att.fileName ?? 'document.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
              } catch {
                window.open(att.url, '_blank', 'noopener,noreferrer');
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm"
          >
            Скачать
          </button>
        </div>
      </div>
    );
  }
  // Fallback: файл с .pdf в имени или URL — показываем как PDF (открытие в модалке, не window.open)
  const looksLikePdf =
    att.type === 'file' &&
    (att.fileName?.toLowerCase().endsWith('.pdf') ||
      (att.url && att.url.split('?')[0].toLowerCase().endsWith('.pdf')));
  if (looksLikePdf && onPreview) {
    const openInModal = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPreview(att);
    };
    return (
      <div className="mt-1 rounded-lg border border-gray-200 bg-white overflow-hidden max-w-[280px] shadow-sm">
        <button
          type="button"
          onClick={openInModal}
          className="block w-full text-left focus:outline-none"
          aria-label="Открыть PDF"
        >
          <PdfThumbnail url={att.url} className="w-full" />
        </button>
        <div className="p-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-800 truncate">{att.fileName || 'Документ.pdf'}</p>
          {att.size != null && (
            <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 px-2 pb-2">
          <button
            type="button"
            onClick={openInModal}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
          >
            Открыть
          </button>
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                const res = await fetch(att.url, { mode: 'cors' });
                if (!res.ok) throw new Error('Fetch failed');
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = att.fileName ?? 'document.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
              } catch {
                window.open(att.url, '_blank', 'noopener,noreferrer');
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm"
          >
            Скачать
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 p-2 rounded bg-gray-100 border border-gray-200">
      {att.type === 'file' ? (
        <>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-700 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800 truncate">{att.fileName || 'Файл'}</p>
              {att.mimeType && (
                <p className="text-xs text-gray-500 truncate">{att.mimeType}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-700">
            <button
              type="button"
              onClick={handleOpen}
              className="text-green-700 hover:text-green-800 hover:underline"
            >
              Открыть
            </button>
            <a
              href={att.url}
              download={att.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-800 hover:underline"
            >
              Скачать
            </a>
          </div>
        </>
      ) : (
        link
      )}
    </div>
  );
}

const ChatWindow: React.FC<ChatWindowProps> = (props) => {
  const {
    selectedItem,
    displayTitle,
    messages,
    inputText,
    onInputChange,
    onSend,
    sending,
    onBack,
    isMobile = false,
    pendingAttachment = null,
    onFileSelect,
    onClearAttachment,
    uploadState = 'idle',
    sendError = null,
    mediaPreparing = false,
    onDismissError,
    onStartVoice,
    onStopVoice,
    isRecordingVoice = false,
    recordingStartedAt = null,
    onVoiceRecordCancel,
    voiceRecordingLocked = false,
    onVoiceLock,
    onCameraCapture,
    showCameraButton = false,
    selectedMessageIds = [],
    onToggleSelectMessage,
    onLongPressMessage,
    onContextMenuMessage,
    onCloseSelection,
    onReplyToMessage,
    onForwardMessages,
    onDeleteMessages,
    onStarMessages,
    onCopyMessage,
    onSelectionMore,
    onReactionSelect,
    replyToMessage = null,
    onCancelReply,
    contextMenu = null,
    onCloseContextMenu,
    reactionPickerMessageId = null,
    actionsSheetMessageId = null,
    incognitoMode = false,
    onToggleIncognito,
    onOpenClientInfo,
    knowledgeBase,
    quickReplies = [],
    onSendProposalImage,
    showAiDebug = false,
    onFilesDrop,
    disableTranscribeAllButton = false,
    onBatchTranscribeRunningChange,
    mobileCrmAiComposer = null,
  } = props;
  const onQuickReplySelect = props.onQuickReplySelect;
  const mediaQuickReplies = props.mediaQuickReplies ?? [];
  const onMediaQuickReplySelect = props.onMediaQuickReplySelect;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  /** Сохранённая позиция скролла при нажатии «Расшифровать» — восстанавливаем после обновления messages */
  const scrollRestoreRef = useRef<number | null>(null);
  const messagesById = useRef<Map<string, WhatsAppMessage>>(new Map());
  messagesById.current = new Map(messages.map((m) => [m.id, m]));
  const [previewAtt, setPreviewAtt] = useState<MessageAttachment | null>(null);
  const [lastAiDebug, setLastAiDebug] = useState<{
    matchedQuickReplies: Array<{ title: string; score: number; textPreview: string }>;
    matchedKnowledgeBase: Array<{ title: string; category: string }>;
    chosenTemplate: string | null;
  } | null>(null);

  /** Скролл к последнему сообщению: после загрузки сообщений и после отправки */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (scrollRestoreRef.current !== null && container) {
      container.scrollTop = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
      return;
    }
    if (container) {
      container.scrollTop = container.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  const { configured: aiConfigured } = useAIConfigured();

  /** Кэш переводов сообщений RU↔KZ (messageId → текст перевода) */
  const [translationByMessageId, setTranslationByMessageId] = useState<Record<string, string>>({});
  /** Видимость блока перевода по messageId */
  const [translationVisibleByMessageId, setTranslationVisibleByMessageId] = useState<Record<string, boolean>>({});
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);
  const [translateInputLoading, setTranslateInputLoading] = useState(false);

  /** При открытии чата (смена выбранного) — прокрутить вниз и сбросить локальные расшифровки */
  const chatKey = selectedItem?.id ?? selectedItem?.clientId ?? '';
  useEffect(() => {
    if (!chatKey) return;
    setTranscriptionUpdates({});
    setBatchTranscribeResult(null);
    const t = setTimeout(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }, 100);
    return () => clearTimeout(t);
  }, [chatKey]);

  const phone = selectedItem.phone ?? selectedItem.client?.phone ?? selectedItem.clientId ?? '—';
  const title = displayTitle?.trim() || phone;
  const selectionMode = selectedMessageIds.length > 0;
  const actionsSheetMessage = actionsSheetMessageId
    ? messages.find((m) => m.id === actionsSheetMessageId)
    : null;

  const [aiMode, setAiMode] = useState<'normal' | 'short' | 'close' | null>(null);
  /** Фаза при нажатии AI-кнопки: сначала расшифровка, потом генерация */
  const [aiPhase, setAiPhase] = useState<'transcribing' | 'generating' | null>(null);
  const [aiTranscribeProgress, setAiTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [calculatorDrawerOpen, setCalculatorDrawerOpen] = useState(false);
  const [transcribeErrorId, setTranscribeErrorId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /** Массовая расшифровка: защита от повторного запуска и прогресс */
  const batchTranscribeRunningRef = useRef(false);
  const [batchTranscribeProgress, setBatchTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchTranscribeResult, setBatchTranscribeResult] = useState<{ done: number; skipped: number; errors: number } | null>(null);
  /** Оптимистичные расшифровки (пока Firestore не обновился) */
  const [transcriptionUpdates, setTranscriptionUpdates] = useState<Record<string, string>>({});

  /** Голосовые (audio/voice) без transcript для текущего чата. Плейсхолдер в text не считается расшифровкой. */
  const voiceToTranscribe = React.useMemo(() => {
    const list: { message: WhatsAppMessage; att: MessageAttachment }[] = [];
    for (const m of messages) {
      if (m.deleted) continue;
      const audioAtt = m.attachments?.find((a) => a.type === 'audio' || a.type === 'voice');
      if (!audioAtt?.url) continue;
      const hasTranscript = (transcriptionUpdates[m.id] ?? m.transcription ?? '').trim().length > 0;
      if (hasTranscript) continue;
      list.push({ message: m, att: audioAtt });
    }
    return list;
  }, [messages, transcriptionUpdates]);

  /** Исключить из списка «к расшифровке» сообщение, которое уже расшифровывается по одной кнопке (чтобы не дублировать запрос) */
  const voiceToTranscribeFiltered = React.useMemo(() => {
    if (batchTranscribeProgress !== null) return voiceToTranscribe;
    if (!transcribingId) return voiceToTranscribe;
    return voiceToTranscribe.filter((x) => x.message.id !== transcribingId);
  }, [voiceToTranscribe, transcribingId, batchTranscribeProgress]);

  const hasAnyVoiceInChat = React.useMemo(
    () => messages.some((m) => !m.deleted && m.attachments?.some((a) => a.type === 'audio' || a.type === 'voice')),
    [messages]
  );

  const handleAiReply = async (mode: 'normal' | 'short' | 'close') => {
    if (!onInputChange || !messages || messages.length === 0) return;
    if (aiMode) return;

    setAiMode(mode);
    let transcribeResult: TranscribeVoiceBatchResult | null = null;

    try {
      const itemsToTranscribe = voiceToTranscribe.map(({ message: m, att }) => ({ messageId: m.id, audioUrl: att.url }));

      if (itemsToTranscribe.length > 0) {
        setAiPhase('transcribing');
        setAiTranscribeProgress({ current: 0, total: itemsToTranscribe.length });
        const result = await transcribeVoiceBatch(
          itemsToTranscribe,
          getAuthToken,
          (current, total) => setAiTranscribeProgress({ current, total })
        );
        transcribeResult = result;
        if (result.updates && Object.keys(result.updates).length > 0) {
          result.updates &&
            Object.entries(result.updates).forEach(([id, txt]) => {
              const m = messages.find((msg) => msg.id === id);
              if (m) messagesById.current.set(id, { ...m, transcription: txt });
            });
          setTranscriptionUpdates((prev) => ({ ...prev, ...result.updates }));
        }
        if (result.errors > 0) {
          toast('Часть голосовых не удалось расшифровать. Ответ по остальным сообщениям.', { duration: 4000, icon: '⚠️' });
        }
        setAiTranscribeProgress(null);
        setAiPhase('generating');
      } else {
        setAiPhase('generating');
      }

      const mergedUpdates = { ...transcriptionUpdates, ...(transcribeResult?.updates ?? {}) };
      const chronological = messages
        .map((m) => ({
          ...m,
          _content: getMessageTextContentForAi(m, mergedUpdates)
        }))
        .filter((m) => m._content.length > 0 && !m.deleted);

      if (chronological.length === 0) {
        toast('Нет текста для генерации ответа. Расшифруйте голосовые или дождитесь сообщений.', { duration: 3500 });
        return;
      }

      const mappedMessages = chronological.map((m) => ({
        role: m.direction === 'incoming' ? ('client' as const) : ('manager' as const),
        text: m._content.replace(/<[^>]*>/g, '').trim()
      }));

      const messagesForApi = capMessagesForTransport(mappedMessages);

      const crmContext: Record<string, string | number> = {};
      const displayName = (selectedItem.client?.name ?? '').trim() || (selectedItem.displayTitle ?? '').trim();
      if (displayName) crmContext.clientName = displayName;
      if (selectedItem.city?.trim()) crmContext.city = selectedItem.city.trim();
      if (selectedItem.dealTitle?.trim()) crmContext.dealTitle = selectedItem.dealTitle.trim();
      if (selectedItem.dealStageName?.trim()) crmContext.dealStageName = selectedItem.dealStageName.trim();
      if (selectedItem.dealResponsibleName?.trim()) {
        crmContext.dealResponsibleName = selectedItem.dealResponsibleName.trim();
      }
      if (selectedItem.kaspiOrderNumber?.trim()) {
        crmContext.kaspiOrderNumber = selectedItem.kaspiOrderNumber.trim();
      }
      if (selectedItem.kaspiOrderStatus?.trim()) {
        crmContext.kaspiOrderStatus = selectedItem.kaspiOrderStatus.trim();
      }
      if (typeof selectedItem.kaspiOrderAmount === 'number' && !Number.isNaN(selectedItem.kaspiOrderAmount)) {
        crmContext.kaspiOrderAmount = selectedItem.kaspiOrderAmount;
      }

      const payload: {
        mode: 'normal' | 'short' | 'close';
        messages: { role: 'client' | 'manager'; text: string }[];
        knowledgeBase?: { title?: string; content?: string; category?: string | null }[];
        quickReplies?: Array<{ title: string; text: string; keywords: string; category?: string }>;
        crmContext?: Record<string, string | number>;
      } = {
        mode,
        messages: messagesForApi
      };

      if (Object.keys(crmContext).length > 0) {
        payload.crmContext = crmContext;
      }

      if (knowledgeBase && knowledgeBase.length > 0) {
        payload.knowledgeBase = knowledgeBase.map((k) => ({
          title: k.title,
          content: k.content,
          category: k.category ?? ''
        }));
      }
      if (quickReplies && quickReplies.length > 0) {
        payload.quickReplies = quickReplies.map((q) => ({
          title: q.title,
          text: q.text,
          keywords: q.keywords,
          category: q.category
        }));
      }
      const token = await getAuthToken();
      if (!token) {
        return;
      }
      const res = await fetch('/.netlify/functions/ai-generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        debug?: {
          matchedQuickReplies: Array<{ title: string; score: number; textPreview: string }>;
          matchedKnowledgeBase: Array<{ title: string; category: string }>;
          chosenTemplate: string | null;
        };
      };
      if (!res.ok || data.error) {
        toast.error(data.error ?? 'Ошибка генерации ответа');
        return;
      }
      if (data.debug) {
        setLastAiDebug(data.debug);
      } else {
        setLastAiDebug(null);
      }
      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
      if (reply) {
        onInputChange(reply);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка при подготовке ответа');
    } finally {
      setAiMode(null);
      setAiPhase(null);
      setAiTranscribeProgress(null);
    }
  };

  /** Перевод сообщения RU↔KZ: переключить видимость или запросить перевод */
  const handleTranslateMessage = useCallback(
    async (messageId: string) => {
      if (!aiConfigured) {
        toast.error('Для перевода подключите AI API key в разделе Интеграции');
        return;
      }
      const msg = messages.find((m) => m.id === messageId);
      const text = (msg?.text ?? '').trim();
      if (!text) return;

      const cached = translationByMessageId[messageId];
      const visible = translationVisibleByMessageId[messageId];

      if (cached !== undefined) {
        setTranslationVisibleByMessageId((prev) => ({ ...prev, [messageId]: !visible }));
        return;
      }

      const detected = detectRuKzLang(text);
      const targetLang = getTargetLangForTranslate(detected);
      if (!targetLang) {
        toast.error('Перевод доступен только для русского и казахского');
        return;
      }

      setTranslatingMessageId(messageId);
      try {
        const token = await getAuthToken();
        if (!token) {
          toast.error('Требуется авторизация');
          return;
        }
        const { translated } = await translateRuKz(text, targetLang, token);
        setTranslationByMessageId((prev) => ({ ...prev, [messageId]: translated }));
        setTranslationVisibleByMessageId((prev) => ({ ...prev, [messageId]: true }));
      } catch (e) {
        const msgErr = e instanceof Error ? e.message : 'Ошибка перевода';
        toast.error(msgErr);
      } finally {
        setTranslatingMessageId(null);
      }
    },
    [aiConfigured, messages, translationByMessageId, translationVisibleByMessageId]
  );

  /** Перевести текст в поле ввода RU↔KZ (заменить текст переводом) */
  const handleTranslateInput = useCallback(async () => {
    const text = (inputText ?? '').trim();
    if (!text) return;
    if (!aiConfigured) {
      toast.error('Для перевода подключите AI API key в разделе Интеграции');
      return;
    }
    const detected = detectRuKzLang(text);
    const targetLang = getTargetLangForTranslate(detected);
    if (!targetLang) {
      toast.error('Перевод доступен только для русского и казахского');
      return;
    }
    setTranslateInputLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Требуется авторизация');
        return;
      }
      const { translated } = await translateRuKz(text, targetLang, token);
      onInputChange(translated);
      toast.success('Текст заменён переводом');
    } catch (e) {
      const msgErr = e instanceof Error ? e.message : 'Ошибка перевода';
      toast.error(msgErr);
    } finally {
      setTranslateInputLoading(false);
    }
  }, [aiConfigured, inputText, onInputChange]);

  /** Массовая расшифровка всех голосовых без расшифровки в чате */
  const handleBatchTranscribe = useCallback(async () => {
    const toProcess = transcribingId
      ? voiceToTranscribe.filter((x) => x.message.id !== transcribingId)
      : voiceToTranscribe;
    if (batchTranscribeRunningRef.current || toProcess.length === 0) return;
    const totalVoiceInChat = messages.filter(
      (m) => !m.deleted && m.attachments?.some((a) => a.type === 'audio' || a.type === 'voice')
    ).length;
    const alreadyHadTranscription = totalVoiceInChat - toProcess.length;
    batchTranscribeRunningRef.current = true;
    setBatchTranscribeResult(null);
    setTranscribeErrorId(null);
    onBatchTranscribeRunningChange?.(true);
    const total = toProcess.length;
    setBatchTranscribeProgress({ current: 0, total });
    const items = toProcess.map(({ message: m, att }) => ({ messageId: m.id, audioUrl: att.url }));
    try {
      const result = await transcribeVoiceBatch(
        items,
        getAuthToken,
        (current, tot) => {
          setTranscribingId(items[current - 1]?.messageId ?? null);
          setBatchTranscribeProgress({ current, total: tot });
        }
      );
      result.updates && Object.entries(result.updates).forEach(([id, txt]) => {
        const m = messages.find((msg) => msg.id === id);
        if (m) {
          messagesById.current.set(id, { ...m, transcription: txt });
        }
      });
      setTranscriptionUpdates((prev) => ({ ...prev, ...result.updates }));
      setBatchTranscribeResult({
        done: result.done,
        skipped: alreadyHadTranscription,
        errors: result.errors
      });
    } finally {
      setTranscribingId(null);
      batchTranscribeRunningRef.current = false;
      setBatchTranscribeProgress(null);
      onBatchTranscribeRunningChange?.(false);
    }
  }, [voiceToTranscribe, transcribingId, messages, onBatchTranscribeRunningChange]);

  /** Клик по кнопке «Расшифровать всё»: проверить наличие и запустить или показать сообщение */
  const onBatchTranscribeClick = useCallback(() => {
    if (voiceToTranscribeFiltered.length === 0) return;
    if (batchTranscribeRunningRef.current) return;
    void handleBatchTranscribe();
  }, [voiceToTranscribeFiltered, handleBatchTranscribe]);

  const content = (
    <>
      {/* Шапка чата: липкая на мобильном, не прокручивается с сообщениями */}
      <div
        className="chat-header sticky top-0 z-50 flex flex-none items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2.5 min-h-[52px] md:min-h-0 md:px-4 md:py-2"
        style={isMobile ? { minHeight: CHAT_HEADER_HEIGHT } : undefined}
      >
        {isMobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="back-button flex flex-shrink-0 items-center gap-1 rounded-lg p-2 -ml-1 text-gray-700 hover:bg-gray-100"
            aria-label="Назад к списку"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Назад</span>
          </button>
        )}
        <div className="chat-user flex flex-1 min-w-0 flex-col truncate">
          <span className="chat-name font-medium text-gray-800 truncate text-sm md:text-base">
            {title}
          </span>
          {displayTitle?.trim() && phone && (
            <span className="chat-phone truncate text-xs text-gray-500">{phone}</span>
          )}
        </div>
        {hasAnyVoiceInChat && (
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onBatchTranscribeClick}
              disabled={voiceToTranscribeFiltered.length === 0 || batchTranscribeProgress !== null || !!aiMode || disableTranscribeAllButton}
              title={
                voiceToTranscribeFiltered.length === 0
                  ? 'Все голосовые уже расшифрованы'
                  : 'Расшифровать все голосовые в этом чате'
              }
              aria-label={
                voiceToTranscribeFiltered.length === 0
                  ? 'Все голосовые уже расшифрованы'
                  : 'Расшифровать все голосовые в этом чате'
              }
              className="flex items-center gap-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <Mic className="w-4 h-4 shrink-0" aria-hidden />
              {batchTranscribeProgress ? (
                <span className="hidden text-xs text-gray-500 sm:inline">
                  {batchTranscribeProgress.current} из {batchTranscribeProgress.total}
                </span>
              ) : (
                <span className="hidden text-xs font-medium text-gray-700 sm:inline">Расшифровать всё</span>
              )}
            </button>
          </div>
        )}
        {isMobile && (
          <div className="header-actions flex flex-shrink-0 items-center gap-2.5">
            {onToggleIncognito && (
              <button
                type="button"
                id="incognitoToggle"
                onClick={onToggleIncognito}
                className={`incognito-toggle flex h-[34px] w-[34px] items-center justify-center rounded-lg border-0 bg-gray-100 transition-colors hover:bg-gray-200 md:h-8 md:w-8 ${
                  incognitoMode ? 'active bg-amber-100 hover:bg-amber-200' : ''
                }`}
                aria-label={incognitoMode ? 'Выключить режим инкогнито' : 'Включить режим инкогнито'}
                title={incognitoMode ? 'Инкогнито вкл' : 'Инкогнито выкл'}
              >
                <Shield
                  className={`incognito-icon h-[18px] w-[18px] ${incognitoMode ? 'fill-amber-500 text-amber-500' : 'fill-gray-500 text-gray-500'}`}
                  aria-hidden
                />
              </button>
            )}
            {onOpenClientInfo && (
              <button
                type="button"
                onClick={onOpenClientInfo}
                className="profile-button flex-shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Профиль клиента"
                title="Профиль клиента"
              >
                <User className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {!isMobile && onOpenClientInfo && (
          <button
            type="button"
            onClick={onOpenClientInfo}
            className="profile-button flex-shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Профиль клиента"
            title="Профиль клиента"
          >
            <User className="w-5 h-5" />
          </button>
        )}
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() =>
              setPreviewAtt({
                type: 'file',
                url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
                fileName: 'test.pdf',
                mimeType: 'application/pdf'
              })
            }
            className="flex-shrink-0 px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 hover:bg-amber-200"
          >
            Test PDF
          </button>
        )}
      </div>

      {(aiPhase || batchTranscribeProgress || batchTranscribeResult) && (
        <div className="flex-none border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700">
          {aiPhase === 'transcribing' && (
            <span>
              Сначала расшифровываем голосовые…
              {aiTranscribeProgress && ` (${aiTranscribeProgress.current} из ${aiTranscribeProgress.total})`}
            </span>
          )}
          {aiPhase === 'generating' && <span>Готовим ответ…</span>}
          {!aiPhase && batchTranscribeProgress && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" aria-hidden />
              Расшифровка голосовых: {batchTranscribeProgress.current} из {batchTranscribeProgress.total}
            </span>
          )}
          {batchTranscribeResult && !batchTranscribeProgress && !aiPhase && (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span>Расшифровано: {batchTranscribeResult.done}</span>
              {batchTranscribeResult.skipped > 0 && (
                <span className="text-gray-500">Пропущено (уже были): {batchTranscribeResult.skipped}</span>
              )}
              {batchTranscribeResult.errors > 0 && (
                <span className="text-red-600">Ошибки: {batchTranscribeResult.errors}</span>
              )}
              <button
                type="button"
                onClick={() => setBatchTranscribeResult(null)}
                className="text-gray-500 hover:text-gray-700 ml-1"
                aria-label="Закрыть"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {selectionMode && onCloseSelection && (
        <MessageActionBar
          selectedCount={selectedMessageIds.length}
          onClose={onCloseSelection}
          onReply={
            selectedMessageIds.length === 1 && onReplyToMessage
              ? () => onReplyToMessage(selectedMessageIds[0])
              : undefined
          }
          onForward={onForwardMessages ? () => onForwardMessages(selectedMessageIds) : undefined}
          onDelete={onDeleteMessages ? () => onDeleteMessages(selectedMessageIds) : undefined}
          onStar={onStarMessages ? () => onStarMessages(selectedMessageIds) : undefined}
          onMore={onSelectionMore}
          showReply={selectedMessageIds.length === 1}
          isMobile={isMobile}
        />
      )}

      {/* Сообщения */}
      <div
        ref={messagesContainerRef}
        className={`chat-messages flex-1 min-h-0 overflow-y-auto bg-[#e5ddd5] space-y-2 p-2 md:p-4 ${isMobile ? 'pb-4 pr-16 md:pr-[88px]' : 'pb-4 pr-[88px]'}`}
      >
        {messages.map((msg) => {
          const repliedTo = msg.repliedToMessageId
            ? messagesById.current.get(msg.repliedToMessageId!)
            : null;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              repliedToMessage={repliedTo ?? null}
              isSelected={selectedMessageIds.includes(msg.id)}
              showCheckbox={selectionMode}
              onLongPress={onLongPressMessage}
              onContextMenu={onContextMenuMessage}
              onTap={selectionMode ? onToggleSelectMessage : undefined}
              translationText={translationByMessageId[msg.id] ?? null}
              translationVisible={!!translationVisibleByMessageId[msg.id]}
              onTranslateClick={msg.text?.trim() ? () => handleTranslateMessage(msg.id) : undefined}
              isTranslating={translatingMessageId === msg.id}
              renderAttachments={(m) =>
                m.attachments?.map((att, i) => {
                  const isAudio = att.type === 'audio' || att.type === 'voice';
                  const key = `${m.id}-${i}`;
                  if (!isAudio) {
                    return <AttachmentBlock key={key} att={att} onPreview={setPreviewAtt} />;
                  }

                  const handleTranscribe = async () => {
                    if (!att.url || transcribingId === m.id) return;
                    // если уже есть расшифровка — повторно не вызываем
                    if (m.transcription && m.transcription.trim().length > 0) return;
                    const container = messagesContainerRef.current;
                    const isNearBottom = container
                      ? container.scrollHeight - container.scrollTop - container.clientHeight < 100
                      : true;
                    if (container && !isNearBottom) {
                      scrollRestoreRef.current = container.scrollTop;
                    } else {
                      scrollRestoreRef.current = null;
                    }
                    setTranscribingId(m.id);
                    setTranscribeErrorId(null);
                    try {
                      const token = await getAuthToken();
                      if (!token) {
                        setTranscribingId(null);
                        setTranscribeErrorId(m.id);
                        return;
                      }
                      const res = await fetch('/.netlify/functions/ai-transcribe-voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ audioUrl: att.url, messageId: m.id })
                      });
                      const data = (await res.json().catch(() => ({}))) as {
                        text?: string;
                        error?: string;
                      };
                      if (!res.ok || data.error) {
                        if (import.meta.env.DEV) {
                          // eslint-disable-next-line no-console
                          console.error('[ChatWindow] transcribe-voice failed', {
                            status: res.status,
                            data
                          });
                        }
                        setTranscribeErrorId(m.id);
                        return;
                      }
                      const txt = (data.text ?? '').trim();
                      if (txt) {
                        messagesById.current.set(m.id, { ...m, transcription: txt });
                        setTranscriptionUpdates((prev) => ({ ...prev, [m.id]: txt }));
                      }
                    } catch (e) {
                      if (import.meta.env.DEV) {
                        // eslint-disable-next-line no-console
                        console.error('[ChatWindow] transcribe-voice error', e);
                      }
                      setTranscribeErrorId(m.id);
                    } finally {
                      setTranscribingId(null);
                    }
                  };

                  const effectiveTranscription = (transcriptionUpdates[m.id] ?? m.transcription ?? '').trim();
                  const showTranscription = effectiveTranscription.length > 0;
                  const isLoading = transcribingId === m.id;

                  return (
                    <div key={key} className="space-y-1">
                      <AttachmentBlock att={att} onPreview={setPreviewAtt} />
                      <div className="pl-1 pr-1">
                        {!showTranscription && (
                          <button
                            type="button"
                            onClick={handleTranscribe}
                            disabled={isLoading}
                            className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            {isLoading ? (
                              <span className="h-3 w-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="text-xs">📝</span>
                            )}
                            <span>Расшифровать</span>
                          </button>
                        )}
                        {!showTranscription && transcribeErrorId === m.id && (
                          <div className="mt-0.5 text-[11px] text-red-600">
                            Ошибка распознавания
                          </div>
                        )}
                        {showTranscription && (
                          <div className="mt-0.5 rounded-md bg-white/80 px-2 py-1 text-[11px] text-gray-700 border border-gray-200">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">
                              Текст
                            </div>
                            <span className="whitespace-pre-wrap break-words">{effectiveTranscription}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }) ?? null
              }
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {reactionPickerMessageId && onReactionSelect && (
        <div className="flex-none flex justify-center p-2 bg-gray-100/90 border-t">
          <MessageReactionPicker
            messageId={reactionPickerMessageId}
            onSelect={(emoji) => onReactionSelect(reactionPickerMessageId, emoji)}
            onClose={onCloseSelection ?? (() => {})}
            anchorRef={{ current: null }}
            isMobile={isMobile}
          />
        </div>
      )}

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={onCloseContextMenu ?? (() => {})}
          onReply={() => { onReplyToMessage?.(contextMenu.messageId); onCloseContextMenu?.(); }}
          onForward={() => { onForwardMessages?.([contextMenu.messageId]); onCloseContextMenu?.(); }}
          onCopy={() => { onCopyMessage?.(contextMenu.messageId); onCloseContextMenu?.(); }}
          onTranslate={() => { handleTranslateMessage(contextMenu.messageId); onCloseContextMenu?.(); }}
          onStar={() => { onStarMessages?.([contextMenu.messageId]); onCloseContextMenu?.(); }}
          onDelete={() => { onDeleteMessages?.([contextMenu.messageId]); onCloseContextMenu?.(); }}
          hasText={!!messages.find((m) => m.id === contextMenu.messageId)?.text?.trim()}
          isStarred={!!messages.find((m) => m.id === contextMenu.messageId)?.starred}
        />
      )}

      {actionsSheetMessageId && actionsSheetMessage && (
        <MessageActionsSheet
          open={true}
          onClose={onCloseSelection ?? (() => {})}
          onReply={() => { onReplyToMessage?.(actionsSheetMessageId); onCloseSelection?.(); }}
          onForward={() => { onForwardMessages?.(selectedMessageIds); onCloseSelection?.(); }}
          onCopy={() => { onCopyMessage?.(actionsSheetMessageId); onCloseSelection?.(); }}
          onTranslate={() => { handleTranslateMessage(actionsSheetMessageId); onCloseSelection?.(); }}
          onStar={() => { onStarMessages?.(selectedMessageIds); onCloseSelection?.(); }}
          onDelete={() => { onDeleteMessages?.(selectedMessageIds); onCloseSelection?.(); }}
          hasText={!!actionsSheetMessage.text?.trim()}
          isStarred={!!actionsSheetMessage.starred}
        />
      )}

      {replyToMessage && onCancelReply && (
        <ReplyComposerPreview message={replyToMessage} onCancel={onCancelReply} />
      )}

      {previewAtt && (
        <AttachmentPreviewModal
          attachment={previewAtt}
          onClose={() => {
            setPreviewAtt(null);
          }}
        />
      )}

      {mediaPreparing && (
        <div className="flex-none px-3 py-2 bg-sky-50 border-t border-sky-200 flex items-center gap-2 text-sky-900 text-sm">
          <span className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" aria-hidden />
          Подготовка медиа…
        </div>
      )}
      {sendError && (
        <div className="flex-none px-2 py-1.5 bg-red-50 border-t border-red-200 flex items-center justify-between gap-2">
          <p className="text-sm text-red-700 flex-1">{sendError}</p>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
              aria-label="Закрыть"
            >
              ×
            </button>
          )}
        </div>
      )}
      {showAiDebug && lastAiDebug && (
        <details className="flex-none border-t border-gray-200 bg-amber-50/80 px-2 py-1.5 text-left">
          <summary className="text-xs font-medium text-amber-900 cursor-pointer">AI: контекст ответа</summary>
          <div className="mt-1 text-[11px] text-amber-900 space-y-1">
            {lastAiDebug.matchedQuickReplies.length > 0 && (
              <p>
                <strong>Быстрые ответы:</strong>{' '}
                {lastAiDebug.matchedQuickReplies.map((q) => `${q.title} (${q.score})`).join(', ')}
              </p>
            )}
            {lastAiDebug.chosenTemplate && (
              <p>
                <strong>Выбран шаблон:</strong> {lastAiDebug.chosenTemplate}
              </p>
            )}
            {lastAiDebug.matchedKnowledgeBase.length > 0 && (
              <p>
                <strong>База знаний:</strong>{' '}
                {lastAiDebug.matchedKnowledgeBase.map((k) => k.title || k.category).filter(Boolean).join(', ') || '—'}
              </p>
            )}
          </div>
        </details>
      )}
      {isRecordingVoice && recordingStartedAt != null && (
        <VoiceRecordingStrip
          recordingStartedAt={recordingStartedAt}
          locked={voiceRecordingLocked}
          onCancel={onVoiceRecordCancel}
          onSend={onStopVoice}
        />
      )}
      {pendingAttachment && (
        <div className="flex-none flex items-center gap-2 px-2 py-1.5 bg-white border-t border-gray-200 rounded-t-lg">
          {pendingAttachment.preview ? (
            <img
              src={pendingAttachment.preview}
              alt=""
              className="w-10 h-10 object-cover rounded border border-gray-200"
            />
          ) : (
            <FileText className="w-8 h-8 text-gray-500 flex-shrink-0" />
          )}
          <span className="flex-1 truncate text-sm text-gray-700" title={pendingAttachment.file.name}>
            {pendingAttachment.file.name}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {(pendingAttachment.file.size / 1024).toFixed(1)} KB
          </span>
          {onClearAttachment && (
            <button
              type="button"
              onClick={onClearAttachment}
              className="p-1 rounded hover:bg-gray-200 text-gray-600"
              aria-label="Убрать файл"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      <div
        className={`chat-input flex-none bg-white ${isMobile ? 'chat-input-sticky sticky bottom-0 z-50' : ''}`}
        style={isMobile ? { paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        {incognitoMode && (
          <div className="px-3 pt-2 pb-1 text-[11px] md:text-xs text-amber-800 bg-amber-50 border-t border-amber-200">
            Режим инкогнито: отправка сообщений отключена, просмотр не помечает чаты прочитанными.
          </div>
        )}
        <ChatInput
          value={inputText}
          onChange={onInputChange}
          onSend={onSend}
          disabled={incognitoMode || !selectedItem?.phone || selectedItem.phone === '…'}
          sending={sending || uploadState !== 'idle'}
          fixedBottom={false}
          hasAttachment={!!pendingAttachment}
          onFileSelect={onFileSelect}
          onStartVoice={onStartVoice}
          onStopVoice={onStopVoice}
          isRecordingVoice={isRecordingVoice}
          recordingStartedAt={recordingStartedAt}
          onVoiceRecordCancel={onVoiceRecordCancel}
          voiceRecordingLocked={voiceRecordingLocked}
          onVoiceLock={onVoiceLock}
          onCameraCapture={onCameraCapture}
          showCameraButton={showCameraButton}
          onAiReply={incognitoMode ? undefined : handleAiReply}
          aiModeLoading={aiMode}
          autoFocusOnChange
          onOpenCalculator={!incognitoMode && onSendProposalImage ? () => setCalculatorDrawerOpen(true) : undefined}
          quickReplies={quickReplies}
          onQuickReplySelect={incognitoMode ? undefined : onQuickReplySelect}
          mediaQuickReplies={mediaQuickReplies}
          onMediaQuickReplySelect={incognitoMode ? undefined : onMediaQuickReplySelect}
          onTranslateInput={!incognitoMode && aiConfigured ? handleTranslateInput : undefined}
          translateInputLoading={translateInputLoading}
          isMobile={isMobile}
          mobileCrmAi={isMobile ? mobileCrmAiComposer : null}
        />
        {onSendProposalImage && (
          <WhatsAppCalculatorDrawer
            open={calculatorDrawerOpen}
            onClose={() => setCalculatorDrawerOpen(false)}
            onSendProposalImage={onSendProposalImage}
            isMobile={isMobile}
          />
        )}
      </div>
    </>
  );

  let output: React.ReactNode = content;
  if (!isMobile && onFilesDrop) {
    output = (
      <div
        ref={dropZoneRef}
        className={`chat-container flex flex-col flex-1 min-h-0 relative ${isDragOver ? 'drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const files = e.dataTransfer?.files;
          if (files?.length) onFilesDrop(Array.from(files));
        }}
      >
        {content}
        {isDragOver && (
          <div
            className="absolute inset-0 flex items-center justify-center text-lg pointer-events-none z-10 bg-black/5 border-2 border-dashed border-[#27ae60] text-[#27ae60]"
            aria-hidden
          >
            Отпустите файл чтобы отправить
          </div>
        )}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {content}
      </div>
    );
  }
  return output;
};

export default ChatWindow;
