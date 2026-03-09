import React, { useRef, useCallback } from 'react';
import { formatMessageTime } from './whatsappUtils';
import MessageStatusIcon from './MessageStatusIcon';
import type { WhatsAppMessage, MessageAttachment } from '../../types/whatsappDb';

const LONG_PRESS_MS = 400;

export interface MessageBubbleProps {
  message: WhatsAppMessage;
  /** Сообщение, на которое отвечают (для отображения цитаты) */
  repliedToMessage?: WhatsAppMessage | null;
  isSelected?: boolean;
  onLongPress?: (messageId: string) => void;
  onContextMenu?: (e: React.MouseEvent, messageId: string) => void;
  onTap?: (messageId: string) => void;
  /** Рендер вложений (AttachmentBlock и т.д.) — передаётся из ChatWindow */
  renderAttachments: (msg: WhatsAppMessage) => React.ReactNode;
}

function ReplyBlock({ message }: { message: WhatsAppMessage }) {
  const label = message.deleted
    ? 'Сообщение удалено'
    : message.attachments?.length
      ? (message.attachments[0].type === 'image'
          ? 'Фото'
          : message.attachments[0].type === 'video'
            ? 'Видео'
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
  onLongPress,
  onContextMenu,
  onTap,
  renderAttachments,
}) => {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    if (!onLongPress) return;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      onLongPress(message.id);
    }, LONG_PRESS_MS);
  }, [message.id, onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

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

  return (
    <div
      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={`rounded-lg px-3 py-2 shadow-sm max-w-[80%] md:max-w-[60%] cursor-pointer select-none ${
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
              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
            ) : null}
            {renderAttachments(message)}
          </>
        )}
        <ReactionsStrip message={message} />
        <p className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-0.5">
          {formatMessageTime(message.createdAt)}
          <MessageStatusIcon msg={message} />
        </p>
        {isOutgoing && message.status === 'failed' && message.errorMessage && (
          <p className="text-xs text-red-600 mt-0.5">{message.errorMessage}</p>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
