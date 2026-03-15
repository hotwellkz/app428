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
  LayoutDashboard,
  FileSpreadsheet,
  StickyNote,
  Shield,
  FileText,
  Eye,
  MessageCircle,
} from 'lucide-react';

const TITLE =
  'CRM для сферы услуг — заявки, клиенты, переписка и контроль отдела продаж | 2wix';
const DESCRIPTION =
  'CRM для компаний из сферы услуг 2wix: заявки, клиентская база, переписка, сделки по этапам, контроль менеджеров и аналитика в одной системе. Универсальная CRM, которая хорошо подходит для сервисного бизнеса.';

const PROBLEMS = [
  {
    title: 'Заявки приходят из разных каналов',
    text: 'Обращения в WhatsApp, на сайте, по почте, по телефону — размазаны по менеджерам. CRM для заявок в сфере услуг собирает всё в одном месте.',
  },
  {
    title: 'Обращения теряются',
    text: 'Часть заявок остаётся в личных чатах, часть не доходит до учёта. Нет единой системы для компании услуг — трудно контролировать поток.',
  },
  {
    title: 'Менеджеры ведут клиентов не по единому процессу',
    text: 'Каждый по-своему: кто в таблице, кто в чатах. Нет единого подхода — руководитель не видит полную картину по отделу.',
  },
  {
    title: 'Переписка и договорённости разбросаны',
    text: 'Часть в мессенджерах, часть в почте, часть в заметках. Нет карточки клиента с полной историей. CRM для клиентского сервиса решает это.',
  },
  {
    title: 'Сложно понять, на каком этапе клиент',
    text: 'Неясно, кто на стадии запроса, кто в консультации, кто готов к заказу. Нет воронки и этапов — руководитель не видит картину по продажам услуг.',
  },
  {
    title: 'Руководитель не видит полную картину по отделу',
    text: 'Сколько заявок пришло, сколько клиентов в работе, кто из менеджеров что ведёт — на словах. Нет прозрачности по отделу продаж услуг.',
  },
  {
    title: 'История работы с клиентом теряется при передаче',
    text: 'Клиента передали другому менеджеру — переписка и договорённости остались у прежнего. CRM для клиентов в сервисном бизнесе хранит всю историю в карточке.',
  },
  {
    title: 'Сложно системно вести продажи услуг',
    text: 'Консультации, заявки, повторные обращения — без единой системы контекст и этапы теряются. Программа для компании услуг с воронкой решает это.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: Inbox,
    title: 'Учёт входящих заявок',
    text: 'Заявки из WhatsApp, сайта, почты, звонков — в одной CRM. CRM для заявок в сфере услуг без потери обращений.',
  },
  {
    icon: Users,
    title: 'Клиентская база',
    text: 'Единая база клиентов сервисной компании. Контакты, история, ответственный менеджер — в одной системе.',
  },
  {
    icon: FileText,
    title: 'Карточка клиента',
    text: 'Всё по клиенту в одном месте: контакты, переписка, комментарии, сделки. Удобно для отдела продаж услуг.',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp и история общения',
    text: 'Переписка с клиентом в карточке. Менеджеры работают через единый интерфейс — заявки из мессенджера не теряются.',
  },
  {
    icon: GitBranch,
    title: 'Сделки и этапы',
    text: 'Воронка сделок: от первого контакта до заказа. Видно, на каком этапе каждый клиент. CRM для продаж услуг.',
  },
  {
    icon: UserCheck,
    title: 'Менеджеры и распределение ответственности',
    text: 'Назначение ответственного по клиенту и заявке. Контроль нагрузки. Система для сервисной компании с прозрачностью по команде.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика по обращениям и продажам',
    text: 'Сколько заявок пришло, сколько обработано, по каким каналам. Аналитика по отделу в одной CRM.',
  },
  {
    icon: StickyNote,
    title: 'Комментарии и история контактов',
    text: 'Договорённости, пожелания клиента, детали заказа — в карточке. История не теряется при смене менеджера.',
  },
  {
    icon: Shield,
    title: 'Роли и права доступа',
    text: 'Руководитель, менеджер, сотрудник — разные права. CRM для сферы услуг с разграничением доступа к разделам.',
  },
  {
    icon: Eye,
    title: 'Прозрачность для руководителя',
    text: 'Кто что ведёт, где задержки, где просадки. Контроль отдела продаж без ручного сбора отчётов.',
  },
];

const FLOW_STEPS = [
  'Клиент оставляет заявку или пишет',
  'Заявка попадает в CRM',
  'Менеджер берёт клиента в работу',
  'Ведётся переписка, консультация, согласование, этапы сделки',
  'Руководитель видит статус и аналитику',
  'Команда работает в одной системе без потери информации',
];

const WHAT_LEADER_SEES = [
  {
    icon: Inbox,
    title: 'Сколько пришло заявок',
    text: 'Входящие по каналам и по периодам. Руководитель сервисной компании видит поток обращений.',
  },
  {
    icon: Users,
    title: 'Сколько клиентов в работе',
    text: 'Сколько клиентов на каждом этапе. CRM для отдела продаж услуг с наглядной картиной.',
  },
  {
    icon: GitBranch,
    title: 'Сколько сделок на каждом этапе',
    text: 'Воронка: от первого контакта до закрытия. Где движение, где застой.',
  },
  {
    icon: UserCheck,
    title: 'Кто из менеджеров работает лучше',
    text: 'Обработанные заявки, сделки, скорость ответа. Объективная картина по команде.',
  },
  {
    icon: AlertCircle,
    title: 'Где зависли лиды',
    text: 'Какие клиенты давно без движения, где нужна помощь. Контроль без микроменеджмента.',
  },
  {
    icon: LayoutDashboard,
    title: 'Как работает отдел продаж',
    text: 'Сводная картина: заявки, клиенты, сделки, менеджеры. Программа для компании услуг с прозрачностью.',
  },
  {
    icon: BarChart3,
    title: 'Где есть просадки и узкие места',
    text: 'Где клиент ждёт ответа, где задержки. Аналитика для решений по качеству обработки обращений.',
  },
];

const LINK_CHAIN = [
  { icon: Users, label: 'Клиент' },
  { icon: MessageSquare, label: 'Переписка' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: GitBranch, label: 'Сделка' },
  { icon: StickyNote, label: 'Заметки' },
  { icon: BarChart3, label: 'Аналитика' },
];

const WHY_FOR_SERVICES = [
  {
    icon: MessageCircle,
    title: 'Много касаний с клиентом',
    text: 'Запросы, консультации, уточнения, повторные обращения. CRM для сферы услуг хранит всю переписку и историю в карточке клиента.',
  },
  {
    icon: StickyNote,
    title: 'Важно не терять договорённости',
    text: 'Что согласовали, какие условия — в комментариях и переписке. Система учёта для компании услуг сохраняет контекст.',
  },
  {
    icon: MessageSquare,
    title: 'Важно хранить историю общения',
    text: 'Вся переписка в карточке. При передаче клиента коллеге контекст не теряется. CRM для клиентского сервиса с полной историей.',
  },
  {
    icon: GitBranch,
    title: 'Важно быстро понимать, кто и на каком этапе',
    text: 'На каком этапе клиент, кто ведёт. Руководитель видит воронку и нагрузку на отдел продаж услуг.',
  },
  {
    icon: Users,
    title: 'Важно работать командой',
    text: 'Несколько менеджеров, единая база клиентов, назначение ответственного. Командная работа без потери информации.',
  },
  {
    icon: BarChart3,
    title: 'Важно видеть качество обработки обращений',
    text: 'Сколько обращений обработано, скорость ответа, где задержки. Аналитика для сервисной компании в одной CRM.',
  },
];

const PREVIEW_MODULES = [
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: FileText, label: 'Карточка' },
  { icon: Inbox, label: 'Заявки' },
  { icon: BarChart3, label: 'Аналитика' },
];

const COMPARISON_MANUAL = [
  'Чаты у каждого менеджера',
  'Таблицы в разных файлах',
  'Заметки в разных местах',
  'Потеря истории',
  'Нет прозрачности',
  'Сложно анализировать',
];

const COMPARISON_2WIX = [
  'Всё в одной CRM',
  'Клиент не теряется',
  'Видно этапы сделок',
  'Менеджеры под контролем',
  'Заявки и переписка связаны',
  'У руководителя есть аналитика',
];

const FAQ_ITEMS = [
  {
    q: 'Подходит ли 2wix для компаний из сферы услуг?',
    a: 'Да. 2wix — универсальная CRM для бизнеса, которая хорошо подходит для сервисных компаний: заявки из разных каналов, клиентская база, карточка клиента с перепиской и комментариями, сделки по этапам, контроль менеджеров и аналитика в одной системе. Многие компании из сферы услуг используют 2wix для отдела продаж и работы с клиентами.',
  },
  {
    q: 'Можно ли вести заявки и клиентов в одной системе?',
    a: 'Да. В 2wix ведётся учёт заявок и клиентов: каждому клиенту соответствует карточка с контактами, перепиской, сделками и комментариями. Сделки можно вести по этапам. CRM для сферы услуг с единой базой и воронкой.',
  },
  {
    q: 'Есть ли WhatsApp и история переписки?',
    a: 'Да. Переписка из WhatsApp попадает в CRM и привязывается к карточке клиента. Менеджеры работают в едином интерфейсе — заявки из мессенджера не теряются. CRM для заявок в сфере услуг с WhatsApp в одном окне.',
  },
  {
    q: 'Можно ли контролировать менеджеров и этапы сделок?',
    a: 'Да. Руководитель видит, кто какой клиент ведёт, сколько заявок у каждого, где непрочитанные сообщения и где сделки зависли. Этапы воронки и активность менеджеров — в одной системе. Контроль отдела продаж услуг без ручного сбора отчётов.',
  },
  {
    q: 'Подходит ли 2wix для небольших компаний услуг?',
    a: 'Да. CRM для сферы услуг полезна уже с небольшим отделом: заявки не теряются, клиенты и переписка в одном месте, этапы сделок видны. Система масштабируется при росте.',
  },
  {
    q: 'Можно ли использовать систему не только для услуг?',
    a: 'Да. 2wix — универсальная CRM: подходит для отдела продаж, работы с клиентами и заявками в разных отраслях. Сфера услуг — один из сильных кейсов: много обращений, важна история и качество обработки. Но ту же систему используют и производственные, и строительные компании, и продажи товаров.',
  },
  {
    q: 'Есть ли аналитика по обращениям и продажам?',
    a: 'Да. В 2wix есть аналитика: сколько заявок пришло и обработано, по каким каналам, как движутся сделки по этапам, нагрузка по менеджерам. Руководитель сервисной компании видит картину по отделу в одной CRM.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const CrmDlyaUslugPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/crm-dlya-uslug">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                CRM для сферы услуг: заявки, клиенты, переписка и контроль в одной системе
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает компаниям из сферы услуг собирать заявки, вести клиентов, работать с WhatsApp, контролировать менеджеров, вести сделки и видеть аналитику в одной системе.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
                >
                  Попробовать
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/vozmozhnosti"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder hover:bg-sf-backgroundSection transition-all"
                >
                  Посмотреть возможности
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <PublicProductPreview modules={PREVIEW_MODULES} className="max-w-sm w-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Какие проблемы решает CRM в сфере услуг */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Какие проблемы решает CRM в сфере услуг
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы заявки теряются, менеджеры ведут клиентов кто как хочет, а руководитель не видит картины.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {PROBLEMS.map(({ title, text }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6"
              >
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sf-text-primary mb-2">{title}</h3>
                  <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что даёт 2wix компании из сферы услуг */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix компании из сферы услуг
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Заявки, клиенты, переписка, сделки по этапам и контроль отдела — CRM для сервисного бизнеса в одной системе.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_2WIX_GIVES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm hover:shadow-md transition-shadow"
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

      {/* Как это работает в компании услуг */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это работает в компании услуг
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            От заявки до контроля — всё в одной CRM для сферы услуг.
          </p>
          <ol className="space-y-4">
            {FLOW_STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-5 shadow-sm"
              >
                <span className="flex-shrink-0 w-10 h-10 rounded-sfCard bg-sf-primary text-sf-text-inverse font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-medium text-sf-text-primary">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Что видит руководитель */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что видит руководитель
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Прозрачность для собственника и руководителя сервисной компании: заявки, клиенты, сделки, менеджеры.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_LEADER_SEES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Клиент + переписка + сделка + команда */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Клиент + переписка + сделка + команда в одной системе
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            2wix — единая CRM для сервисного бизнеса: не набор разрозненных чатов и таблиц, а одна система.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {LINK_CHAIN.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-5 flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-3">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="font-medium text-sf-text-primary text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Почему это особенно полезно для сферы услуг */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это особенно полезно для сферы услуг
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Много касаний с клиентом, договорённости и качество обработки — CRM для услуг сохраняет контекст и этапы.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_SERVICES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс: WhatsApp, карточка клиента, заявки, аналитика
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            CRM для сферы услуг с перепиской, этапами сделок, менеджерами и отчётами в одной системе.
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

      {/* Почему лучше, чем вести всё в чатах и таблицах */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это лучше, чем вести всё в чатах и таблицах
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Ручной подход в компании услуг против CRM в одной системе.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Чаты и таблицы
              </h3>
              <ul className="space-y-2">
                {COMPARISON_MANUAL.map((item) => (
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
                2wix
              </h3>
              <ul className="space-y-2">
                {COMPARISON_2WIX.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sf-text-secondary text-sm">
                    <Check className="w-4 h-4 text-sf-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Запустите CRM для сферы услуг, где заявки, клиенты и продажи под контролем
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Универсальная CRM, которая хорошо подходит для сервисного бизнеса. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
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
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-white/90 hover:text-white border-2 border-white/40 hover:border-white/60 transition-all"
            >
              Попробовать
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
            Вопросы о CRM для сферы услуг
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о 2wix для сервисного бизнеса и отдела продаж.
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
            <Link to="/upravlenie-zayavkami" className={LINK_BTN_CLASS}>Управление заявками</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>Сделки и воронка</Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>Аналитика продаж</Link>
            <Link to="/kontrol-menedzherov" className={LINK_BTN_CLASS}>Контроль менеджеров</Link>
            <Link to="/crm-dlya-stroitelnoi-kompanii" className={LINK_BTN_CLASS}>CRM для строительной компании</Link>
            <Link to="/crm-dlya-proizvodstva" className={LINK_BTN_CLASS}>CRM для производства</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
