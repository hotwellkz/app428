import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { COLLECTIONS } from '../lib/firebase/whatsappDb';

/** conversationId -> unreadCount (для бейджей на карточках сделок) */
export function useConversationUnreadMap(companyId: string | null) {
  const [map, setMap] = useState<Record<string, number>>({});

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
        const next: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const u = (d.data().unreadCount as number) ?? 0;
          if (u > 0) next[d.id] = u;
        });
        setMap(next);
      },
      () => setMap({})
    );
  }, [companyId]);

  return map;
}
