import React from 'react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { publicTokens } from '../theme';

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * Обёртка для всех публичных (маркетинговых / SEO) страниц.
 * Не используется во внутренней CRM после логина.
 * Стили задаются через publicTokens — меняются централизованно.
 */
export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => (
  <div className={publicTokens.layout.wrapper} data-public-site>
    <PublicHeader />
    <main>{children}</main>
    <PublicFooter />
  </div>
);
