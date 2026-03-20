import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCompanyId } from '../contexts/CompanyContext';

type TimeLike = Date | Timestamp | null | undefined;

function toMillis(t: TimeLike): number | null {
  if (!t) return null;
  if (typeof (t as { toMillis?: () => number }).toMillis === 'function') return (t as { toMillis: () => number }).toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
    return ((t as { seconds: number }).seconds ?? 0) * 1000;
  }
  return null;
}

export interface WhatsAppFloatingButtonState {
  unreadChatsCount: number;
  awaitingReplyChatsCount: number;
  hasUnread: boolean;
  hasAwaitingReply: boolean;
}

/**
 * Единый глобальный индикатор для плавающей кнопки WhatsApp:
 * - unreadChatsCount: количество чатов с unreadCount > 0
 * - awaitingReplyChatsCount: количество чатов, где unreadCount == 0 и lastIncomingAt > lastOutgoingAt
 *
 * Источник: коллекция whatsappConversations (лёгкая подписка).
 */
export function useWhatsAppFloatingButtonState(enabled: boolean = true): WhatsAppFloatingButtonState {
  const companyId = useCompanyId();
  const [rows, setRows] = useState<
    Array<{ unreadCount?: number; lastIncomingAt?: TimeLike; lastOutgoingAt?: TimeLike; awaitingReplyDismissedAt?: TimeLike }>
  >([]);

  useEffect(() => {
    if (!enabled || !companyId) {
      setRows([]);
      return;
    }
    const q = query(
      collection(db, 'whatsappConversations'),
      where('companyId', '==', companyId),
      where('status', '==', 'active')
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            unreadCount: (data.unreadCount as number | undefined) ?? 0,
            lastIncomingAt: (data.lastIncomingAt as TimeLike) ?? null,
            lastOutgoingAt: (data.lastOutgoingAt as TimeLike) ?? null,
            awaitingReplyDismissedAt: (data.awaitingReplyDismissedAt as TimeLike) ?? null
          };
        });
        setRows(list);
      },
      (err) => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[WhatsAppFloatingButtonState] subscribe error', err);
        }
        setRows([]);
      }
    );
  }, [companyId, enabled]);

  return useMemo(() => {
    const unreadChatsCount = rows.reduce((acc, c) => acc + ((c.unreadCount ?? 0) > 0 ? 1 : 0), 0);

    const awaitingReplyChatsCount = rows.reduce((acc, c) => {
      const unread = c.unreadCount ?? 0;
      if (unread > 0) return acc; // awaitingReply только после прочтения
      const incoming = toMillis(c.lastIncomingAt);
      if (!incoming) return acc;
      const outgoing = toMillis(c.lastOutgoingAt);
      const dismissed = toMillis(c.awaitingReplyDismissedAt);
      const baseline = Math.max(
        outgoing ?? 0,
        dismissed ?? 0
      );
      const awaiting = baseline === 0 || baseline < incoming;
      return acc + (awaiting ? 1 : 0);
    }, 0);

    return {
      unreadChatsCount,
      awaitingReplyChatsCount,
      hasUnread: unreadChatsCount > 0,
      hasAwaitingReply: awaitingReplyChatsCount > 0
    };
  }, [rows]);
}

