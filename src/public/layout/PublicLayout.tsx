import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { publicTokens } from '../theme';
import { FloatingWhatsAppButton } from '../components/FloatingWhatsAppButton';

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * Прокрутка в начало страницы при любом переходе между публичными страницами.
 * Всегда scrollTop = 0, чтобы пользователь видел Hero/верх страницы.
 * Прокручиваем и window, и #root (в index.css у #root overflow-y: auto — скролл идёт там).
 * Отключаем history.scrollRestoration на время публичных страниц, чтобы браузер не восстанавливал старую позицию.
 */
function usePublicScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      const root = document.getElementById('root');
      if (root) {
        root.scrollTop = 0;
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const raf = requestAnimationFrame(scrollToTop);

    const prevRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';

    return () => {
      cancelAnimationFrame(raf);
      history.scrollRestoration = prevRestoration;
    };
  }, [pathname]);
}

/**
 * Обёртка для всех публичных (маркетинговых / SEO) страниц.
 * Не используется во внутренней CRM после логина.
 * Стили задаются через publicTokens — меняются централизованно.
 * При переходе по ссылкам между публичными страницами окно прокручивается вверх.
 */
export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  usePublicScrollToTop();

  return (
    <div className={publicTokens.layout.wrapper} data-public-site>
      <PublicHeader />
      <main>{children}</main>
      <FloatingWhatsAppButton />
      <PublicFooter />
    </div>
  );
};
