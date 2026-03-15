import React from 'react';
import { Link } from 'react-router-dom';

interface PublicNavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export const PublicNavLink: React.FC<PublicNavLinkProps> = ({ to, children, className = '' }) => (
  <Link to={to} className={`text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors ${className}`.trim()} data-public-site>
    {children}
  </Link>
);
