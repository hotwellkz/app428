import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicProductPreview } from '../../public/components/PublicProductPreview';
import {
  Users,
  MessageSquare,
  GitBranch,
  BarChart3,
  Inbox,
  UserCheck,
  ArrowRight,
  Check,
  AlertCircle,
  FileText,
  LayoutDashboard,
  Shield,
  Eye,
  Building2,
  Store,
  Wrench,
  Factory,
  HelpCircle,
  Zap,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const TITLE =
  'Как выбрать CRM для бизнеса — критерии, ошибки, на что смотреть | 2wix';
const DESCRIPTION =
  'Как выбрать CRM-систему и не ошибиться: на что смотреть при выборе CRM, критерии выбора для малого бизнеса и отдела продаж. Клиенты, заявки, WhatsApp, аналитика. Выбор CRM для бизнеса — 2wix.';

const WHY_CHOICE_MATTERS = [
  { icon: Users, title: 'Работа с клиентами', text: 'От того, как вы ведёте базу и историю контактов, зависит, теряете ли вы клиентов и контекст.' },
  { icon: Inbox, title: 'Контроль заявок', text: 'Заявки из разных каналов должны попадать в одно место — иначе часть обращений теряется.' },
  { icon: BarChart3, title: 'Прозрачность продаж', text: 'Руководитель должен видеть воронку, этапы и цифры без ручного сбора отчётов.' },
  { icon: UserCheck, title: 'Работа команды', text: 'Несколько менеджеров в одной системе — без потери контекста при передаче клиента.' },
  { icon: TrendingUp, title: 'Скорость роста бизнеса', text: 'Понятная CRM масштабируется вместе с вами: больше клиентов и сотрудников — без хаоса.' },
  { icon: Target, title: 'Качество решений', text: 'Опираясь на данные из CRM, проще принимать управленческие решения.' },
];

const START_QUESTIONS = [
  'Сколько у вас сотрудников, которые работают с клиентами?',
  'Откуда приходят заявки: сайт, WhatsApp, почта, звонки?',
  'Нужен ли WhatsApp внутри CRM?',
  'Есть ли сделки и воронка, которые нужно видеть по этапам?',
  'Нужно ли контролировать менеджеров и нагрузку?',
  'Нужна ли аналитика по заявкам и продажам?',
  'Будет ли система расти вместе с бизнесом?',
  'Нужен ли доступ по ролям (руководитель / менеджер / сотрудник)?',
];

const CRITERIA = [
  { icon: LayoutDashboard, title: 'Удобство интерфейса', text: 'Система не должна усложнять жизнь. Быстрый старт и понятная навигация.' },
  { icon: Users, title: 'Работа с клиентами', text: 'Единая база, карточка клиента, история общения и ответственный менеджер.' },
  { icon: Inbox, title: 'Заявки и лиды', text: 'Входящие из разных каналов в одном месте, без потери обращений.' },
  { icon: GitBranch, title: 'Сделки и этапы', text: 'Воронка, этапы, статусы — видно, на каком этапе каждый клиент.' },
  { icon: MessageSquare, title: 'WhatsApp и коммуникации', text: 'Переписка в карточке клиента, не разбросана по личным чатам.' },
  { icon: BarChart3, title: 'Аналитика', text: 'Отчёты по заявкам, сделкам, конверсии, нагрузке на менеджеров.' },
  { icon: Shield, title: 'Роли и права', text: 'Разграничение доступа: кто что видит и может менять.' },
  { icon: UserCheck, title: 'Командная работа', text: 'Несколько пользователей, назначение ответственных, передача клиента без потери контекста.' },
  { icon: Zap, title: 'Скорость внедрения', text: 'Можно начать работать без долгой настройки и обучения.' },
  { icon: FileText, title: 'Гибкость под бизнес', text: 'Система подстраивается под ваш процесс, а не наоборот.' },
  { icon: TrendingUp, title: 'Масштабируемость', text: 'Рост числа клиентов и сотрудников не ломает работу.' },
  { icon: Wallet, title: 'Цена и понятность старта', text: 'Прозрачные тарифы, возможность попробовать без обязательств.' },
];

const MISTAKES = [
  'Выбирают слишком сложную систему «на вырост»',
  'Смотрят только на цену, не на удобство и функционал',
  'Не думают о команде: смогут ли менеджеры комфортно работать',
  'Не учитывают каналы коммуникации (WhatsApp, почта, сайт)',
  'Не проверяют удобство работы перед внедрением',
  'Не думают о росте бизнеса и масштабировании',
  'Берут CRM, которая не подходит под реальный процесс компании',
];

const FIT_CRITERIA = [
  'Легко начать — без долгой настройки',
  'Видно клиентов и сделки в одном месте',
  'Можно работать командой без потери контекста',
  'Удобно отвечать клиентам (в т.ч. через WhatsApp в CRM)',
  'Есть понятная аналитика для руководителя',
  'Руководитель видит процесс и цифры',
  'Система упрощает жизнь, а не усложняет',
];

const WHAT_2WIX_COVERS = [
  { icon: Users, title: 'Клиенты в одной базе', text: 'Единая база клиентов, карточка с историей, перепиской и сделками.' },
  { icon: Inbox, title: 'Заявки под контролем', text: 'Входящие из сайта, WhatsApp, почты — в одной CRM, без потери обращений.' },
  { icon: MessageSquare, title: 'WhatsApp внутри CRM', text: 'Переписка в карточке клиента, работа команды через единый интерфейс.' },
  { icon: GitBranch, title: 'Сделки и воронка', text: 'Этапы, статусы, видно движение по воронке и зависшие лиды.' },
  { icon: BarChart3, title: 'Аналитика продаж', text: 'Заявки, сделки, конверсия, отчёты по отделу и менеджерам.' },
  { icon: UserCheck, title: 'Контроль менеджеров', text: 'Кто что ведёт, нагрузка, непрочитанные, скорость ответа.' },
  { icon: Shield, title: 'Роли и права', text: 'Разграничение доступа по разделам под задачи бизнеса.' },
  { icon: Zap, title: 'Понятный старт', text: 'Быстрая регистрация, добавление сотрудников, начало работы с клиентами и заявками.' },
];

const BUSINESS_TYPES = [
  { label: 'Малый бизнес', icon: Store, criteria: 'Простота, быстрый старт, клиенты и заявки в одном месте.' },
  { label: 'Отдел продаж', icon: Users, criteria: 'Воронка, контроль менеджеров, аналитика, командная работа.' },
  { label: 'Бизнес с WhatsApp-заявками', icon: MessageSquare, criteria: 'Переписка в CRM, привязка к клиенту и сделке, распределение чатов.' },
  { label: 'Строительная компания', icon: Building2, criteria: 'Заявки, клиенты, сделки, история, контроль отдела.' },
  { label: 'Производство', icon: Factory, criteria: 'Заявки, клиенты, коммуникации, этапы сделок, аналитика.' },
  { label: 'Услуги', icon: Wrench, criteria: 'Много касаний с клиентом, история, этапы, качество обработки.' },
];

const PREVIEW_MODULES = [
  { icon: Users, label: 'Клиенты' },
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: Shield, label: 'Роли' },
];

const FAQ_ITEMS = [
  {
    q: 'Как выбрать CRM для малого бизнеса?',
    a: 'Смотрите на простоту старта: единая база клиентов, заявки в одном месте, возможность работать с WhatsApp. Важны понятный интерфейс, быстрая регистрация и адекватная цена. 2wix подходит для малого бизнеса: можно начать без сложного внедрения и масштабировать по мере роста.',
  },
  {
    q: 'Что важнее всего при выборе CRM?',
    a: 'Соответствие вашим процессам: работа с клиентами, заявки, каналы коммуникации (в т.ч. WhatsApp), сделки по этапам, контроль команды и аналитика. Удобство для тех, кто будет работать в системе каждый день, и возможность быстро начать без долгой настройки.',
  },
  {
    q: 'Нужен ли WhatsApp в CRM?',
    a: 'Если заявки и общение с клиентами идут через WhatsApp — да. Иначе переписка остаётся в личных чатах, теряется контекст, руководитель не видит картину. CRM с интеграцией WhatsApp хранит переписку в карточке клиента и связывает её со сделкой.',
  },
  {
    q: 'Подходит ли CRM для команды из нескольких менеджеров?',
    a: 'Да. Хорошая CRM как раз для команд: общая база клиентов, назначение ответственного, передача клиента без потери истории, роли и права, аналитика по менеджерам. При выборе проверяйте, как система поддерживает командную работу.',
  },
  {
    q: 'Можно ли выбрать CRM без сложного внедрения?',
    a: 'Да. Современные облачные CRM позволяют зарегистрироваться и начать вести клиентов и заявки без проектов внедрения. В 2wix можно быстро создать компанию, добавить сотрудников и начать работу — без длительной настройки.',
  },
  {
    q: 'Подходит ли 2wix для разных типов бизнеса?',
    a: 'Да. 2wix — универсальная CRM для бизнеса: малый бизнес, отдел продаж, компании с заявками из WhatsApp, строительство, производство, сфера услуг. Критерии выбора CRM у них похожи: клиенты, заявки, команда, контроль, аналитика — всё это есть в 2wix.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const KakVybratCrmPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/kak-vybrat-crm">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Как выбрать CRM-систему и не ошибиться
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Разбираем, на что смотреть при выборе CRM: клиенты, заявки, WhatsApp, сделки, команда, аналитика, удобство внедрения и масштабирование.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  to="/vozmozhnosti"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
                >
                  Посмотреть возможности
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder hover:bg-sf-backgroundSection transition-all"
                >
                  Попробовать 2wix
                </button>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <PublicProductPreview modules={PREVIEW_MODULES} className="max-w-sm w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Почему выбор CRM — это важно */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему выбор CRM — это важно
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            CRM влияет на то, как вы работаете с клиентами, контролируете заявки и принимаете решения. Выбор CRM для бизнеса — не формальность.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_CHOICE_MATTERS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6"
              >
                <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* С каких вопросов начать выбор CRM */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            С каких вопросов начать выбор CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Перед тем как подобрать CRM, ответьте на несколько вопросов — так проще понять, какую CRM выбрать и на что смотреть в первую очередь.
          </p>
          <ul className="space-y-3">
            {START_QUESTIONS.map((q) => (
              <li key={q} className="flex items-start gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-4">
                <HelpCircle className="w-5 h-5 text-sf-accent flex-shrink-0 mt-0.5" />
                <span className="text-sf-text-primary">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* На что смотреть при выборе CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            На что смотреть при выборе CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Ключевые критерии выбора CRM-системы: от удобства интерфейса до цены и масштабируемости.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CRITERIA.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Какие ошибки допускают при выборе CRM */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Какие ошибки допускают при выборе CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Частые промахи при выборе CRM-системы — и как их избежать.
          </p>
          <ul className="space-y-3">
            {MISTAKES.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <span className="text-sf-text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Как понять, что CRM подходит именно вам */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Как понять, что CRM подходит именно вам
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Практичные признаки того, что вы выбрали систему под свои задачи.
          </p>
          <ul className="space-y-3">
            {FIT_CRITERIA.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-5 py-3">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* На примере 2wix */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            На примере 2wix
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Как эти критерии выбора CRM закрывает современная система для бизнеса: клиенты, заявки, WhatsApp, сделки, аналитика, команда.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHAT_2WIX_COVERS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
          </div>
        </div>
      </section>

      {/* Как выбирают CRM разные типы бизнеса */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как выбирают CRM разные типы бизнеса
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-10">
            У малого бизнеса, отдела продаж, строительства, производства и сферы услуг критерии выбора CRM во многом совпадают: клиенты, заявки, команда, контроль, аналитика.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUSINESS_TYPES.map(({ label, icon: Icon, criteria }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sf-text-primary">{label}</h3>
                </div>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{criteria}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это выглядит в CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Клиенты, WhatsApp, сделки, аналитика и роли — в одной системе. Можно попробовать бесплатно.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {PREVIEW_MODULES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-sf-borderLight to-sf-backgroundSection flex items-center justify-center p-6">
                  <div className="w-14 h-14 rounded-sfCard bg-sf-surface border border-sf-border shadow flex items-center justify-center text-sf-text-muted">
                    <Icon className="w-7 h-7" />
                  </div>
                </div>
                <div className="p-4 border-t border-sf-borderLight">
                  <p className="font-medium text-sf-text-primary text-center text-sm">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Теперь вы знаете, как выбирать CRM. Посмотрите, как это может выглядеть в 2wix
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Универсальная CRM для бизнеса, продаж и WhatsApp. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
            <Link
              to="/vozmozhnosti"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-primary bg-sf-surface hover:bg-sf-borderLight shadow-xl transition-all"
            >
              Посмотреть возможности
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-white/90 hover:text-white border-2 border-white/40 hover:border-white/60 transition-all"
            >
              Попробовать 2wix
            </button>
            <Link
              to="/ceny"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse border-2 border-white/40 hover:border-white/60 transition-all"
            >
              Посмотреть цены
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Вопросы о выборе CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы: как выбрать CRM, на что смотреть, подходит ли 2wix.
          </p>
          <ul className="space-y-6">
            {FAQ_ITEMS.map(({ q, a }) => (
              <li key={q} className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6">
                <h3 className="font-semibold text-sf-text-primary mb-2">{q}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{a}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <Link to="/faq" className="text-sf-accent font-medium hover:text-sf-primary">
              Все вопросы и ответы →
            </Link>
          </div>
        </div>
      </section>

      {/* Перелинковка */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sf-text-primary text-center mb-10">
            Полезные разделы
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className={LINK_BTN_CLASS}>Главная</Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/crm-ili-excel" className={LINK_BTN_CLASS}>CRM или Excel</Link>
            <Link to="/chto-takoe-crm" className={LINK_BTN_CLASS}>Что такое CRM</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>Сделки и воронка</Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>Аналитика продаж</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
