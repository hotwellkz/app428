import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MobileWhatsAppChatContextType {
  isMobileWhatsAppChatOpen: boolean;
  setMobileWhatsAppChatOpen: (open: boolean) => void;
}

const MobileWhatsAppChatContext = createContext<MobileWhatsAppChatContextType | undefined>(undefined);

export function useMobileWhatsAppChat(): MobileWhatsAppChatContextType | undefined {
  return useContext(MobileWhatsAppChatContext);
}

interface MobileWhatsAppChatProviderProps {
  children: ReactNode;
}

export function MobileWhatsAppChatProvider({ children }: MobileWhatsAppChatProviderProps) {
  const [isMobileWhatsAppChatOpen, setMobileWhatsAppChatOpen] = useState(false);
  const setMobileWhatsAppChatOpenCb = useCallback((open: boolean) => setMobileWhatsAppChatOpen(open), []);
  return (
    <MobileWhatsAppChatContext.Provider value={{ isMobileWhatsAppChatOpen, setMobileWhatsAppChatOpen: setMobileWhatsAppChatOpenCb }}>
      {children}
    </MobileWhatsAppChatContext.Provider>
  );
}
