import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * Устанавливает noindex, nofollow для всех страниц внутреннего приложения CRM.
 * Монтируется только когда пользователь авторизован, чтобы поисковики не индексировали
 * приватные маршруты (transactions, feed, clients и т.д.).
 */
export const CrmNoIndex: React.FC = () => (
  <Helmet>
    <meta name="robots" content="noindex, nofollow" />
  </Helmet>
);
