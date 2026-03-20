import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Чаты, в которых пользователь уже открыл диалог в этой сессии: в UI показываем unread=0
 * до прихода обновления Firestore (защита от «залипшего» snapshot).
 * Только в памяти вкладки — после reload источник истины снова Firestore.
 */
type WhatsAppLocalReadContextValue = {
  locallyReadIds: ReadonlySet<string>;
  markConversationOpened: (conversationId: string) => void;
};

const WhatsAppLocalReadContext = createContext<WhatsAppLocalReadContextValue | null>(null);

export function WhatsAppLocalReadProvider({ children }: { children: React.ReactNode }) {
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(() => new Set());

  const markConversationOpened = useCallback((conversationId: string) => {
    setLocallyReadIds((prev) => {
      if (prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.add(conversationId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      locallyReadIds,
      markConversationOpened
    }),
    [locallyReadIds, markConversationOpened]
  );

  return <WhatsAppLocalReadContext.Provider value={value}>{children}</WhatsAppLocalReadContext.Provider>;
}

export function useWhatsAppLocalRead(): WhatsAppLocalReadContextValue {
  const ctx = useContext(WhatsAppLocalReadContext);
  if (!ctx) {
    throw new Error('useWhatsAppLocalRead must be used within WhatsAppLocalReadProvider');
  }
  return ctx;
}

/** Для хуков вне провайдера (тесты) — пустой набор без подписки. */
export function useWhatsAppLocalReadOptional(): WhatsAppLocalReadContextValue {
  const ctx = useContext(WhatsAppLocalReadContext);
  const noop = useCallback(() => {}, []);
  const empty = useMemo(() => new Set<string>() as ReadonlySet<string>, []);
  if (!ctx) {
    return { locallyReadIds: empty, markConversationOpened: noop };
  }
  return ctx;
}
