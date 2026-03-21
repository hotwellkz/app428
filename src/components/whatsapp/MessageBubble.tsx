import React, { useRef, useCallback } from 'react';
import { Languages } from 'lucide-react';
import { formatMessageTime } from './whatsappUtils';
import MessageStatusIcon from './MessageStatusIcon';
import type { WhatsAppMessage, MessageAttachment } from '../../types/whatsappDb';

const LONG_PRESS_MS = 650;
const TOUCH_MOVE_THRESHOLD_PX = 10;

export interface MessageBubbleProps {
  message: WhatsAppMessage;
  /** Сообщение, на которое отвечают (для отображения цитаты) */
  repliedToMessage?: WhatsAppMessage | null;
  isSelected?: boolean;
  /** Показывать чекбокс слева (режим выбора для пересылки) */
  showCheckbox?: boolean;
  onLongPress?: (messageId: string) => void;
  onContextMenu?: (e: React.MouseEvent, messageId: string) => void;
  onTap?: (messageId: string) => void;
  /** Рендер вложений (AttachmentBlock и т.д.) — передаётся из ChatWindow */
  renderAttachments: (msg: WhatsAppMessage) => React.ReactNode;
  /** Текст перевода RU↔KZ (показывается под сообщением) */
  translationText?: string | null;
  /** Показать блок перевода (toggle) */
  translationVisible?: boolean;
  /** Запрос перевода или переключение видимости */
  onTranslateClick?: () => void;
  /** Идёт загрузка перевода */
  isTranslating?: boolean;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function MessageTextWithLinks({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <span className="text-sm whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (isValidHttpUrl(part)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-green-700 underline break-words hover:text-green-800"
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}

function ReplyBlock({ message }: { message: WhatsAppMessage }) {
  const label = message.deleted
    ? 'Сообщение удалено'
    : message.attachments?.length
      ? (message.attachments[0].type === 'image'
          ? 'Фото'
          : message.attachments[0].type === 'video'
            ? 'Видео'
            : message.attachments[0].type === 'voice'
              ? 'Голосовое сообщение'
              : message.attachments[0].type === 'audio'
                ? 'Аудио'
                : 'Документ')
      : (message.text || '').slice(0, 80) + (message.text && message.text.length > 80 ? '…' : '');
  return (
    <div className="mb-1 pl-2 border-l-4 border-green-600 text-left">
      <p className="text-xs text-gray-500">
        {message.direction === 'outgoing' ? 'Вы' : 'Контакт'}
      </p>
      <p className="text-sm text-gray-700 truncate">{label}</p>
    </div>
  );
}

function ReactionsStrip({ message }: { message: WhatsAppMessage }) {
  const reactions = message.reactions;
  if (!reactions?.length) return null;
  const byEmoji = new Map<string, number>();
  reactions.forEach((r) => byEmoji.set(r.emoji, (byEmoji.get(r.emoji) ?? 0) + 1));
  const list = [...byEmoji.entries()].map(([emoji, count]) =>
    count > 1 ? `${emoji} ${count}` : emoji
  );
  return (
    <div className="flex flex-wrap gap-1 mt-1 justify-end">
      {list.map((item, i) => (
        <span key={i} className="text-sm bg-gray-100 rounded-full px-1.5 py-0.5">
          {item}
        </span>
      ))}
    </div>
  );
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  repliedToMessage,
  isSelected,
  showCheckbox = false,
  onLongPress,
  onContextMenu,
  onTap,
  renderAttachments,
  translationText,
  translationVisible = false,
  onTranslateClick,
  isTranslating = false,
}) => {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!onLongPress) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        onLongPress(message.id);
      }, LONG_PRESS_MS);
    },
    [onLongPress, message.id, clearLongPressTimer]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!longPressTimerRef.current) return;
      if (e.touches.length !== 1) return;
      if (touchStartXRef.current == null || touchStartYRef.current == null) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartXRef.current);
      const dy = Math.abs(touch.clientY - touchStartYRef.current);
      if (dx > TOUCH_MOVE_THRESHOLD_PX || dy > TOUCH_MOVE_THRESHOLD_PX) {
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer]
  );

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }, [clearLongPressTimer]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onTap) {
        onTap(message.id);
        e.preventDefault();
      }
    },
    [message.id, onTap]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu) {
        e.preventDefault();
        onContextMenu(e, message.id);
      }
    },
    [message.id, onContextMenu]
  );

  const isOutgoing = message.direction === 'outgoing';
  const isDeleted = message.deleted === true;
  const isSystem = message.system === true;

  if (isSystem) {
    return (
      <div className="message flex justify-center w-full my-1 px-2">
        <div className="rounded-lg px-3 py-1.5 bg-black/[0.06] text-center max-w-[90%]">
          <p className="text-xs text-gray-600 whitespace-pre-wrap">{message.text}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{formatMessageTime(message.createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`message flex gap-2 ${isOutgoing ? 'justify-end' : 'justify-start'} ${showCheckbox ? 'items-start' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {showCheckbox && (
        <span className="flex-shrink-0 mt-1.5 w-5 h-5 rounded border-2 flex items-center justify-center bg-white border-gray-300">
          {isSelected && <span className="text-emerald-600 text-xs font-bold">✓</span>}
        </span>
      )}
      <div className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-[60%]`}>
      <div
        className={`message-bubble group rounded-lg px-3 py-2 shadow-sm w-full cursor-pointer select-text ${
          isOutgoing ? 'bg-[#dcf8c6] text-gray-900' : 'bg-white text-gray-900'
        } ${isSelected ? 'ring-2 ring-green-500 ring-offset-1' : ''}`}
        onClick={onTap ? handleClick : undefined}
        onContextMenu={handleContextMenu}
      >
        {message.forwarded && (
          <p className="text-xs text-gray-500 mb-0.5">Переслано</p>
        )}
        {message.repliedToMessageId && repliedToMessage && (
          <ReplyBlock message={repliedToMessage} />
        )}
        {isDeleted ? (
          <p className="text-sm italic text-gray-500">Сообщение удалено</p>
        ) : (
          <>
            {message.text ? (
              <MessageTextWithLinks text={message.text} />
            ) : null}
            {renderAttachments(message)}
          </>
        )}
        <ReactionsStrip message={message} />
        <p className="message-status text-xs text-gray-500 mt-1 flex items-center justify-end gap-0.5 select-none">
          {!isDeleted && message.text?.trim() && onTranslateClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTranslateClick(); }}
              className="opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 text-gray-500 hover:text-gray-700 flex-shrink-0 transition-opacity"
              aria-label="Перевести"
              title="Перевести"
            >
              {isTranslating ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {formatMessageTime(message.createdAt)}
          <MessageStatusIcon msg={message} />
        </p>
        {isOutgoing && message.status === 'failed' && message.errorMessage && (
          <p className="text-xs text-red-600 mt-0.5">{message.errorMessage}</p>
        )}
      </div>
      {translationVisible && translationText && (
        <div className="mt-1 w-full pl-2 pr-2 py-1.5 rounded-md bg-black/[0.06] border border-black/[0.08]">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Перевод</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{translationText}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTranslateClick?.(); }}
            className="mt-1 text-[11px] text-gray-500 hover:text-gray-700"
          >
            Скрыть
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default MessageBubble;
