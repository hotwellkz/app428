import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const CTASection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="font-sans py-20 md:py-28 bg-sf-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
          Попробуйте 2wix для своей команды
        </h2>
        <p className="text-lg text-white/95 mb-10 max-w-xl mx-auto">
          Создайте компанию за минуту и начните вести клиентов, сделки и коммуникации в одном месте.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => navigate('/register-company')}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfButton font-semibold text-sf-primary bg-sf-surface hover:bg-sf-surfaceElevated shadow-sfCardHover transition-all"
          >
            Создать компанию
            <ArrowRight className="w-5 h-5" />
          </button>
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfButton font-semibold text-sf-text-inverse border-2 border-sf-borderLight hover:border-white/50 transition-all"
          >
            Войти
          </a>
        </div>
      </div>
    </section>
  );
};
