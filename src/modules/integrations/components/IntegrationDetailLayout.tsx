import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export const IntegrationDetailLayout: React.FC<{
  title: string;
  description: string;
  /** Доп. строка под описанием (например статус) */
  meta?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, meta, children }) => (
  <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
    <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500 mb-4">
      <Link to="/settings/knowledge" className="hover:text-violet-600">
        Настройки
      </Link>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
      <Link to="/settings/integrations" className="hover:text-violet-600">
        Интеграции
      </Link>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
      <span className="text-gray-800 font-medium truncate">{title}</span>
    </nav>

    <header className="mb-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      {meta ? <div className="mt-3">{meta}</div> : null}
    </header>

    <div className="space-y-6">{children}</div>
  </div>
);
