import React from 'react';
import { publicTokens } from '../theme';

type CardVariant = 'base' | 'muted' | 'accent' | 'feature';

interface PublicCardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  className?: string;
}

const variantClass: Record<CardVariant, string> = {
  base: publicTokens.card.base,
  muted: publicTokens.card.muted,
  accent: publicTokens.card.accent,
  feature: publicTokens.card.feature,
};

export const PublicCard: React.FC<PublicCardProps> = ({ children, variant = 'base', className = '' }) => (
  <div className={`${variantClass[variant]} ${className}`.trim()} data-public-site>
    {children}
  </div>
);
