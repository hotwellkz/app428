import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { publicTokens } from '../theme';

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * Прокрутка в начало страницы при любом переходе между публичными страницами.
 * Всегда scrollTop = 0, чтобы пользователь видел Hero/верх страницы.
 * Якоря (#section) внутри одной страницы работают через нативный браузерный скролл;
 * при переходе на новую страницу не прокручиваем к hash — только вверх.
 */
function usePublicScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
      <PublicFooter />
    </div>
  );
};
