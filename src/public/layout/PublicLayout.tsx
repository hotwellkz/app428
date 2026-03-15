import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { publicTokens } from '../theme';

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * Прокрутка в начало страницы при переходе между публичными страницами.
 * При смене pathname: если в URL есть hash — прокрутка к якорю, иначе — в самый верх.
 */
function usePublicScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
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
