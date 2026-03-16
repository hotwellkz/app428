import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, ArrowLeftRight, UserCircle, List } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useMenuVisibility } from '../contexts/MenuVisibilityContext';
import { useMobileWhatsAppChat } from '../contexts/MobileWhatsAppChatContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWhatsAppFloatingButtonState } from '../hooks/useWhatsAppFloatingButtonState';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_COLLAPSE_DELAY_MS = 220;
const EDGE_ZONE_WIDTH_PX = 14;

interface StickyNavigationProps {
  onNavigate: (page: string) => void;
}

export const StickyNavigation: React.FC<StickyNavigationProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const mobileChatContext = useMobileWhatsAppChat();
  const hideForMobileChat = isMobile && mobileChatContext?.isMobileWhatsAppChatOpen;
  const { canAccess, loading: accessLoading } = useCurrentCompanyUser();
  const canAccessWhatsApp = !accessLoading && canAccess('whatsapp');
  const canAccessFeed = !accessLoading && canAccess('feed');
  const canAccessClients = !accessLoading && canAccess('clients');
  const canAccessWarehouse = !accessLoading && canAccess('warehouse');
  const canAccessTransactions = !accessLoading && canAccess('transactions');

  const waState = useWhatsAppFloatingButtonState(canAccessWhatsApp);

  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMobileDevice = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
    const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isMobileWidth = window.innerWidth < MOBILE_BREAKPOINT;
    return isMobileUserAgent || isMobileWidth;
  };

  const { isMenuVisible } = useMenuVisibility();
  const shouldBeVisible = (!isMobileDevice() || isMenuVisible) && !hideForMobileChat;

  const scheduleCollapse = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      setDesktopExpanded(false);
    }, DESKTOP_COLLAPSE_DELAY_MS);
  }, []);

  const cancelCollapse = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  const handlePanelMouseEnter = useCallback(() => {
    if (isMobile) return;
    cancelCollapse();
    setDesktopExpanded(true);
  }, [isMobile, cancelCollapse]);

  const handlePanelMouseLeave = useCallback(() => {
    if (isMobile) return;
    scheduleCollapse();
  }, [isMobile, scheduleCollapse]);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  const btnClass = isMobile
    ? 'w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 shadow text-white'
    : 'w-11 h-11 flex items-center justify-center rounded-full bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200 shadow';

  const whatsappBtnClass = isMobile
    ? `${btnClass} bg-[#25D366] hover:bg-[#20bd5a] text-white`
    : 'w-12 h-12 flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow transition-colors duration-200';

  const unreadBadgeText = waState.unreadChatsCount > 99 ? '99+' : String(waState.unreadChatsCount);
  const showUnreadBadge = waState.unreadChatsCount > 0;
  const showAwaitingGlow = waState.hasAwaitingReply;

  const showAsCollapsed = !isMobile && !desktopExpanded && canAccessWhatsApp;

  return (
    <>
      {/* Desktop: тонкая зона у правого края — наведение раскрывает панель */}
      {!isMobile && shouldBeVisible && (
        <div
          className="fixed right-0 top-0 bottom-0 z-[999]"
          style={{ width: EDGE_ZONE_WIDTH_PX }}
          onMouseEnter={handlePanelMouseEnter}
          aria-hidden
        />
      )}

      <div
        className={[
          'fixed z-[1000] flex flex-col items-center transition-all duration-200 ease-out',
          isMobile ? 'right-2 bottom-[100px] gap-1.5' : 'right-4 bottom-7 gap-2.5',
          shouldBeVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none',
        ].join(' ')}
        onMouseEnter={handlePanelMouseEnter}
        onMouseLeave={handlePanelMouseLeave}
      >
        {/* Свёрнутый режим (desktop): только триггер с бейджем */}
        {showAsCollapsed && (
          <div className="flex flex-col items-center rounded-2xl bg-white/95 backdrop-blur border border-gray-200/80 shadow-lg p-1.5">
            {canAccessWhatsApp && (
              <button
                onClick={() => navigate('/whatsapp')}
                className={[
                  whatsappBtnClass,
                  'relative',
                  showAwaitingGlow ? 'ring-2 ring-amber-400/50 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]' : '',
                ].join(' ')}
                title="Чаты"
              >
                <FaWhatsapp className="w-5 h-5" />
                {showUnreadBadge && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold ring-2 ring-white"
                    aria-label={`Непрочитанные: ${waState.unreadChatsCount}`}
                  >
                    {unreadBadgeText}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Полная панель: mobile всегда, desktop — когда раскрыта */}
        {(!showAsCollapsed || isMobile) && (
          <div
            className={[
              'flex flex-col items-center',
              !isMobile ? 'rounded-2xl bg-white/95 backdrop-blur border border-gray-200/80 shadow-lg p-2 gap-2' : 'gap-1.5',
            ].join(' ')}
          >
            {canAccessWhatsApp && (
              <button
                onClick={() => navigate('/whatsapp')}
                className={[
                  whatsappBtnClass,
                  'relative',
                  showAwaitingGlow ? 'ring-2 ring-amber-400/50 shadow-[0_0_0_3px_rgba(251,191,36,0.12)] motion-reduce:animate-none' : '',
                ].join(' ')}
                title="Чаты"
              >
                <FaWhatsapp className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                {showUnreadBadge && (
                  <span
                    className={[
                      'absolute bg-red-500 text-white font-semibold text-center shadow rounded-full ring-2 ring-white',
                      isMobile ? 'min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] -top-1 -right-1' : 'min-w-[18px] h-[18px] px-1 text-[10px] -top-0.5 -right-0.5',
                    ].join(' ')}
                    aria-label={`Непрочитанные чаты: ${waState.unreadChatsCount}`}
                  >
                    {unreadBadgeText}
                  </span>
                )}
              </button>
            )}

            {canAccessFeed && (
              <button onClick={() => onNavigate('feed')} className={isMobile ? `${btnClass} bg-white` : btnClass} title="Список">
                <List className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
              </button>
            )}

            {canAccessClients && (
              <button onClick={() => onNavigate('clients')} className={isMobile ? `${btnClass} bg-white` : btnClass} title="Клиенты">
                <UserCircle className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
              </button>
            )}

            {canAccessWarehouse && (
              <button onClick={() => onNavigate('warehouse')} className={isMobile ? `${btnClass} bg-white` : btnClass} title="Склад">
                <Warehouse className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
              </button>
            )}

            {canAccessTransactions && (
              <button onClick={() => onNavigate('transactions')} className={isMobile ? `${btnClass} bg-white` : btnClass} title="Транзакции">
                <ArrowLeftRight className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
