import React, { useRef } from 'react';
import { formatLastMessageTime } from './whatsappUtils';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';
import { getConversationAttentionState } from '../../lib/firebase/whatsappDb';
import Avatar from './Avatar';

interface ConversationListProps {
  items: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Открытие контекстного меню для диалога (desktop: правый клик, mobile: long press) */
  onConversationContextMenu?: (id: string, x: number, y: number, source: 'desktop' | 'mobile') => void;
}

const LONG_PRESS_MS = 400;

const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

const ConversationList: React.FC<ConversationListProps> = ({
  items,
  selectedId,
  onSelect,
  onConversationContextMenu
}) => {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="flex-1 overflow-y-auto">
      {items.length === 0 && (
        <div className="p-4 text-sm text-gray-500 text-center md:p-4">
          Нет диалогов
        </div>
      )}
      {items.map((item) => {
        const hasUnread = (item.unreadCount ?? 0) > 0;
        const attention = getConversationAttentionState(item);
        const isNeedReply = attention === 'need_reply';
        const statusDotClass =
          attention === 'unread'
            ? 'bg-red-500'
            : attention === 'need_reply'
            ? 'bg-amber-400'
            : 'bg-gray-300';

        const getWaitingDurationText = (): string | null => {
          const t = item.lastIncomingAt ?? item.lastMessage?.createdAt ?? null;
          if (!t) return null;
          let ms: number;
          if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
            ms = (t as { toMillis: () => number }).toMillis();
          } else if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
            ms = ((t as { seconds: number }).seconds ?? 0) * 1000;
          } else if (t instanceof Date) {
            ms = t.getTime();
          } else {
            return null;
          }
          const diffMs = Date.now() - ms;
          if (diffMs <= 0) return '0 мин';
          const totalMin = Math.floor(diffMs / 60000);
          const hours = Math.floor(totalMin / 60);
          const minutes = totalMin % 60;
          if (hours <= 0) return `${totalMin} мин`;
          if (minutes === 0) return `${hours} ч`;
          return `${hours} ч ${minutes} мин`;
        };

        const waitingDuration = !hasUnread && isNeedReply ? getWaitingDurationText() : null;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            onMouseDown={
              onConversationContextMenu && !isMobileDevice()
                ? () => {
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = setTimeout(() => {
                      longPressTimerRef.current = null;
                      const x = window.innerWidth / 2;
                      const y = window.innerHeight;
                      onConversationContextMenu(item.id, x, y, 'desktop');
                    }, LONG_PRESS_MS);
                  }
                : undefined
            }
            onMouseUp={
              !isMobileDevice()
                ? () => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }
                : undefined
            }
            onMouseLeave={
              !isMobileDevice()
                ? () => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }
                : undefined
            }
            onContextMenu={(e) => {
              if (!onConversationContextMenu) return;
              e.preventDefault();
              onConversationContextMenu(item.id, e.clientX, e.clientY, 'desktop');
            }}
            className={[
              'chat-list-item w-full text-left border-b border-gray-100 hover:bg-gray-50 transition-colors px-3 py-2.5 md:px-4 md:py-3',
              selectedId === item.id ? 'bg-green-50 border-l-4 border-l-green-500 md:border-l-4' : '',
              hasUnread ? 'bg-gray-100/80' : '',
              !hasUnread && isNeedReply && selectedId !== item.id ? 'bg-amber-50/60' : ''
            ].join(' ')}
          >
            <div className="flex flex-col min-w-0 flex-1 gap-0 relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDotClass}`} />
                <Avatar
                  name={item.displayTitle ?? item.client?.name ?? item.phone ?? item.client?.phone ?? undefined}
                  phone={item.phone ?? item.client?.phone ?? undefined}
                  avatarUrl={item.client?.avatarUrl ?? null}
                />
                <span className={`truncate text-sm md:text-base ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
                  {item.displayTitle ?? item.phone ?? item.client?.phone ?? item.clientId ?? '—'}
                </span>
                {(item.unreadCount ?? 0) > 0 && (
                  <span
                    className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-[10px] bg-red-500 text-white text-xs font-medium"
                  >
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </span>
                )}
              </div>
              {/* Дополнительный маркер «нужен ответ» — только если нет unread */}
              {!hasUnread && isNeedReply && (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-[11px] md:text-xs text-amber-600 font-medium">
                      Ждёт ответа{waitingDuration ? ` • ${waitingDuration}` : ''}
                    </span>
                  </div>
                </div>
              )}
              {item.displayTitle && item.displayTitle !== (item.phone ?? item.client?.phone) && (item.phone || item.client?.phone) && (
                <p className="truncate text-xs text-gray-500 mt-0.5">{item.phone ?? item.client?.phone}</p>
              )}
            </div>
            {item.lastMessage && (
              <div className="flex justify-between items-center gap-2 mt-0.5">
                <span className={`truncate flex-1 text-xs md:text-sm ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                  {item.lastMessage.attachments?.length
                    ? '[медиа]'
                    : item.lastMessage.text.startsWith('[media') || item.lastMessage.text === '[no text]'
                      ? '[медиа]'
                      : item.lastMessage.text || '[медиа]'}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatLastMessageTime(item.lastMessage.createdAt)}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ConversationList;
