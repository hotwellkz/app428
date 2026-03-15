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
  Shield,
  Eye,
  Building2,
  Store,
  Wrench,
  Factory,
  ListChecks,
} from 'lucide-react';

const TITLE =
  'Зачем нужна CRM бизнесу — для чего, какие задачи решает, кому полезна | 2wix';
const DESCRIPTION =
  'Зачем нужна CRM бизнесу: простыми словами и на практике. Какие задачи решает CRM-система, какие проблемы бывают без неё, кому CRM нужна в первую очередь. Что даёт CRM малому бизнесу и отделу продаж. 2wix — универсальная CRM для бизнеса.';

const WITHOUT_CRM_PAIN = [
  'Теряются клиенты и обращения',
  'История общения не сохраняется в одном месте',
  'Сложно понять, кто из менеджеров что делает',
  'Заявки ведутся хаотично',
  'Сделки не контролируются',
  'Руководитель не видит реальную картину',
  'Аналитика слабая или отсутствует',
  'Клиентский контекст теряется при передаче',
];

const WHAT_CRM_GIVES = [
  { icon: Users, title: 'Единая база клиентов', text: 'Все клиенты в одной системе, карточка с историей и ответственным.' },
  { icon: Inbox, title: 'Учёт заявок', text: 'Входящие из разных каналов в одном месте, без потери обращений.' },
  { icon: GitBranch, title: 'Сделки и этапы', text: 'Воронка, статусы, видно движение и зависшие лиды.' },
  { icon: FileText, title: 'История общения', text: 'Переписка, комментарии и договорённости в карточке клиента.' },
  { icon: MessageSquare, title: 'WhatsApp и коммуникации', text: 'Переписка в CRM, привязка к клиенту и сделке.' },
  { icon: UserCheck, title: 'Менеджеры и роли', text: 'Кто за что отвечает, назначение ответственного, разграничение прав.' },
  { icon: Eye, title: 'Контроль работы команды', text: 'Руководитель видит нагрузку, непрочитанные, скорость ответа.' },
  { icon: BarChart3, title: 'Аналитика и прозрачность', text: 'Заявки, сделки, конверсия, отчёты по отделу.' },
  { icon: LayoutDashboard, title: 'Меньше хаоса и рутины', text: 'Один инструмент вместо разрозненных таблиц и чатов.' },
];

const WHO_NEEDS_CRM = [
  { label: 'Малому бизнесу', icon: Store },
  { label: 'Отделу продаж', icon: Users },
  { label: 'Компаниям с несколькими менеджерами', icon: UserCheck },
  { label: 'Бизнесу с WhatsApp-заявками', icon: MessageSquare },
  { label: 'Строительным компаниям', icon: Building2 },
  { label: 'Производству', icon: Factory },
  { label: 'Сфере услуг', icon: Wrench },
  { label: 'Всем, у кого есть клиенты и обращения', icon: LayoutDashboard },
];

const DAILY_TASKS = [
  'Принять заявку',
  'Найти клиента',
  'Посмотреть историю',
  'Назначить ответственного',
  'Передать клиента менеджеру',
  'Вести сделку по этапам',
  'Контролировать ответ клиенту',
  'Посмотреть аналитику',
];

const WHEN_ITS_TIME = [
  'У вас больше 1 менеджера',
  'Клиенты пишут из разных каналов',
  'Заявки теряются',
  'Приходится искать историю по чатам',
  'Сделки сложно контролировать',
  'Руководитель не видит полной картины',
  'Таблицы уже не справляются',
  'Нужен порядок в работе с клиентами',
];

const WHAT_2WIX_COVERS = [
  { icon: Users, title: 'Клиенты в одной базе', text: 'Единая база, карточка клиента с историей и перепиской.' },
  { icon: MessageSquare, title: 'WhatsApp внутри CRM', text: 'Переписка в карточке, работа команды в одном интерфейсе.' },
  { icon: Inbox, title: 'Заявки под контролем', text: 'Входящие из сайта, WhatsApp, почты — без потери.' },
  { icon: GitBranch, title: 'Сделки и воронка', text: 'Этапы, статусы, видно движение по воронке.' },
  { icon: UserCheck, title: 'Менеджеры и роли', text: 'Назначение ответственного, роли и права доступа.' },
  { icon: BarChart3, title: 'Аналитика продаж', text: 'Заявки, сделки, конверсия, отчёты по отделу.' },
  { icon: LayoutDashboard, title: 'Единая система для команды', text: 'Всё в одной CRM — клиенты, заявки, переписка, сделки.' },
];

const COMPARISON_WITHOUT = [
  'Чаты у каждого свои',
  'Таблицы в разных файлах',
  'Потеря клиентов',
  'Хаос и потеря контекста',
  'Слабый контроль',
];

const COMPARISON_WITH = [
  'Структура и порядок',
  'Прозрачность для руководителя',
  'История в карточке клиента',
  'Контроль менеджеров и этапов',
  'Аналитика и отчёты',
  'Рост без хаоса',
];

const PREVIEW_MODULES = [
  { icon: FileText, label: 'Карточка клиента' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: BarChart3, label: 'Аналитика' },
];

const FAQ_ITEMS = [
  {
    q: 'Зачем нужна CRM бизнесу?',
    a: 'CRM нужна, чтобы не терять клиентов и обращения, хранить историю общения в одном месте, видеть, кто за что отвечает, контролировать заявки и сделки, а руководителю — видеть реальную картину по отделу. Для чего нужна CRM-система: структура вместо хаоса таблиц и чатов.',
  },
  {
    q: 'Для чего нужна CRM малому бизнесу?',
    a: 'Малому бизнесу CRM даёт то же, что и крупному: единую базу клиентов, учёт заявок, историю общения, этапы сделок. Уже с небольшим числом клиентов и заявок проще вести всё в одной системе. Нужна ли CRM малому бизнесу — да, если хочется порядка и роста без хаоса.',
  },
  {
    q: 'Какие задачи решает CRM?',
    a: 'CRM решает задачи учёта клиентов, приёма и распределения заявок, ведения сделок по этапам, хранения переписки и истории, назначения ответственных, контроля менеджеров и аналитики. Что даёт CRM бизнесу — прозрачность, порядок и возможность масштабировать продажи.',
  },
  {
    q: 'Можно ли обойтись без CRM?',
    a: 'Пока клиентов и менеджеров мало — можно работать в таблицах и чатах. Когда каналов и людей становится больше, заявки и контекст начинают теряться. CRM как раз для того момента, когда «по памяти» и разрозненным инструментам уже не справиться.',
  },
  {
    q: 'Когда пора внедрять CRM?',
    a: 'Когда заявки приходят из нескольких каналов, есть хотя бы два человека, работающих с клиентами, теряется история общения, сделки сложно контролировать, а руководитель не видит полной картины. Чек-лист признаков — на этой странице выше.',
  },
  {
    q: 'Чем CRM лучше таблиц и мессенджеров?',
    a: 'В таблицах нет привязки переписки к клиенту и этапов сделки. В мессенджерах всё размазано по чатам, нет единой базы и аналитики. CRM объединяет клиентов, заявки, переписку, сделки и отчёты в одной системе. Подробнее — в разделе «CRM или Excel».',
  },
  {
    q: 'Подходит ли 2wix для разных типов бизнеса?',
    a: 'Да. 2wix — универсальная CRM для бизнеса: подходит малому бизнесу, отделу продаж, компаниям с заявками из WhatsApp. Используют в строительстве, производстве, сфере услуг. Зачем нужна CRM — решать эти задачи; 2wix закрывает их в одной системе.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const ZachemNuzhnaCrmPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/zachem-nuzhna-crm">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Для чего нужна CRM: простыми словами и на практике
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Разбираем, какие задачи CRM решает в бизнесе: клиенты, заявки, сделки, WhatsApp, менеджеры, аналитика и контроль процессов.
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

      {/* Почему вообще возникает вопрос зачем нужна CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Почему вообще возникает вопрос «зачем нужна CRM»
          </h2>
          <p className="text-lg text-sf-text-secondary mb-6 leading-relaxed">
            Пока бизнес маленький, кажется, что можно обойтись таблицами, мессенджерами, заметками и «памятью». Заявки приходят — менеджер отвечает в чате, клиент записан в Excel. Всё как-то работает.
          </p>
          <p className="text-sf-text-secondary mb-8 leading-relaxed">
            Но когда клиентов, заявок и сотрудников становится больше, каналов обращений несколько, а менеджеров уже два или три — начинается хаос. Кто что ответил, на каком этапе клиент, почему заявка пропала — непонятно. Вот тогда и возникает вопрос: зачем нужна CRM и что она даёт бизнесу на практике.
          </p>
          <div className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6">
            <p className="text-sf-text-secondary text-sm leading-relaxed">
              <strong className="text-sf-text-primary">Коротко:</strong> CRM нужна, когда одного «памятью», чатами и таблицами уже не хватает — нужна единая система, где есть клиенты, заявки, история, сделки и прозрачность для руководителя.
            </p>
          </div>
        </div>
      </section>

      {/* Какие проблемы без CRM появляются у бизнеса */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Какие проблемы без CRM появляются у бизнеса
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Реальные боли, с которыми сталкиваются компании без единой системы работы с клиентами.
          </p>
          <ul className="space-y-3">
            {WITHOUT_CRM_PAIN.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <span className="text-sf-text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Что именно даёт CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что именно даёт CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Пользу CRM на языке бизнеса: что даёт CRM-система на практике.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_CRM_GIVES.map(({ icon: Icon, title, text }) => (
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

      {/* Кому CRM нужна в первую очередь */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Кому CRM нужна в первую очередь
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Зачем нужна CRM разным типам бизнеса: кому CRM особенно полезна.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {WHO_NEEDS_CRM.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-5 text-center"
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

      {/* Какие задачи CRM решает каждый день */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Какие задачи CRM решает каждый день
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Ежедневные дела, с которыми CRM помогает: от приёма заявки до аналитики.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {DAILY_TASKS.map((task) => (
              <div
                key={task}
                className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-5 py-3"
              >
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="text-sf-text-primary">{task}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Когда уже точно пора внедрять CRM */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Когда уже точно пора внедрять CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-10 leading-relaxed">
            Чек-лист признаков: если совпадает несколько пунктов — пора смотреть в сторону CRM.
          </p>
          <ul className="space-y-3">
            {WHEN_ITS_TIME.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-3">
                <ListChecks className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* На примере 2wix */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            На примере 2wix
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Как эти задачи закрывает современная CRM для бизнеса: клиенты, заявки, WhatsApp, сделки, аналитика.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_2WIX_COVERS.map(({ icon: Icon, title, text }) => (
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
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
          </div>
        </div>
      </section>

      {/* CRM или работа по-старому */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            CRM или работа по-старому
          </h2>
          <p className="text-sf-text-secondary text-center mb-10">
            Коротко: что меняется с внедрением CRM.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Без CRM
              </h3>
              <ul className="space-y-2">
                {COMPARISON_WITHOUT.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sf-text-secondary text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-sfCard border border-sf-cardBorder bg-sf-primaryLight/30 p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-sf-accent" />
                С CRM
              </h3>
              <ul className="space-y-2">
                {COMPARISON_WITH.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sf-text-secondary text-sm">
                    <Check className="w-4 h-4 text-sf-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
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
            Карточка клиента, сделки, WhatsApp, аналитика и командная работа — в одной системе.
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
            Теперь понятно, зачем нужна CRM. Посмотрите, как это может работать в 2wix
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
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Вопросы о том, зачем нужна CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы: для чего нужна CRM, кому полезна, какие задачи решает.
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
            <Link to="/chto-takoe-crm" className={LINK_BTN_CLASS}>Что такое CRM</Link>
            <Link to="/kak-vybrat-crm" className={LINK_BTN_CLASS}>Как выбрать CRM</Link>
            <Link to="/crm-ili-excel" className={LINK_BTN_CLASS}>CRM или Excel</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
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
