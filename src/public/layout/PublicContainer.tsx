import React from 'react';
import { publicTokens } from '../theme';

type Size = 'base' | 'narrow' | 'wide';

interface PublicContainerProps {
  children: React.ReactNode;
  size?: Size;
  className?: string;
}

const containerClass: Record<Size, string> = {
  base: publicTokens.container.base,
  narrow: publicTokens.container.narrow,
  wide: publicTokens.container.wide,
};

export const PublicContainer: React.FC<PublicContainerProps> = ({ children, size = 'base', className = '' }) => (
  <div className={`${containerClass[size]} ${className}`.trim()} data-public-site>
    {children}
  </div>
);
