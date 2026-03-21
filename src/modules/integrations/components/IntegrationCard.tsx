import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { IntegrationCardModel } from '../types';
import { IntegrationStatusBadge } from './IntegrationStatusBadge';
import { getIntegrationSettingsPath } from '../integrationSettingsRoutes';

export const IntegrationCard: React.FC<{ card: IntegrationCardModel }> = ({ card }) => {
  const { Icon } = card;
  const needsAction = card.status === 'not_connected' || card.status === 'needs_setup' || card.status === 'error';
  const cta = needsAction ? 'Настроить' : 'Открыть';
  const settingsPath = getIntegrationSettingsPath(card.id);

  const cardInner = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100 text-gray-700 group-hover:bg-violet-50 group-hover:text-violet-700 group-hover:border-violet-100 transition">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{card.title}</h3>
            <IntegrationStatusBadge status={card.status} label={card.statusLabel} />
          </div>
          <p className="text-xs text-violet-700/90 font-medium mt-0.5">{card.categoryLabel}</p>
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{card.shortDescription}</p>
          {card.summaryLine ? (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{card.summaryLine}</p>
          ) : null}
          {card.lastCheckedAt ? (
            <p className="text-[11px] text-gray-400 mt-1">
              Проверка: {new Date(card.lastCheckedAt).toLocaleString('ru-RU')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end text-sm font-medium text-violet-600 group-hover:text-violet-700">
        {cta}
        <ChevronRight className="h-4 w-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </>
  );

  const shellClass =
    'group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 cursor-pointer';

  if (!settingsPath) {
    return (
      <div
        className={`${shellClass} opacity-80 cursor-not-allowed`}
        role="group"
        aria-invalid
        title="Неизвестная интеграция"
      >
        {cardInner}
      </div>
    );
  }

  return (
    <Link to={settingsPath} className={shellClass}>
      {cardInner}
    </Link>
  );
};

export const IntegrationCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse">
    <div className="flex gap-3">
      <div className="h-11 w-11 rounded-lg bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
    <div className="h-4 bg-gray-100 rounded w-20 ml-auto mt-4" />
  </div>
);
