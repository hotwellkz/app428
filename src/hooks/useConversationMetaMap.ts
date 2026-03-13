import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { COLLECTIONS } from '../lib/firebase/whatsappDb';

export interface ConversationMeta {
  unreadCount: number;
  lastMessageAt: number;
  lastIncomingAt: number;
  lastOutgoingAt: number;
}

function timeMs(v: unknown): number {
  if (!v) return 0;
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    return ((v as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(v as string).getTime();
}

/** id чата → метаданные (unread, последнее сообщение, входящие) */
export function useConversationMetaMap(companyId: string | null) {
  const [map, setMap] = useState<Record<string, ConversationMeta>>({});

  useEffect(() => {
    if (!companyId) {
      setMap({});
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.CONVERSATIONS),
      where('companyId', '==', companyId)
    );
    return onSnapshot(
      q,
      (snap) => {
        const next: Record<string, ConversationMeta> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          next[d.id] = {
            unreadCount: (data.unreadCount as number) ?? 0,
            lastMessageAt: timeMs(data.lastMessageAt),
            lastIncomingAt: timeMs(data.lastIncomingAt),
            lastOutgoingAt: timeMs(data.lastOutgoingAt)
          };
        });
        setMap(next);
      },
      () => setMap({})
    );
  }, [companyId]);

  return map;
}
