import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { Check, ArrowRight } from 'lucide-react';

const TITLE = 'Цены на CRM 2wix — тарифы и стоимость для бизнеса';
const DESCRIPTION = 'Тарифы 2wix: Start, Business и Enterprise. CRM для бизнеса и отдела продаж — прозрачные цены и возможность начать бесплатно.';

const PLANS = [
  {
    name: 'Start',
    desc: 'Для малых команд и старта',
    features: ['До 5 пользователей', 'Клиенты и сделки', 'WhatsApp CRM', 'Базовая аналитика'],
    cta: 'Начать бесплатно',
    highlighted: false,
  },
  {
    name: 'Business',
    desc: 'Для растущего бизнеса',
    features: ['Расширенная команда', 'Все модули', 'Роли и права', 'Аналитика и отчёты', 'Приоритетная поддержка'],
    cta: 'Узнать цену',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    desc: 'Индивидуальная настройка',
    features: ['Без ограничений', 'Интеграции под заказ', 'Выделенный менеджер', 'SLA и безопасность'],
    cta: 'Связаться с нами',
    highlighted: false,
  },
];

export const CenyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION}>
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
            Цены на CRM 2wix
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            Прозрачные тарифы для бизнеса любого масштаба. Начните бесплатно или выберите план под вашу команду.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-14">Тарифы</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {PLANS.map(({ name, desc, features, cta, highlighted }) => (
              <div
                key={name}
                className={`rounded-2xl border-2 p-8 flex flex-col ${
                  highlighted
                    ? 'border-emerald-500 bg-emerald-50/30 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <h3 className="text-xl font-bold text-slate-900">{name}</h3>
                <p className="mt-2 text-slate-600 text-sm">{desc}</p>
                <ul className="mt-6 space-y-3 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className={`mt-8 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all ${
                    highlighted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm mt-10">
            Итоговая стоимость зависит от количества пользователей и набора модулей. Свяжитесь с нами для расчёта под вашу компанию.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">Полезные ссылки</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
              Возможности
            </Link>
            <Link to="/faq" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
              Частые вопросы
            </Link>
            <Link to="/" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
              На главную
            </Link>
          </div>
        </div>
      </section>

      <PublicCTA />
    </SEOPageLayout>
  );
};
