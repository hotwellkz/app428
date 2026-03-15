import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PublicSection } from '../layout/PublicSection';
import { PublicContainer } from '../layout/PublicContainer';
import { publicTokens } from '../theme';

interface PublicCTASectionProps {
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryAction?: () => void;
  secondaryLabel?: string;
  secondaryTo?: string;
  tertiaryLabel?: string;
  tertiaryTo?: string;
}

export const PublicCTASection: React.FC<PublicCTASectionProps> = ({
  title,
  subtitle = 'Создайте компанию за минуту и начните вести клиентов, сделки и коммуникации в одном месте.',
  primaryLabel = 'Создать компанию',
  primaryAction,
  secondaryLabel = 'На главную',
  secondaryTo = '/',
  tertiaryLabel,
  tertiaryTo,
}) => {
  const navigate = useNavigate();
  const handlePrimary = primaryAction ?? (() => navigate('/register-company'));

  return (
    <PublicSection variant="dark">
      <PublicContainer size="narrow" className="text-center">
        <h2 className="font-sans text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
        <p className="text-white/95 text-lg mb-10 max-w-xl mx-auto">{subtitle}</p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
          <button
            type="button"
            onClick={handlePrimary}
            className={publicTokens.button.ctaDark}
            data-public-site
          >
            {primaryLabel}
            <ArrowRight className="w-5 h-5" />
          </button>
          {secondaryLabel && (
            <Link to={secondaryTo} className={publicTokens.button.secondaryLg} data-public-site>
              {secondaryLabel}
            </Link>
          )}
          {tertiaryLabel && tertiaryTo && (
            <Link to={tertiaryTo} className={publicTokens.button.secondaryLg} data-public-site>
              {tertiaryLabel}
            </Link>
          )}
        </div>
      </PublicContainer>
    </PublicSection>
  );
};
