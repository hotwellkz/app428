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
  FileSpreadsheet,
  LayoutDashboard,
  FileText,
  StickyNote,
  Shield,
  Eye,
  Building2,
  Store,
  Wrench,
  Factory,
  ListChecks,
} from 'lucide-react';

const TITLE =
  'Что такое CRM простыми словами — для чего нужна, как работает | 2wix';
const DESCRIPTION =
  'Что такое CRM-система и зачем она нужна бизнесу: простыми словами о клиентах, заявках, сделках и переписке в одной системе. Как работает CRM и когда пора внедрять. Современная CRM для бизнеса — 2wix.';

const WHAT_CRM_ITEMS = [
  { label: 'Клиентов', icon: Users },
  { label: 'Заявки', icon: Inbox },
  { label: 'Сделки', icon: GitBranch },
  { label: 'Переписку', icon: MessageSquare },
  { label: 'Менеджеров и ответственных', icon: UserCheck },
  { label: 'Историю работы с клиентом', icon: FileText },
  { label: 'Аналитику и отчёты', icon: BarChart3 },
];

const WHY_CRM_ITEMS = [
  'Клиенты не теряются — все в одной базе',
  'История общения сохраняется в карточке клиента',
  'Заявки не живут в хаосе чатов и таблиц',
  'Видно, кто за что отвечает',
  'Сделки ведутся по этапам — видна воронка',
  'Руководитель видит цифры и картину по отделу',
  'Команда работает в одной системе',
];

const WITHOUT_CRM_ITEMS = [
  'Таблицы в разных файлах',
  'Личные WhatsApp у каждого менеджера',
  'Заметки в разных местах',
  'Переписка разбросана по чатам и почте',
  'Хаос и потеря контекста',
  'Потеря клиентов и обращений',
  'Трудно контролировать менеджеров',
  'Сложно передавать клиентов внутри команды',
];

const WITH_CRM_ITEMS = [
  { text: 'Единая база клиентов', icon: Users },
  { text: 'Карточки клиентов с историей', icon: FileText },
  { text: 'Сделки и этапы воронки', icon: GitBranch },
  { text: 'Менеджеры и роли', icon: UserCheck },
  { text: 'WhatsApp в одном окне с клиентом', icon: MessageSquare },
  { text: 'Аналитика и отчёты', icon: BarChart3 },
  { text: 'Прозрачность для руководителя', icon: Eye },
];

const WHO_NEEDS_CRM = [
  { label: 'Малому бизнесу', icon: Store },
  { label: 'Отделу продаж', icon: Users },
  { label: 'Компаниям с несколькими менеджерами', icon: UserCheck },
  { label: 'Бизнесу с заявками из WhatsApp', icon: MessageSquare },
  { label: 'Строительным компаниям', icon: Building2 },
  { label: 'Производству', icon: Factory },
  { label: 'Сфере услуг', icon: Wrench },
  { label: 'Всем, у кого есть клиенты и продажи', icon: LayoutDashboard },
];

const WHEN_TO_IMPLEMENT = [
  'Клиентов становится больше',
  'Заявки приходят из нескольких каналов',
  'Есть хотя бы 2 менеджера',
  'Теряется история общения',
  'Сделки сложно контролировать',
  'Руководитель не видит полной картины',
  'Excel и чаты уже не справляются',
];

const WHAT_2WIX_CAN = [
  { icon: Users, title: 'Вести клиентов', text: 'Единая база, карточка клиента, история и ответственный.' },
  { icon: MessageSquare, title: 'Работать с WhatsApp', text: 'Переписка в CRM, привязка к клиенту и сделке.' },
  { icon: Inbox, title: 'Управлять заявками', text: 'Входящие из разных каналов в одном месте.' },
  { icon: GitBranch, title: 'Вести сделки', text: 'Воронка, этапы, статусы — всё на виду.' },
  { icon: UserCheck, title: 'Контролировать менеджеров', text: 'Кто что ведёт, нагрузка, непрочитанные.' },
  { icon: Shield, title: 'Разграничивать роли', text: 'Права доступа по разделам под задачи бизнеса.' },
  { icon: BarChart3, title: 'Показывать аналитику', text: 'Заявки, сделки, конверсия, отчёты по отделу.' },
  { icon: LayoutDashboard, title: 'Собирать всё в одной системе', text: 'Клиенты, заявки, переписка, сделки — одна CRM.' },
];

const PREVIEW_MODULES = [
  { icon: FileText, label: 'Карточка клиента' },
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: BarChart3, label: 'Аналитика' },
];

const FAQ_ITEMS = [
  {
    q: 'Что такое CRM простыми словами?',
    a: 'CRM — это система, в которой компания ведёт клиентов, заявки, сделки, переписку и историю работы в одном месте. Вместо разрозненных таблиц и чатов — одна база, карточки клиентов, этапы сделок и прозрачность для руководителя. Простыми словами: CRM помогает не терять клиентов и понимать, что происходит в продажах.',
  },
  {
    q: 'Зачем нужна CRM бизнесу?',
    a: 'CRM нужна, чтобы клиенты не терялись, история общения сохранялась, заявки не жили в хаосе, было видно, кто за что отвечает, а руководитель видел реальную картину по отделу. Когда менеджеров и каналов обращений несколько — без CRM сложно масштабироваться и контролировать процессы.',
  },
  {
    q: 'Чем CRM отличается от Excel?',
    a: 'Excel — отличный стартовый инструмент для учёта. CRM — система для роста: единая база клиентов, привязка переписки и сделок, роли, аналитика, работа команды в одном месте. Когда заявок и клиентов много, а менеджеров несколько — таблиц уже мало, нужна CRM. Подробнее — в разделе «CRM или Excel».',
  },
  {
    q: 'Подходит ли CRM для малого бизнеса?',
    a: 'Да. CRM полезна уже с небольшим числом клиентов и заявок: всё в одном месте, ничего не теряется. Многие решения, в том числе 2wix, предлагают доступные тарифы и бесплатный старт — малый бизнес может начать без больших затрат.',
  },
  {
    q: 'Можно ли вести клиентов, сделки и переписку в одной системе?',
    a: 'Да. Современная CRM как раз для этого: карточка клиента, к которой привязаны переписка (в том числе WhatsApp), сделки, комментарии и история. Всё в одном окне — не нужно искать по чатам и таблицам.',
  },
  {
    q: 'Сложно ли внедрить CRM?',
    a: 'Зависит от системы. В 2wix можно начать быстро: зарегистрироваться, добавить сотрудников, вести клиентов и заявки. Без сложной настройки — интерфейс понятный, интеграция с WhatsApp есть. Постепенно подключают сделки, этапы и аналитику.',
  },
  {
    q: 'Подходит ли 2wix для разных типов бизнеса?',
    a: 'Да. 2wix — универсальная CRM для бизнеса: подходит и малому бизнесу, и отделу продаж, и компаниям с заявками из WhatsApp. Используют в строительстве, производстве, сфере услуг, продажах — везде, где важны клиенты, заявки, сделки и контроль процессов.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const ChtoTakoeCrmPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/chto-takoe-crm">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                CRM-система: что это такое и зачем она нужна бизнесу
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Разбираем простыми словами, что такое CRM, как она помогает бизнесу работать с клиентами, продажами, заявками, WhatsApp и командой.
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

      {/* Что такое CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Что такое CRM простыми словами
          </h2>
          <p className="text-lg text-sf-text-secondary mb-8 leading-relaxed">
            <strong className="text-sf-text-primary">CRM</strong> — это система, в которой компания ведёт клиентов, заявки, сделки, переписку, менеджеров, историю работы и аналитику. Не энциклопедия и не просто база контактов — а живой рабочий инструмент: кто с кем общался, на каком этапе сделка, кто отвечает за клиента. Всё в одном месте, без хаоса таблиц и разрозненных чатов.
          </p>
          <p className="text-sf-text-secondary mb-8 leading-relaxed">
            В CRM-системе обычно есть: единый список клиентов, карточка на каждого клиента (контакты, переписка, сделки, заметки), воронка сделок по этапам, назначение ответственных, переписка (в том числе WhatsApp) в одном окне, отчёты для руководителя. То есть — как работает CRM — это когда вся работа с клиентами и продажами идёт внутри одной системы.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {WHAT_CRM_ITEMS.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sf-text-primary text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Зачем нужна CRM */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Зачем нужна CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Для чего нужна CRM бизнесу: она решает типичные боли — потерю клиентов, разбросанную переписку, неясность, кто за что отвечает, отсутствие картины у руководителя. Ниже — что даёт внедрение CRM.
          </p>
          <ul className="space-y-3">
            {WHY_CRM_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-3">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Как работают без CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Как работают без CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Типичный сценарий до CRM: таблицы у каждого свои, переписка в личных WhatsApp, заметки где попало. Обращения теряются, клиентов сложно передать коллеге без потери контекста, руководитель не видит реальной картины. Это и есть боль, которую снимает CRM.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {WITHOUT_CRM_ITEMS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-5 py-3"
              >
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <span className="text-sf-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как работают с CRM */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Как работают с CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 max-w-2xl">
            С CRM всё собирается в одной системе: база клиентов, карточки, этапы сделок, переписка, роли и аналитика. Руководитель видит процессы, менеджеры не теряют контекст.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WITH_CRM_ITEMS.map(({ text, icon: Icon }) => (
              <div
                key={text}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-5 flex items-center gap-4 shadow-sm"
              >
                <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="font-medium text-sf-text-primary">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Кому нужна CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Кому нужна CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            CRM особенно полезна там, где есть клиенты, заявки, несколько менеджеров и потребность в порядке и контроле.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {WHO_NEEDS_CRM.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-5 text-center"
              >
                <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-sf-text-primary">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Когда пора внедрять CRM */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Когда пора внедрять CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Чек-лист признаков: если совпадает несколько пунктов — пора смотреть в сторону CRM.
          </p>
          <ul className="space-y-3">
            {WHEN_TO_IMPLEMENT.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-3">
                <ListChecks className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Что может CRM на примере 2wix */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что может CRM на примере 2wix
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Современная CRM умеет вести клиентов, заявки, переписку и сделки в одной системе. На примере 2wix — что это даёт бизнесу.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHAT_2WIX_CAN.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6"
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
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
          </div>
        </div>
      </section>

      {/* CRM или Excel */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            CRM или Excel
          </h2>
          <p className="text-lg text-sf-text-secondary text-center mb-10 leading-relaxed">
            Excel — отличный стартовый инструмент. CRM — система для роста: когда команда и процессы усложняются, таблиц уже мало. Единая база, переписка в карточке клиента, этапы сделок, роли и аналитика — это про CRM.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileSpreadsheet className="w-6 h-6 text-amber-500" />
                <h3 className="font-semibold text-sf-text-primary">Excel</h3>
              </div>
              <p className="text-sf-text-secondary text-sm leading-relaxed">
                Стартовый инструмент для учёта. Удобен, пока данных и людей немного. Когда каналов и менеджеров несколько — сложно держать всё в актуальном виде и видеть общую картину.
              </p>
            </div>
            <div className="rounded-sfCard border border-sf-cardBorder bg-sf-primaryLight/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <LayoutDashboard className="w-6 h-6 text-sf-accent" />
                <h3 className="font-semibold text-sf-text-primary">CRM</h3>
              </div>
              <p className="text-sf-text-secondary text-sm leading-relaxed">
                Система для роста: клиенты, заявки, переписка, сделки, роли и аналитика в одном месте. Команда работает в одной системе, руководитель видит процессы.
              </p>
            </div>
          </div>
          <p className="mt-6 text-center">
            <Link to="/crm-ili-excel" className="text-sf-accent font-medium hover:underline">
              Подробнее: CRM или Excel →
            </Link>
          </p>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это выглядит в CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Карточка клиента, WhatsApp, сделки по этапам, аналитика и командная работа — в одной системе.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PREVIEW_MODULES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-sf-borderLight to-sf-backgroundSection flex items-center justify-center p-6">
                  <div className="w-16 h-16 rounded-sfCard bg-sf-surface border border-sf-border shadow flex items-center justify-center text-sf-text-muted">
                    <Icon className="w-8 h-8" />
                  </div>
                </div>
                <div className="p-4 border-t border-sf-borderLight">
                  <p className="font-medium text-sf-text-primary text-center">{label}</p>
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
            Теперь вы знаете, что такое CRM. Посмотрите, как это может работать в 2wix
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Универсальная CRM для бизнеса, продаж, WhatsApp и командной работы. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и старт — на странице цен.
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
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Вопросы о CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы: что такое CRM, зачем нужна, как работает.
          </p>
          <ul className="space-y-6">
            {FAQ_ITEMS.map(({ q, a }) => (
              <li key={q} className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
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
      <section className="py-16 md:py-24 bg-white">
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
