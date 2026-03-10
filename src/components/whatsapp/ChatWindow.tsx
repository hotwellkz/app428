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
}

const CHAT_HEADER_HEIGHT = 56;

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
  onImageClick
}: {
  att: MessageAttachment;
  onImageClick?: (att: MessageAttachment) => void;
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

  if (isImage && !imgError) {
    return (
      <div className="mt-1 rounded overflow-hidden max-w-full">
        <button
          type="button"
          onClick={() => onImageClick?.(att)}
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
      {link}
      {att.type === 'file' && (
        <a
          href={att.url}
          download={att.fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:underline ml-2"
        >
          Скачать
        </a>
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesById = useRef<Map<string, WhatsAppMessage>>(new Map());
  messagesById.current = new Map(messages.map((m) => [m.id, m]));
  const [imageViewerAtt, setImageViewerAtt] = useState<MessageAttachment | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const phone = selectedItem.phone ?? selectedItem.client?.phone ?? selectedItem.clientId ?? '—';
  const title = displayTitle?.trim() || phone;
  const selectionMode = selectedMessageIds.length > 0;
  const actionsSheetMessage = actionsSheetMessageId
    ? messages.find((m) => m.id === actionsSheetMessageId)
    : null;

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
                m.attachments?.map((att, i) => (
                  <AttachmentBlock key={i} att={att} onImageClick={setImageViewerAtt} />
                )) ?? null
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

      {imageViewerAtt && (
        <div
          className="fixed inset-0 z-[1200] bg-black/80 flex items-center justify-center px-4"
          onClick={() => {
            setImageViewerAtt(null);
            if (import.meta.env.DEV) {
              console.log('[WhatsApp] image viewer close');
            }
          }}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImageViewerAtt(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={imageViewerAtt.url}
              alt={imageViewerAtt.fileName ?? ''}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg bg-black"
              onError={() => {
                if (import.meta.env.DEV) {
                  console.warn('[WhatsApp] image viewer load error:', {
                    url: imageViewerAtt.url,
                    fileName: imageViewerAtt.fileName
                  });
                }
              }}
            />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 rounded-full px-4 py-1 text-xs text-white">
              <button
                type="button"
                onClick={() => {
                  window.open(imageViewerAtt.url, '_blank', 'noopener,noreferrer');
                }}
                className="hover:underline"
              >
                Открыть оригинал
              </button>
              <a
                href={imageViewerAtt.url}
                download={imageViewerAtt.fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Скачать
              </a>
            </div>
          </div>
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
        <ChatInput
          value={inputText}
          onChange={onInputChange}
          onSend={onSend}
          disabled={!selectedItem?.phone || selectedItem.phone === '…'}
          sending={sending || uploadState !== 'idle'}
          fixedBottom={false}
          hasAttachment={!!pendingAttachment}
          onFileSelect={onFileSelect}
          onStartVoice={onStartVoice}
          onStopVoice={onStopVoice}
          isRecordingVoice={isRecordingVoice}
          onCameraCapture={onCameraCapture}
          showCameraButton={showCameraButton}
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
