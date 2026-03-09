import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock, Check, CheckCheck, AlertCircle, Image, Video, Music, FileText, X, Play, Pause } from 'lucide-react';
import { formatMessageTime, mapProviderStatusToUiStatus } from './whatsappUtils';
import ChatInput from './ChatInput';
import type { WhatsAppMessage, MessageAttachment } from '../../types/whatsappDb';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';

interface PendingAttachment {
  file: File;
  preview?: string;
}

interface ChatWindowProps {
  selectedItem: ConversationListItem;
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

function MessageStatusIcon({ msg }: { msg: WhatsAppMessage }) {
  if (msg.direction !== 'outgoing') return null;
  const status = mapProviderStatusToUiStatus(msg.status);
  const title =
    status === 'pending'
      ? 'Отправляется'
      : status === 'sent'
        ? 'Отправлено'
        : status === 'delivered'
          ? 'Доставлено'
          : status === 'read'
            ? 'Прочитано'
            : status === 'failed'
              ? msg.errorMessage || 'Ошибка'
              : '';
  const className = 'w-3.5 h-3.5 flex-shrink-0 ml-1 inline-block';
  if (status === 'pending')
    return <Clock className={`${className} text-gray-400`} title={title} aria-hidden />;
  if (status === 'failed')
    return <AlertCircle className={`${className} text-red-500`} title={title} aria-hidden />;
  if (status === 'read')
    return <CheckCheck className={`${className} text-blue-600`} title={title} aria-hidden />;
  if (status === 'delivered')
    return <CheckCheck className={`${className} text-gray-500`} title={title} aria-hidden />;
  return <Check className={`${className} text-gray-500`} title={title} aria-hidden />;
}

function AttachmentBlock({ att }: { att: MessageAttachment }) {
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
        <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={att.url}
            alt=""
            className="max-h-48 max-w-full object-contain rounded border border-gray-200"
            onError={() => setImgError(true)}
          />
        </a>
        {att.url && (
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:underline mt-0.5 block"
          >
            Открыть
          </a>
        )}
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
    return (
      <div className="mt-1 p-2 rounded bg-gray-100 border border-gray-200 flex flex-wrap items-center gap-2">
        <Video className="w-5 h-5 text-gray-600" />
        {link}
        <a
          href={att.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:underline"
        >
          Скачать
        </a>
      </div>
    );
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const phone = selectedItem.phone ?? selectedItem.client?.phone ?? selectedItem.clientId ?? '—';

  const content = (
    <>
      {/* Header: на мобильных — кнопка Назад + номер */}
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
        <p className="font-medium text-gray-800 truncate flex-1 min-w-0 text-sm md:text-base">
          {isMobile && onBack ? phone : phone}
        </p>
      </div>

      {/* Сообщения: на mobile flex-1 min-h-0 без фикс. высоты; отступы от плавающих кнопок и composer */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto bg-[#e5ddd5] space-y-2 p-2 md:p-4 ${isMobile ? 'pb-4 pr-16 md:pr-[88px]' : 'pb-4 pr-[88px]'}`}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg px-3 py-2 shadow-sm max-w-[80%] md:max-w-[60%] ${
                msg.direction === 'outgoing'
                  ? 'bg-[#dcf8c6] text-gray-900'
                  : 'bg-white text-gray-900'
              }`}
            >
              {msg.text ? (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              ) : null}
              {msg.attachments?.map((att, i) => (
                <AttachmentBlock key={i} att={att} />
              ))}
              <p className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-0.5">
                {formatMessageTime(msg.createdAt)}
                <MessageStatusIcon msg={msg} />
              </p>
              {msg.direction === 'outgoing' && msg.status === 'failed' && msg.errorMessage && (
                <p className="text-xs text-red-600 mt-0.5">{msg.errorMessage}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

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
