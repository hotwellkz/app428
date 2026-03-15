import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const PublicCTA: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Попробуйте 2wix для своей команды
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
          Создайте компанию за минуту и начните вести клиентов, сделки и коммуникации в одном месте.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => navigate('/register-company')}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-slate-900 bg-white hover:bg-slate-100 shadow-xl transition-all"
          >
            Создать компанию
            <ArrowRight className="w-5 h-5" />
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white border-2 border-slate-500 hover:border-slate-400 transition-all"
          >
            На главную
          </Link>
        </div>
      </div>
    </section>
  );
};
