import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import {
  Check,
  ArrowRight,
  Users,
  MessageSquare,
  GitBranch,
  FileText,
  BarChart3,
  Shield,
  Wallet,
  Package,
  ClipboardList,
  HelpCircle,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

const TITLE = 'Цены на CRM 2wix — тарифы и стоимость для бизнеса';
const DESCRIPTION =
  'Тарифы 2wix: Start, Business и Enterprise. CRM для бизнеса, продаж и WhatsApp — прозрачные условия, возможность начать с малого и масштабироваться. Узнайте стоимость.';

const PLANS = [
  {
    id: 'start',
    name: 'Start',
    tagline: 'Для малых команд и старта',
    description: 'Всё необходимое для начала: клиенты, чаты, сделки и шаблоны ответов.',
    price: null,
    priceNote: 'Бесплатный старт',
    features: [
      'Клиенты и база контактов',
      'WhatsApp и чаты в CRM',
      'Сделки и воронка',
      'Быстрые ответы и шаблоны',
      'До 3 пользователей',
    ],
    cta: 'Начать бесплатно',
    ctaSecondary: null,
    highlighted: false,
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Для растущего отдела продаж',
    description: 'Расширенная команда, аналитика, роли и финансы — полный контроль.',
    price: null,
    priceNote: 'По запросу',
    features: [
      'Всё из тарифа Start',
      'Аналитика и отчёты',
      'Роли и права доступа',
      'Транзакции и финансы',
      'Расширенная команда',
      'Приоритетная поддержка',
    ],
    cta: 'Узнать условия',
    ctaSecondary: 'Запросить демо',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Индивидуальная настройка',
    description: 'Масштабирование под процессы компании, внедрение и кастомные сценарии.',
    price: null,
    priceNote: 'Индивидуально',
    features: [
      'Всё из тарифа Business',
      'Индивидуальные настройки',
      'Масштабирование под процессы',
      'Сопровождение и внедрение',
      'Кастомные сценарии',
      'Выделенный менеджер',
    ],
    cta: 'Связаться с нами',
    ctaSecondary: null,
    highlighted: false,
  },
];

const WHAT_INCLUDED = [
  { label: 'Клиенты', icon: Users },
  { label: 'WhatsApp', icon: MessageSquare },
  { label: 'Сделки', icon: GitBranch },
  { label: 'Шаблоны', icon: FileText },
  { label: 'Аналитика', icon: BarChart3 },
  { label: 'Сотрудники', icon: Users },
  { label: 'Роли и права', icon: Shield },
  { label: 'Финансы', icon: Wallet },
  { label: 'Склад', icon: Package },
  { label: 'Отчёты', icon: ClipboardList },
];

const HOW_TO_CHOOSE = [
  {
    title: 'Небольшая команда',
    desc: 'До 3 человек, клиенты, чаты и сделки — без сложной аналитики.',
    plan: 'Start',
    planId: 'start',
  },
  {
    title: 'Отдел продаж, несколько менеджеров',
    desc: 'Нужны отчёты, роли, контроль финансов и расширенная команда.',
    plan: 'Business',
    planId: 'business',
  },
  {
    title: 'Сложные процессы и адаптация',
    desc: 'Индивидуальные настройки, внедрение под ваши процессы, кастомные сценарии.',
    plan: 'Enterprise',
    planId: 'enterprise',
  },
];

const COMPARISON_ROWS = [
  { feature: 'Пользователи', start: '1–3', business: 'Расширенная команда', enterprise: 'Без ограничений' },
  { feature: 'Клиенты и контакты', start: '✓', business: '✓', enterprise: '✓' },
  { feature: 'WhatsApp и чаты', start: '✓', business: '✓', enterprise: '✓' },
  { feature: 'Сделки и воронка', start: '✓', business: '✓', enterprise: '✓' },
  { feature: 'Быстрые ответы', start: '✓', business: '✓', enterprise: '✓' },
  { feature: 'Аналитика и отчёты', start: 'Базовая', business: '✓', enterprise: '✓' },
  { feature: 'Роли и права', start: '—', business: '✓', enterprise: '✓' },
  { feature: 'Транзакции и финансы', start: '—', business: '✓', enterprise: '✓' },
  { feature: 'Склад и материалы', start: '—', business: '✓', enterprise: '✓' },
  { feature: 'Индивидуальные настройки', start: '—', business: '—', enterprise: '✓' },
  { feature: 'Внедрение и сопровождение', start: '—', business: '—', enterprise: '✓' },
  { feature: 'Поддержка', start: 'Базовая', business: 'Приоритетная', enterprise: 'Выделенный менеджер' },
];

const FAQ_ITEMS = [
  {
    q: 'Есть ли бесплатный тест?',
    a: 'Да. Тариф Start позволяет начать работу бесплатно: клиенты, чаты, сделки и шаблоны доступны сразу. Так вы можете оценить продукт и при необходимости перейти на Business или Enterprise.',
  },
  {
    q: 'Можно ли начать с базового тарифа?',
    a: 'Да. Start — оптимальный старт для малых команд. Когда понадобятся аналитика, роли и финансы, можно перейти на Business.',
  },
  {
    q: 'Можно ли перейти на другой тариф позже?',
    a: 'Да. Формат работы можно изменить: переход на более высокий тариф открывает дополнительные возможности без потери данных.',
  },
  {
    q: 'Подходит ли 2wix для команды из нескольких менеджеров?',
    a: 'Да. Тариф Business рассчитан на отдел продаж: роли, права, аналитика по менеджерам и приоритетная поддержка. Enterprise — для крупных команд и индивидуальных требований.',
  },
  {
    q: 'Есть ли индивидуальные условия?',
    a: 'Да. Для тарифов Business и Enterprise условия и стоимость рассчитываются под вашу компанию: количество пользователей, набор модулей и объём поддержки. Свяжитесь с нами для расчёта.',
  },
  {
    q: 'Можно ли внедрить систему под процессы компании?',
    a: 'Да. В формате Enterprise возможны индивидуальные настройки, сопровождение внедрения и кастомные сценарии под ваши бизнес-процессы.',
  },
  {
    q: 'Есть ли демо?',
    a: 'Да. Можем показать продукт онлайн, подсказать подходящий тариф и ответить на вопросы. Запросите демо через кнопку на странице или свяжитесь с нами.',
  },
];

export const CenyPage: React.FC = () => {
  const navigate = useNavigate();

  const scrollToDemo = useCallback(() => {
    document.getElementById('zapros-demo')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToPlans = useCallback(() => {
    document.getElementById('tarify')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION}>
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-white" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-emerald-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
            Выберите формат работы с 2wix
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            CRM для бизнеса, продаж, WhatsApp-коммуникаций и процессов — с понятным стартом и возможностью масштабирования.
          </p>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Подходит как для небольших команд, так и для компаний с несколькими менеджерами и сложными процессами.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={scrollToPlans}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all"
            >
              Смотреть тарифы
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={scrollToDemo}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
            >
              Запросить демо
            </button>
          </div>
        </div>
      </section>

      {/* Тарифные блоки */}
      <section id="tarify" className="py-16 md:py-24 bg-white scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            Тарифы 2wix
          </h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-14">
            Начните с бесплатного старта или выберите план под размер команды и задачи.
          </p>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-8 flex flex-col transition-all hover:shadow-xl ${
                  plan.highlighted
                    ? 'border-emerald-500 bg-gradient-to-b from-emerald-50/80 to-white shadow-lg shadow-emerald-500/10 scale-[1.02] md:scale-105 z-10'
                    : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-white text-sm font-semibold">
                    Популярный
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-emerald-700 font-medium text-sm">{plan.tagline}</p>
                <p className="mt-3 text-slate-600 text-sm">{plan.description}</p>
                <div className="mt-6">
                  {plan.price != null ? (
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                  ) : (
                    <span className="text-lg font-semibold text-slate-700">{plan.priceNote}</span>
                  )}
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      plan.id === 'start' ? navigate('/register-company') : scrollToDemo()
                    }
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all ${
                      plan.highlighted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {plan.ctaSecondary && (
                    <button
                      type="button"
                      onClick={scrollToDemo}
                      className="w-full py-3 rounded-xl font-medium text-slate-600 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
                    >
                      {plan.ctaSecondary}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что входит в 2wix */}
      <section className="py-16 md:py-24 bg-slate-50/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            Что входит в 2wix
          </h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-12">
            Единая система для клиентов, продаж, коммуникаций и операционного контроля — не набор разрозненных сервисов.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {WHAT_INCLUDED.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-slate-700 text-center">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link
              to="/vozmozhnosti"
              className="text-emerald-600 font-medium hover:text-emerald-700 hover:underline"
            >
              Подробнее о возможностях →
            </Link>
          </p>
        </div>
      </section>

      {/* Как выбрать тариф */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            Как выбрать тариф
          </h2>
          <p className="text-slate-600 text-center mb-12">
            Подберите формат под вашу команду и задачи.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_TO_CHOOSE.map((item) => (
              <div
                key={item.planId}
                className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
              >
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600 text-sm">{item.desc}</p>
                <p className="mt-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-semibold">
                    <Sparkles className="w-4 h-4" />
                    {item.plan}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Почему нужно запросить демо */}
      <section id="zapros-demo" className="py-16 md:py-24 bg-gradient-to-b from-emerald-50/80 to-slate-50/80 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Не уверены, какой формат вам подходит?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Покажем продукт в действии, подскажем подходящий тариф и поможем подобрать решение под ваш бизнес.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 transition-all"
            >
              Создать компанию
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="mailto:info@2wix.ru?subject=Запрос демо 2wix"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
            >
              Запросить демо
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </section>

      {/* Сравнение тарифов */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            Сравнение тарифов
          </h2>
          <p className="text-slate-600 text-center mb-12">
            Все возможности по планам в одной таблице.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-lg">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 font-semibold text-slate-900">Возможность</th>
                  <th className="px-6 py-4 font-semibold text-slate-900 text-center">Start</th>
                  <th className="px-6 py-4 font-semibold text-slate-900 text-center bg-emerald-50/80">Business</th>
                  <th className="px-6 py-4 font-semibold text-slate-900 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 text-slate-700 font-medium">{row.feature}</td>
                    <td className="px-6 py-3.5 text-slate-600 text-center text-sm">{row.start}</td>
                    <td className="px-6 py-3.5 text-slate-700 text-center text-sm bg-emerald-50/30 font-medium">
                      {row.business}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-center text-sm">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-slate-50/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
            Вопросы о тарифах
          </h2>
          <p className="text-slate-600 text-center mb-12">
            Частые вопросы о стоимости и форматах работы с 2wix.
          </p>
          <div className="space-y-4">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <details
                key={i}
                className="group rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none font-medium text-slate-900 hover:bg-slate-50/50 transition-colors">
                  <span>{q}</span>
                  <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4 pt-0 text-slate-600 text-sm leading-relaxed">
                  {a}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:text-emerald-700 hover:underline"
            >
              <HelpCircle className="w-4 h-4" />
              Все вопросы и ответы
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Начните работать в 2wix в формате, который подходит вашему бизнесу
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
            Создайте компанию, запросите демо или войдите в аккаунт — выберите удобный шаг.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-slate-900 bg-white hover:bg-slate-100 shadow-xl transition-all"
            >
              Создать компанию
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={scrollToDemo}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white border-2 border-slate-500 hover:border-slate-400 hover:bg-slate-800/50 transition-all"
            >
              Запросить демо
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-medium text-slate-300 hover:text-white transition-colors"
            >
              Войти
            </button>
          </div>
          <div className="mt-12 pt-12 border-t border-slate-700">
            <p className="text-slate-400 text-sm mb-4">Полезные разделы</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link to="/crm-dlya-biznesa" className="text-slate-400 hover:text-white text-sm transition-colors">
                CRM для бизнеса
              </Link>
              <Link to="/crm-dlya-prodazh" className="text-slate-400 hover:text-white text-sm transition-colors">
                CRM для продаж
              </Link>
              <Link to="/whatsapp-crm" className="text-slate-400 hover:text-white text-sm transition-colors">
                WhatsApp CRM
              </Link>
              <Link to="/vozmozhnosti" className="text-slate-400 hover:text-white text-sm transition-colors">
                Возможности
              </Link>
              <Link to="/faq" className="text-slate-400 hover:text-white text-sm transition-colors">
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
