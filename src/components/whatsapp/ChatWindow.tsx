import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Image, Video, Music, FileText, X, Play, Pause } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import MessageActionBar from './MessageActionBar';
import MessageContextMenu from './MessageContextMenu';
import MessageReactionPicker from './MessageReactionPicker';
import MessageActionsSheet from './MessageActionsSheet';
import ReplyComposerPreview from './ReplyComposerPreview';
import type { WhatsAppMessage, MessageAttachment } from '../../types/whatsappDb';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';

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
  onDismissError?: () => void;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  isRecordingVoice?: boolean;
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
}

const CHAT_HEADER_HEIGHT = 56;

type AttachmentCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'office' | 'unknown';

function getAttachmentCategory(att: MessageAttachment): AttachmentCategory {
  const mime = att.mimeType?.toLowerCase() ?? '';
  const name = att.fileName?.toLowerCase() ?? '';

  if (att.type === 'image' || mime.startsWith('image/')) return 'image';
  if (att.type === 'video' || mime.startsWith('video/')) return 'video';
  if (att.type === 'audio' || mime.startsWith('audio/')) return 'audio';

  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';

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
            <iframe
              src={attachment.url}
              title={title}
              className="w-full h-[70vh] rounded bg-white"
            />
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

function AudioMessageBubble({ att }: { att: MessageAttachment }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
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
  }, [att.url]);

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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = pct * duration;
    setCurrentTime(el.currentTime);
  };

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
          role="progressbar"
          aria-valuenow={duration ? (currentTime / duration) * 100 : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 bg-gray-300 rounded-full cursor-pointer overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-green-600 rounded-full transition-all duration-100"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
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

function VideoMessageBubble({ att }: { att: MessageAttachment }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const durationLabel =
    duration != null && Number.isFinite(duration) ? formatDuration(duration) : null;

  return (
    <div className="mt-1 w-full max-w-xs md:max-w-sm">
      <div className="relative bg-black rounded-lg overflow-hidden">
        {!error && !isPlaying && (
          <button
            type="button"
            className="relative w-full focus:outline-none"
            onClick={handlePlayClick}
          >
            <video
              src={att.url}
              muted
              playsInline
              preload="metadata"
              className="w-full max-h-64 object-contain bg-black"
              onLoadedMetadata={handleLoadedMetadata}
              onError={handleError}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center text-white">
                <Play className="w-6 h-6 ml-0.5" />
              </div>
            </div>
            {durationLabel && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">
                {durationLabel}
              </div>
            )}
          </button>
        )}
        {!error && isPlaying && (
          <video
            ref={videoRef}
            src={att.url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="w-full max-h-64 object-contain bg-black"
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
            onEnded={handleEnded}
          />
        )}
        {error && (
          <div className="p-3 text-sm text-gray-100">
            <p>{error}</p>
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-600">
        <a
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Открыть
        </a>
        <a
          href={att.url}
          download={att.fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline text-gray-500"
        >
          Скачать
        </a>
      </div>
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
  const isImage = att.type === 'image';
  const isVideo = att.type === 'video';
  const isAudio = att.type === 'audio';
  const label =
    att.type === 'image'
      ? 'Изображение'
      : att.type === 'video'
        ? 'Видео'
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

const ChatWindow: React.FC<ChatWindowProps> = ({
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
  onDismissError,
  onStartVoice,
  onStopVoice,
  isRecordingVoice = false,
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesById = useRef<Map<string, WhatsAppMessage>>(new Map());
  messagesById.current = new Map(messages.map((m) => [m.id, m]));
  const [previewAtt, setPreviewAtt] = useState<MessageAttachment | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const phone = selectedItem.phone ?? selectedItem.client?.phone ?? selectedItem.clientId ?? '—';
  const title = displayTitle?.trim() || phone;
  const selectionMode = selectedMessageIds.length > 0;
  const actionsSheetMessage = actionsSheetMessageId
    ? messages.find((m) => m.id === actionsSheetMessageId)
    : null;

  const [aiMode, setAiMode] = useState<'normal' | 'short' | 'close' | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  const handleAiReply = async (mode: 'normal' | 'short' | 'close') => {
    if (!onInputChange || !messages || messages.length === 0) return;
    if (aiMode) return;
    const recent = messages
      .map((m) => ({
        ...m,
        _content: (m.transcription ?? m.text ?? '').trim()
      }))
      .filter((m) => m._content.length > 0 && !m.deleted)
      .slice(-15);
    if (recent.length === 0) return;

    setAiMode(mode);
    try {
      const payload = {
        mode,
        messages: recent.map((m) => ({
          role: m.direction === 'incoming' ? ('client' as const) : ('manager' as const),
          text: m._content.replace(/<[^>]*>/g, '').trim()
        }))
      };
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || data.error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[ChatWindow] AI generate reply failed', { status: res.status, data });
        }
        return;
      }
      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
      if (reply) {
        onInputChange(reply);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[ChatWindow] AI generate reply error', e);
      }
    } finally {
      setAiMode(null);
    }
  };

  const content = (
    <>
      {/* Header: на мобильных — кнопка Назад + имя/номер */}
      <div
        className="flex-none flex items-center gap-2 px-3 py-2 bg-white border-b min-h-[52px] md:min-h-0 md:px-4 md:py-2"
        style={isMobile ? { minHeight: CHAT_HEADER_HEIGHT } : undefined}
      >
        {isMobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-shrink-0 p-2 -ml-1 rounded-lg hover:bg-gray-100 flex items-center gap-1 text-gray-700"
            aria-label="Назад к списку"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Назад</span>
          </button>
        )}
        <div className="flex-1 min-w-0 flex flex-col truncate">
          <p className="font-medium text-gray-800 truncate text-sm md:text-base">
            {title}
          </p>
          {displayTitle?.trim() && phone && (
            <p className="text-xs text-gray-500 truncate">{phone}</p>
          )}
        </div>
      </div>

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
        className={`flex-1 min-h-0 overflow-y-auto bg-[#e5ddd5] space-y-2 p-2 md:p-4 ${isMobile ? 'pb-4 pr-16 md:pr-[88px]' : 'pb-4 pr-[88px]'}`}
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
              onLongPress={onLongPressMessage}
              onContextMenu={onContextMenuMessage}
              onTap={selectionMode ? onToggleSelectMessage : undefined}
              renderAttachments={(m) =>
                m.attachments?.map((att, i) => {
                  const isAudio = att.type === 'audio';
                  const key = `${m.id}-${i}`;
                  if (!isAudio) {
                    return <AttachmentBlock key={key} att={att} onPreview={setPreviewAtt} />;
                  }

                  const handleTranscribe = async () => {
                    if (!att.url || transcribingId === m.id) return;
                    // если уже есть расшифровка — повторно не вызываем
                    if (m.transcription && m.transcription.trim().length > 0) return;
                    setTranscribingId(m.id);
                    try {
                      const res = await fetch('/api/ai/transcribe-voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
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
                        return;
                      }
                      const txt = (data.text ?? '').trim();
                      if (txt) {
                        // локально патчим сообщение, чтобы сразу показать текст
                        messagesById.current.set(m.id, {
                          ...m,
                          transcription: txt
                        });
                      }
                    } catch (e) {
                      if (import.meta.env.DEV) {
                        // eslint-disable-next-line no-console
                        console.error('[ChatWindow] transcribe-voice error', e);
                      }
                    } finally {
                      setTranscribingId(null);
                    }
                  };

                  const showTranscription = m.transcription && m.transcription.trim().length > 0;
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
                        {showTranscription && (
                          <div className="mt-0.5 rounded-md bg-white/80 px-2 py-1 text-[11px] text-gray-700 border border-gray-200">
                            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">
                              Текст
                            </div>
                            <span className="whitespace-pre-wrap break-words">{m.transcription}</span>
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
        className="flex-none"
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
          onCameraCapture={onCameraCapture}
          showCameraButton={showCameraButton}
          onAiReply={incognitoMode ? undefined : handleAiReply}
          aiModeLoading={aiMode}
          autoFocusOnChange
        />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {content}
      </div>
    );
  }
  return content;
};

export default ChatWindow;
