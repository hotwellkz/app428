import React from 'react';
import type { CatalogIntegrationStatus } from '../types';

const styles: Record<CatalogIntegrationStatus, string> = {
  connected: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  not_connected: 'bg-gray-100 text-gray-700 border-gray-200',
  needs_setup: 'bg-amber-50 text-amber-900 border-amber-200',
  error: 'bg-rose-50 text-rose-800 border-rose-200'
};

export const IntegrationStatusBadge: React.FC<{ status: CatalogIntegrationStatus; label: string }> = ({
  status,
  label
}) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
  >
    {label}
  </span>
);
