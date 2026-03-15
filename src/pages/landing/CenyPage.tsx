import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { SEO_BASE_URL } from '../../config/seo';
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
    <SEOPageLayout
      title={TITLE}
      description={DESCRIPTION}
      path="/ceny"
      breadcrumbs={[
        { name: 'Главная', item: SEO_BASE_URL + '/' },
        { name: 'Цены', item: SEO_BASE_URL + '/ceny' },
      ]}
    >
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-sf-primaryLight/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
            Выберите формат работы с 2wix
          </h1>
          <p className="mt-6 text-xl text-sf-text-secondary max-w-2xl mx-auto">
            CRM для бизнеса, продаж, WhatsApp-коммуникаций и процессов — с понятным стартом и возможностью масштабирования.
          </p>
          <p className="mt-4 text-sf-text-muted max-w-xl mx-auto">
            Подходит как для небольших команд, так и для компаний с несколькими менеджерами и сложными процессами.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={scrollToPlans}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg shadow-sfMd transition-all"
            >
              Смотреть тарифы
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={scrollToDemo}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border-2 border-sf-border hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-all"
            >
              Запросить демо
            </button>
          </div>
        </div>
      </section>

      {/* Тарифные блоки */}
      <section id="tarify" className="py-16 md:py-24 bg-sf-surface scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Тарифы 2wix
          </h2>
          <p className="text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Начните с бесплатного старта или выберите план под размер команды и задачи.
          </p>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-sfCard border-2 p-8 flex flex-col transition-all hover:shadow-xl ${
                  plan.highlighted
                    ? 'border-sf-primary bg-gradient-to-b from-sf-primaryLight/80 to-sf-background shadow-lg shadow-sfCard scale-[1.02] md:scale-105 z-10'
                    : 'border-sf-border bg-sf-backgroundSection/30 hover:border-sf-cardBorder'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-sf-primary text-sf-text-inverse text-sm font-semibold">
                    Популярный
                  </div>
                )}
                <h3 className="text-2xl font-bold text-sf-text-primary">{plan.name}</h3>
                <p className="mt-1 text-sf-primary font-medium text-sm">{plan.tagline}</p>
                <p className="mt-3 text-sf-text-secondary text-sm">{plan.description}</p>
                <div className="mt-6">
                  {plan.price != null ? (
                    <span className="text-3xl font-bold text-sf-text-primary">{plan.price}</span>
                  ) : (
                    <span className="text-lg font-semibold text-sf-text-secondary">{plan.priceNote}</span>
                  )}
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-sf-text-secondary">
                      <Check className="w-4 h-4 text-sf-accent flex-shrink-0 mt-0.5" />
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
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-sfCard font-semibold transition-all ${
                      plan.highlighted
                        ? 'bg-sf-primary text-sf-text-inverse hover:bg-sf-primaryHover'
                        : 'bg-sf-primary text-sf-text-inverse hover:bg-sf-primaryHover'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {plan.ctaSecondary && (
                    <button
                      type="button"
                      onClick={scrollToDemo}
                      className="w-full py-3 rounded-sfCard font-medium text-sf-text-secondary border border-sf-border hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-all"
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
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что входит в 2wix
          </h2>
          <p className="text-sf-text-secondary text-center max-w-2xl mx-auto mb-12">
            Единая система для клиентов, продаж, коммуникаций и операционного контроля — не набор разрозненных сервисов.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {WHAT_INCLUDED.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 p-4 rounded-sfCard bg-sf-surface border border-sf-border hover:border-sf-cardBorder hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-sf-primaryLight flex items-center justify-center text-sf-accent">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-sf-text-secondary text-center">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link
              to="/vozmozhnosti"
              className="text-sf-accent font-medium hover:text-sf-primary hover:underline"
            >
              Подробнее о возможностях →
            </Link>
          </p>
        </div>
      </section>

      {/* Как выбрать тариф */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как выбрать тариф
          </h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Подберите формат под вашу команду и задачи.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_TO_CHOOSE.map((item) => (
              <div
                key={item.planId}
                className="p-6 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 hover:border-sf-cardBorder hover:bg-sf-primaryLight/30 transition-all"
              >
                <h3 className="text-lg font-bold text-sf-text-primary">{item.title}</h3>
                <p className="mt-2 text-sf-text-secondary text-sm">{item.desc}</p>
                <p className="mt-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-primaryLight text-sf-primary text-sm font-semibold">
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
      <section id="zapros-demo" className="py-16 md:py-24 bg-gradient-to-b from-sf-primaryLight/80 to-sf-backgroundSection/80 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Не уверены, какой формат вам подходит?
          </h2>
          <p className="text-lg text-sf-text-secondary mb-8">
            Покажем продукт в действии, подскажем подходящий тариф и поможем подобрать решение под ваш бизнес.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg shadow-sfMd transition-all"
            >
              Создать компанию
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="mailto:info@2wix.ru?subject=Запрос демо 2wix"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border-2 border-sf-border hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-all"
            >
              Запросить демо
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-medium text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </section>

      {/* Сравнение тарифов */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Сравнение тарифов
          </h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Все возможности по планам в одной таблице.
          </p>
          <div className="overflow-x-auto rounded-sfCard border border-sf-border shadow-lg">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="bg-sf-backgroundSection border-b border-sf-border">
                  <th className="px-6 py-4 font-semibold text-sf-text-primary">Возможность</th>
                  <th className="px-6 py-4 font-semibold text-sf-text-primary text-center">Start</th>
                  <th className="px-6 py-4 font-semibold text-sf-text-primary text-center bg-sf-primaryLight/80">Business</th>
                  <th className="px-6 py-4 font-semibold text-sf-text-primary text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sf-borderLight">
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="hover:bg-sf-backgroundSection/50">
                    <td className="px-6 py-3.5 text-sf-text-secondary font-medium">{row.feature}</td>
                    <td className="px-6 py-3.5 text-sf-text-secondary text-center text-sm">{row.start}</td>
                    <td className="px-6 py-3.5 text-sf-text-secondary text-center text-sm bg-sf-primaryLight/30 font-medium">
                      {row.business}
                    </td>
                    <td className="px-6 py-3.5 text-sf-text-secondary text-center text-sm">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Вопросы о тарифах
          </h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Частые вопросы о стоимости и форматах работы с 2wix.
          </p>
          <div className="space-y-4">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <details
                key={i}
                className="group rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none font-medium text-sf-text-primary hover:bg-sf-backgroundSection/50 transition-colors">
                  <span>{q}</span>
                  <ChevronDown className="w-5 h-5 text-sf-text-muted flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4 pt-0 text-sf-text-secondary text-sm leading-relaxed">
                  {a}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-sf-accent font-medium hover:text-sf-primary hover:underline"
            >
              <HelpCircle className="w-4 h-4" />
              Все вопросы и ответы
            </Link>
          </p>
        </div>
      </section>

      {/* CTA — только onDark-токены для контраста на тёмном фоне */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Начните работать в 2wix в формате, который подходит вашему бизнесу
          </h2>
          <p className="text-lg text-white/95 mb-10 max-w-xl mx-auto">
            Создайте компанию, запросите демо или войдите в аккаунт — выберите удобный шаг.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-primary bg-sf-surface hover:bg-sf-borderLight shadow-xl transition-all"
            >
              Создать компанию
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={scrollToDemo}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse border-2 border-white/40 hover:border-white/60 hover:bg-white/10 transition-all"
            >
              Запросить демо
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-medium text-white/90 hover:text-white border border-white/40 hover:border-white/60 transition-all"
            >
              Войти
            </button>
          </div>
          <div className="mt-12 pt-12 border-t border-white/25">
            <p className="text-white/90 text-sm mb-4">Полезные разделы</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link to="/crm-dlya-biznesa" className="text-white/90 hover:text-white text-sm transition-colors">
                CRM для бизнеса
              </Link>
              <Link to="/crm-dlya-prodazh" className="text-white/90 hover:text-white text-sm transition-colors">
                CRM для продаж
              </Link>
              <Link to="/whatsapp-crm" className="text-white/90 hover:text-white text-sm transition-colors">
                WhatsApp CRM
              </Link>
              <Link to="/vozmozhnosti" className="text-white/90 hover:text-white text-sm transition-colors">
                Возможности
              </Link>
              <Link to="/faq" className="text-white/90 hover:text-white text-sm transition-colors">
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
