import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, ArrowLeftRight, UserCircle, List } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useMenuVisibility } from '../contexts/MenuVisibilityContext';
import { useIsMobile } from '../hooks/useIsMobile';

const MOBILE_BREAKPOINT = 768;

interface StickyNavigationProps {
  onNavigate: (page: string) => void;
}

export const StickyNavigation: React.FC<StickyNavigationProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);

  const isMobileDevice = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
    const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isMobileWidth = window.innerWidth < MOBILE_BREAKPOINT;
    return isMobileUserAgent || isMobileWidth;
  };

  const { isMenuVisible } = useMenuVisibility();
  const shouldBeVisible = !isMobileDevice() || isMenuVisible;

  // Mobile: bottom 100px чтобы не перекрывать ChatInput. Desktop: bottom 96px чтобы не перекрывать кнопку «Отправить»
  const containerClass = [
    'fixed right-2 z-[1000] flex flex-col transition-all duration-300 ease-in-out',
    isMobile ? 'bottom-[100px] gap-1.5' : 'bottom-[96px] gap-1.5',
    shouldBeVisible ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none',
  ].join(' ');

  const btnClass = isMobile
    ? 'w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 shadow text-white'
    : 'p-1.5 text-gray-700 hover:text-gray-900 bg-white rounded-full transition-colors duration-200 shadow';

  // Desktop: кнопка WhatsApp 48×48, иконка FaWhatsapp 20px, по центру, без обрезки
  const whatsappBtnClass = isMobile
    ? `${btnClass} bg-[#25D366] hover:bg-[#20bd5a] text-white`
    : 'w-12 h-12 flex items-center justify-center rounded-full overflow-hidden p-0 bg-[#25D366] hover:bg-[#20bd5a] text-white shadow transition-colors duration-200';

  return (
    <div className={containerClass}>
      <button
        onClick={() => navigate('/whatsapp')}
        className={whatsappBtnClass}
        title="WhatsApp"
      >
        <FaWhatsapp className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
      <button
        onClick={() => onNavigate('feed')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Список"
      >
        <List className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-3 h-3'} />
      </button>
      <button
        onClick={() => onNavigate('clients')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Клиенты"
      >
        <UserCircle className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-3 h-3'} />
      </button>
      <button
        onClick={() => onNavigate('warehouse')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Склад"
      >
        <Warehouse className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-3 h-3'} />
      </button>
      <button
        onClick={() => onNavigate('transactions')}
        className={isMobile ? `${btnClass} bg-white` : btnClass}
        title="Транзакции"
      >
        <ArrowLeftRight className={isMobile ? 'w-3.5 h-3.5 text-gray-700' : 'w-3 h-3'} />
      </button>
    </div>
  );
};
