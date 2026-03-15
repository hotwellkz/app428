import React from 'react';
import { publicTokens } from '../theme';

type SectionVariant = 'default' | 'subtle' | 'dark' | 'large';

interface PublicSectionProps {
  children: React.ReactNode;
  variant?: SectionVariant;
  className?: string;
  /** для секции с padding по дизайн-системе */
  noPadding?: boolean;
}

const variantClasses: Record<SectionVariant, string> = {
  default: `${publicTokens.section.py} ${publicTokens.bg.page}`,
  subtle: `${publicTokens.section.py} ${publicTokens.bg.subtle}`,
  dark: `${publicTokens.section.pyLg} ${publicTokens.bg.darkSection}`,
  large: `${publicTokens.section.pyLg} ${publicTokens.bg.page}`,
};

export const PublicSection: React.FC<PublicSectionProps> = ({
  children,
  variant = 'default',
  className = '',
  noPadding = false,
}) => {
  const base = noPadding ? '' : variantClasses[variant];
  return (
    <section className={`${base} ${className}`.trim()} data-public-site>
      {children}
    </section>
  );
};
