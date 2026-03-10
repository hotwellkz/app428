import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, ArrowLeftRight, UserCircle, List } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useMenuVisibility } from '../contexts/MenuVisibilityContext';
import { useMobileWhatsAppChat } from '../contexts/MobileWhatsAppChatContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWhatsAppFloatingButtonState } from '../hooks/useWhatsAppFloatingButtonState';

const MOBILE_BREAKPOINT = 768;

interface StickyNavigationProps {
  onNavigate: (page: string) => void;
}

export const StickyNavigation: React.FC<StickyNavigationProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const mobileChatContext = useMobileWhatsAppChat();
  const hideForMobileChat = isMobile && mobileChatContext?.isMobileWhatsAppChatOpen;
  const waState = useWhatsAppFloatingButtonState();

  const isMobileDevice = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
    const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isMobileWidth = window.innerWidth < MOBILE_BREAKPOINT;
    return isMobileUserAgent || isMobileWidth;
  };

  const { isMenuVisible } = useMenuVisibility();
  const shouldBeVisible = (!isMobileDevice() || isMenuVisible) && !hideForMobileChat;

  // Mobile: bottom 100px чтобы не перекрывать ChatInput. Desktop: аккуратный отступ от края.
  const containerClass = [
    'fixed z-[1000] flex flex-col items-center transition-all duration-300 ease-in-out',
    isMobile ? 'right-2 bottom-[100px] gap-1.5' : 'right-6 bottom-7 gap-3',
    shouldBeVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none',
  ].join(' ');

  // Mobile оставляем компактным. Desktop — фиксируем размеры, чтобы кнопки не "сплющивались" и не плясали.
  const btnClass = isMobile
    ? 'w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 shadow text-white'
    : 'w-11 h-11 flex items-center justify-center rounded-full bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200 shadow';

  // Desktop: WhatsApp крупнее вторичных кнопок.
  const whatsappBtnClass = isMobile
    ? `${btnClass} bg-[#25D366] hover:bg-[#20bd5a] text-white`
    : 'w-14 h-14 flex items-center justify-center rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow transition-colors duration-200';

  const unreadBadgeText = waState.unreadChatsCount > 99 ? '99+' : String(waState.unreadChatsCount);
  const showUnreadBadge = waState.unreadChatsCount > 0;
  const showAwaitingGlow = waState.hasAwaitingReply;

  return (
    <div className={containerClass}>
      <button
        onClick={() => navigate('/whatsapp')}
        className={[
          whatsappBtnClass,
          'relative',
          // awaiting reply: мягкая подсветка/пульсация (ненавязчиво)
          showAwaitingGlow ? 'ring-2 ring-amber-400/60 shadow-[0_0_0_4px_rgba(251,191,36,0.15)] animate-pulse motion-reduce:animate-none' : ''
        ].join(' ')}
        title="WhatsApp"
      >
        <FaWhatsapp className={isMobile ? 'w-4 h-4' : 'w-6 h-6'} />
        {showUnreadBadge && (
          <span
            className={[
              'absolute bg-red-500 text-white font-semibold text-center shadow rounded-full',
              // mobile
              'min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] -top-1 -right-1',
              // desktop: чуть крупнее + белая окантовка, чтобы badge выглядел чище
              'md:min-w-[20px] md:h-[20px] md:px-1.5 md:text-[11px] md:leading-[20px] md:-top-1 md:-right-1 md:ring-2 md:ring-white'
            ].join(' ')}
            aria-label={`Непрочитанные чаты: ${waState.unreadChatsCount}`}
          >
            {unreadBadgeText}
          </span>
        )}
      </button>
      <button
        onClick={() => onNavigate('feed')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Список"
      >
        <List className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
      </button>
      <button
        onClick={() => onNavigate('clients')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Клиенты"
      >
        <UserCircle className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
      </button>
      <button
        onClick={() => onNavigate('warehouse')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Склад"
      >
        <Warehouse className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
      </button>
      <button
        onClick={() => onNavigate('transactions')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Транзакции"
      >
        <ArrowLeftRight className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-4 h-4'} />
      </button>
    </div>
  );
};
