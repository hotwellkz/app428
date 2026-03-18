import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl, getDefaultWhatsAppMessage } from '../../config/whatsapp';

export const FloatingWhatsAppButton: React.FC = () => {
  const { pathname } = useLocation();

  const href = useMemo(() => {
    const msg = getDefaultWhatsAppMessage(pathname);
    return buildWhatsAppUrl(msg);
  }, [pathname]);

  const label =
    pathname === '/crm-dlya-kaspi' ? 'Написать в WhatsApp по Kaspi' : 'Написать в WhatsApp';

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Написать в WhatsApp"
      className="fixed z-[60] bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-sfCardHover hover:bg-[#20bd5a] transition-all text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366]"
      data-public-site
    >
      <MessageCircle className="w-5 h-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

