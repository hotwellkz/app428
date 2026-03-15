import React from 'react';
import { publicTokens } from '../theme';

interface PublicSectionTitleProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export const PublicSectionTitle: React.FC<PublicSectionTitleProps> = ({
  title,
  subtitle,
  centered = true,
  className = '',
}) => (
  <div className={centered ? 'text-center mb-14' : 'mb-14'} data-public-site>
    <h2 className={`${publicTokens.typography.h2} ${centered ? '' : ''} mb-4`}>{title}</h2>
    {subtitle && (
      <p className={`${publicTokens.typography.body} max-w-2xl ${centered ? 'mx-auto' : ''} ${className}`.trim()}>
        {subtitle}
      </p>
    )}
  </div>
);
