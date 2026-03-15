import React from 'react';
import { Link } from 'react-router-dom';
import { publicTokens } from '../theme';

type ButtonVariant = 'primary' | 'primaryLg' | 'secondary' | 'secondaryLg' | 'ghost' | 'ctaDark';

interface PublicButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  onClick?: () => void;
  to?: string;
  href?: string;
  type?: 'button' | 'submit';
  className?: string;
  icon?: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: publicTokens.button.primary,
  primaryLg: publicTokens.button.primaryLg,
  secondary: publicTokens.button.secondary,
  secondaryLg: publicTokens.button.secondaryLg,
  ghost: publicTokens.button.ghost,
  ctaDark: publicTokens.button.ctaDark,
};

export const PublicButton: React.FC<PublicButtonProps> = ({
  children,
  variant = 'primary',
  onClick,
  to,
  href,
  type = 'button',
  className = '',
  icon,
}) => {
  const baseClass = variantClass[variant];
  const content = (
    <>
      {children}
      {icon}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${baseClass} ${className}`.trim()} data-public-site>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={`${baseClass} ${className}`.trim()} data-public-site>
        {content}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={`${baseClass} ${className}`.trim()} data-public-site>
      {content}
    </button>
  );
};
