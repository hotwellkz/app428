import React, { useRef, useCallback, memo, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  formatLastMessageTime,
  formatVoiceListDuration,
  isVoiceNoteAttachment,
  parseVoiceListPreviewFromText
} from './whatsappUtils';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';
import { getConversationAttentionState } from '../../lib/firebase/whatsappDb';
import Avatar from './Avatar';

const ROW_HEIGHT = 92;
const LONG_PRESS_MS = 400;
const LOAD_MORE_PX = 200;

const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

export type ConversationListRowItem = ConversationListItem & {
  dealStatusId?: string | null;
  dealStatusColor?: string | null;
  dealStatusName?: string | null;
  managerColor?: string | null;
  managerName?: string | null;
};

interface ConversationListProps {
  items: ConversationListRowItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  /** Подсказки пагинации («Загрузить ещё», «Все чаты загружены») — выключать при поиске по API. */
  showPaginationHints?: boolean;
  onConversationContextMenu?: (id: string, x: number, y: number, source: 'desktop' | 'mobile') => void;
}

function getWaitingDurationText(item: ConversationListRowItem): string | null {
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
}

const ConversationRow = memo(function ConversationRow({
  item,
  selectedId,
  onSelect,
  onConversationContextMenu,
  longPressTimerRef
}: {
  item: ConversationListRowItem;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConversationContextMenu?: ConversationListProps['onConversationContextMenu'];
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const hasUnread = (item.unreadCount ?? 0) > 0;
  const attention = getConversationAttentionState(item);
  const isNeedReply = attention === 'need_reply';
  const waitingDuration = !hasUnread && isNeedReply ? getWaitingDurationText(item) : null;
  const isKaspiOrder = !!item.kaspiOrderNumber;
  const dealStageName = item.dealStageName;
  const dealStageColor = item.dealStageColor;
  const dealStatusColor = dealStageColor || item.dealStatusColor;
  const dealStatusName = dealStageName || item.dealStatusName;
  const managerColor = item.managerColor;
  const managerName = item.managerName;
  const statusDotStyle = dealStatusColor ? { backgroundColor: dealStatusColor } : undefined;
  const statusDotClass = dealStatusColor ? '' : 'bg-gray-400';
  const managerDotStyle = managerColor ? { backgroundColor: managerColor } : undefined;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      onMouseDown={
        onConversationContextMenu && !isMobileDevice()
          ? () => {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = setTimeout(() => {
                longPressTimerRef.current = null;
                onConversationContextMenu(item.id, window.innerWidth / 2, window.innerHeight, 'desktop');
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
        'chat-list-item w-full text-left border-b border-gray-100 hover:bg-gray-50 transition-colors px-3 py-2 md:px-4 md:py-2.5',
        selectedId === item.id ? 'bg-green-50 border-l-4 border-l-green-500 md:border-l-4' : '',
        hasUnread ? 'bg-gray-100/80' : '',
        !hasUnread && isNeedReply && selectedId !== item.id ? 'bg-amber-50/60' : ''
      ].join(' ')}
      style={{ minHeight: ROW_HEIGHT }}
    >
      <div className="flex flex-col min-w-0 flex-1 gap-0.5 relative">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDotClass}`}
            style={statusDotStyle}
            title={dealStatusName ?? undefined}
            aria-hidden
          />
          {managerColor && (
            <span
              className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
              style={managerDotStyle}
              title={managerName ?? undefined}
              aria-hidden
            />
          )}
          <Avatar
            name={item.displayTitle ?? item.client?.name ?? item.phone ?? item.client?.phone ?? undefined}
            phone={item.phone ?? item.client?.phone ?? undefined}
            avatarUrl={item.client?.avatarUrl ?? null}
          />
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span
              className={`truncate text-sm md:text-[15px] ${
                hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
              }`}
            >
              {isKaspiOrder ? (
                <>
                  <span className="inline-flex items-center gap-1 mr-1 text-xs font-semibold text-amber-700">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-hidden />
                    Kaspi
                  </span>
                  {item.kaspiOrderCustomerName || item.displayTitle || item.client?.name || 'Клиент Kaspi'}
                </>
              ) : (
                item.displayTitle ?? item.phone ?? item.client?.phone ?? item.clientId ?? '—'
              )}
            </span>
            {item.channel === 'instagram' && (
              <span
                className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                title="Instagram"
              >
                IG
              </span>
            )}
            {dealStageName && (
              <span
                className="truncate max-w-[140px] text-[10px] md:text-[11px] font-medium px-1.5 py-0.5 rounded-md text-white shrink-0"
                style={{
                  backgroundColor:
                    dealStageColor && /^#[0-9A-Fa-f]{3,8}$/.test(dealStageColor) ? dealStageColor : '#6B7280'
                }}
                title={dealStageName}
              >
                {dealStageName}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {item.lastMessage && (
              <span className="text-[11px] text-gray-400">
                {formatLastMessageTime(item.lastMessage.createdAt)}
              </span>
            )}
            {(item.unreadCount ?? 0) > 0 && (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-[10px] bg-red-500 text-white text-xs font-medium">
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </span>
            )}
          </div>
        </div>
        {item.lastMessage && (
          <div className="flex items-center gap-2 min-w-0">
            {isKaspiOrder ? (
              <span
                className={`truncate text-xs md:text-sm ${
                  hasUnread ? 'text-gray-700 font-medium' : 'text-gray-500'
                }`}
              >
                {`Заказ №${item.kaspiOrderNumber}${
                  item.phone ? ` • ${item.phone}` : item.client?.phone ? ` • ${item.client?.phone}` : ''
                }`}
              </span>
            ) : (() => {
                const lm = item.lastMessage;
                const att0 = lm.attachments?.[0];
                const voiceMetaFromText = !lm.deleted ? parseVoiceListPreviewFromText(lm.text) : null;
                const isVoice =
                  !!att0 && !lm.deleted && (att0.type === 'voice' || isVoiceNoteAttachment(att0));
                const showVoiceRow =
                  !lm.deleted && (isVoice || voiceMetaFromText !== null);
                if (showVoiceRow) {
                  const durSec =
                    att0?.durationSeconds != null
                      ? att0.durationSeconds
                      : voiceMetaFromText?.durationSeconds;
                  const dur = formatVoiceListDuration(durSec);
                  const a11y = dur ? `Голосовое сообщение, длительность ${dur}` : 'Голосовое сообщение';
                  return (
                    <span
                      className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs md:text-sm ${
                        hasUnread ? 'text-gray-700 font-medium' : 'text-gray-500'
                      }`}
                      title={a11y}
                    >
                      <Mic
                        className={`h-3.5 w-3.5 flex-shrink-0 ${
                          hasUnread ? 'text-emerald-700' : 'text-emerald-600'
                        }`}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">
                        <span className={hasUnread ? 'text-gray-800' : 'text-gray-600'}>
                          Голосовое сообщение
                        </span>
                        {dur ? (
                          <span className={hasUnread ? 'text-gray-500' : 'text-gray-400'}>
                            {' · '}
                            <span className="tabular-nums">{dur}</span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                  );
                }
                return (
                  <span
                    className={`truncate text-xs md:text-sm ${
                      hasUnread ? 'text-gray-700 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {lm.attachments?.length
                      ? '[медиа]'
                      : lm.text.startsWith('[media') || lm.text === '[no text]'
                        ? '[медиа]'
                        : lm.text || '[медиа]'}
                  </span>
                );
              })()}
          </div>
        )}
        {!hasUnread && isNeedReply && (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[11px] md:text-xs text-amber-600 font-medium">
              Ждёт ответа{waitingDuration ? ` • ${waitingDuration}` : ''}
            </span>
          </div>
        )}
      </div>
    </button>
  );
});

function SkeletonRow() {
  return (
    <div
      className="border-b border-gray-100 px-3 py-2 md:px-4 md:py-2.5 flex items-center gap-3 animate-pulse"
      style={{ height: ROW_HEIGHT }}
    >
      <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-2/5" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
      </div>
    </div>
  );
}

const LOAD_MORE_COOLDOWN_MS = 600;

const ConversationList: React.FC<ConversationListProps> = ({
  items,
  selectedId,
  onSelect,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  showPaginationHints = true,
  onConversationContextMenu
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRequestedRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });

  const triggerLoadMore = useCallback(
    (reason: 'scroll' | 'intersection' | 'button') => {
      if (!hasMore || loadingMore || !onLoadMore) return;
      if (loadMoreRequestedRef.current) return;
      loadMoreRequestedRef.current = true;
      if (import.meta.env.DEV) {
        const root = parentRef.current;
        const st = root ? root.scrollTop : 0;
        const sh = root ? root.scrollHeight : 0;
        const ch = root ? root.clientHeight : 0;
        console.debug('[ConversationList] load more', {
          reason,
          itemsCount: items.length,
          hasMore,
          loadingMore,
          scrollBottomPx: root ? sh - st - ch : null
        });
      }
      void Promise.resolve(onLoadMore());
      window.setTimeout(() => {
        loadMoreRequestedRef.current = false;
      }, LOAD_MORE_COOLDOWN_MS);
    },
    [hasMore, loadingMore, onLoadMore, items.length]
  );

  const onScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || !hasMore || loadingMore || !onLoadMore) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < LOAD_MORE_PX) {
      triggerLoadMore('scroll');
    }
  }, [hasMore, loadingMore, onLoadMore, triggerLoadMore]);

  useEffect(() => {
    const root = parentRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore || !onLoadMore || items.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          triggerLoadMore('intersection');
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore, items.length, triggerLoadMore]);

  return (
    <div
      ref={parentRef}
      className="chats-list-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col"
      onScroll={onScroll}
    >
      {items.length === 0 && !loadingMore && (
        <div className="p-4 text-sm text-gray-500 text-center md:p-4">Нет диалогов</div>
      )}
      {items.length > 0 && (
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((v) => {
            const item = items[v.index];
            if (!item) return null;
            return (
              <div
                key={item.id}
                data-index={v.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${v.start}px)`
                }}
              >
                <ConversationRow
                  item={item}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onConversationContextMenu={onConversationContextMenu}
                  longPressTimerRef={longPressTimerRef}
                />
              </div>
            );
          })}
        </div>
      )}
      {items.length > 0 && showPaginationHints && hasMore && onLoadMore && (
        <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
      )}
      {loadingMore && (
        <div className="border-t border-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={`sk-${i}`} />
          ))}
        </div>
      )}
      {showPaginationHints && hasMore && onLoadMore && !loadingMore && items.length > 0 && (
        <div className="flex-none border-t border-gray-100 bg-gray-50/90 px-3 py-2">
          <button
            type="button"
            onClick={() => triggerLoadMore('button')}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Загрузить ещё
          </button>
        </div>
      )}
      {showPaginationHints && !hasMore && !loadingMore && items.length > 0 && (
        <div className="flex-none border-t border-gray-100 px-3 py-2 text-center text-xs text-gray-400">
          Все чаты загружены
        </div>
      )}
    </div>
  );
};

export default ConversationList;
