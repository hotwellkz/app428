import React from 'react';
import { Link } from 'react-router-dom';

interface PublicNavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export const PublicNavLink: React.FC<PublicNavLinkProps> = ({ to, children, className = '' }) => (
  <Link to={to} className={`text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors ${className}`.trim()} data-public-site>
    {children}
  </Link>
);
