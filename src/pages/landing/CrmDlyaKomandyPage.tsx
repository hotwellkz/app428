import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicProductPreview } from '../../public/components/PublicProductPreview';
import {
  Users,
  MessageSquare,
  GitBranch,
  Shield,
  BarChart3,
  Eye,
  Inbox,
  UserCheck,
  ArrowRight,
  Check,
  AlertCircle,
  LayoutDashboard,
  FileSpreadsheet,
  Zap,
  StickyNote,
} from 'lucide-react';

const TITLE =
  'CRM для команды — совместная работа с клиентами, заявками и сделками в одной системе | 2wix';
const DESCRIPTION =
  'CRM для команды в 2wix: несколько менеджеров работают в одной системе. Единая база клиентов, распределение заявок, роли и права, прозрачность для руководителя. Командная работа в CRM без хаоса.';

const PROBLEMS = [
  {
    title: 'Каждый сотрудник ведёт клиентов по-своему',
    text: 'Нет единых правил: кто где хранит контакты, как фиксирует заявки. Совместная работа в CRM отсутствует — каждый в своих таблицах и чатах.',
  },
  {
    title: 'Информация разбросана по чатам и таблицам',
    text: 'Часть в мессенджере, часть в Excel, часть в почте. Руководитель и менеджеры не видят общей картины. CRM для нескольких менеджеров решает это.',
  },
  {
    title: 'Сложно передавать клиентов между менеджерами',
    text: 'История у одного, контекст теряется при передаче. Нет системы, где клиент и вся переписка остаются в одном месте при смене ответственного.',
  },
  {
    title: 'Руководитель не видит общую картину',
    text: 'Кто сколько клиентов ведёт, где заявки, кто перегружен — непонятно. Нет прозрачности работы команды продаж в одной системе.',
  },
  {
    title: 'Роли и ответственность неочевидны',
    text: 'Кто за что отвечает, кто что может видеть и менять — на словах. CRM для сотрудников с ролями и правами даёт ясность.',
  },
  {
    title: 'Заявки и переписка теряются',
    text: 'Обращения остаются в личных чатах, часть заявок не доходит до учёта. Командная работа в CRM сохраняет всё в одном месте.',
  },
  {
    title: 'Нет общей системы для команды',
    text: 'Каждый работает в своём режиме. Нет единой CRM для команды — клиенты, заявки и процессы не собраны в одной системе.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: Users,
    title: 'Единая база клиентов',
    text: 'Вся команда работает с одной клиентской базой. CRM для команды — один источник правды, без разрозненных списков.',
  },
  {
    icon: UserCheck,
    title: 'Работа нескольких менеджеров',
    text: 'Несколько сотрудников в одной системе. Назначение ответственного, распределение нагрузки. CRM для нескольких менеджеров из коробки.',
  },
  {
    icon: Inbox,
    title: 'Распределение заявок',
    text: 'Заявки попадают в CRM, назначается ответственный. Командная работа с входящими — без потери обращений.',
  },
  {
    icon: Shield,
    title: 'Роли и права доступа',
    text: 'Руководитель, менеджер, сотрудник — разные роли и права. Система для командной работы с клиентами и разграничением доступа.',
  },
  {
    icon: MessageSquare,
    title: 'История общения',
    text: 'Вся переписка с клиентом в карточке. При передаче клиента другому менеджеру контекст не теряется.',
  },
  {
    icon: MessageSquare,
    title: 'Единый WhatsApp-интерфейс',
    text: 'Менеджеры работают с клиентами в одном интерфейсе. Совместная работа в CRM через общие чаты и заявки.',
  },
  {
    icon: GitBranch,
    title: 'Сделки и этапы',
    text: 'Воронка сделок в одной системе. Видно, кто какой клиент ведёт, на каком этапе сделка. CRM для команды продаж с прозрачностью.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика по сотрудникам',
    text: 'Сколько заявок, клиентов и сделок у каждого. Нагрузка и результативность по команде в одной CRM.',
  },
  {
    icon: Eye,
    title: 'Прозрачность для руководителя',
    text: 'Кто что ведёт, где непрочитанные сообщения, где просадки. Контроль команды без тотальной слежки.',
  },
  {
    icon: Zap,
    title: 'Меньше хаоса в работе команды',
    text: 'Всё в одной системе: клиенты, заявки, переписка, сделки. Командная работа в CRM вместо разрозненных инструментов.',
  },
];

const FLOW_STEPS = [
  'Клиент пишет или оставляет заявку',
  'Заявка попадает в CRM',
  'Назначается ответственный менеджер',
  'Менеджер работает с клиентом в системе',
  'Руководитель видит процесс и нагрузку',
  'При необходимости клиента можно передать без потери контекста',
];

const WHAT_LEADER_SEES = [
  {
    icon: UserCheck,
    title: 'Кто за что отвечает',
    text: 'По каждому клиенту и заявке видно ответственного. Прозрачность распределения в команде.',
  },
  {
    icon: Users,
    title: 'Сколько клиентов и заявок в работе',
    text: 'У кого сколько клиентов, сколько заявок обработано. Нагрузка по сотрудникам в одной CRM.',
  },
  {
    icon: BarChart3,
    title: 'Как работают менеджеры',
    text: 'Активность, сделки, скорость ответа. CRM для команды продаж с аналитикой по каждому.',
  },
  {
    icon: Inbox,
    title: 'Где есть непрочитанные и просадки',
    text: 'Какие сообщения ждут ответа, где клиент ждёт слишком долго. Точечный контроль без микроменеджмента.',
  },
  {
    icon: GitBranch,
    title: 'Где зависли сделки',
    text: 'Сделки по этапам и по менеджерам. Видно, где движение есть, а где застой.',
  },
  {
    icon: AlertCircle,
    title: 'Какие сотрудники перегружены',
    text: 'Сводная картина по нагрузке. Распределение заявок и клиентов между менеджерами.',
  },
  {
    icon: LayoutDashboard,
    title: 'Насколько команда работает системно',
    text: 'Всё в одной системе — видно, как команда ведёт клиентов, заявки и сделки. Управляемость процессов.',
  },
];

const FOR_MANAGERS = [
  {
    icon: Users,
    title: 'Всё по клиенту в одном месте',
    text: 'Карточка клиента с контактами, историей, сделками. Не нужно искать по чатам и таблицам.',
  },
  {
    icon: Check,
    title: 'Меньше потери контекста',
    text: 'История сохраняется. При передаче клиента коллеге всё остаётся в системе. Совместная работа в CRM без потерь.',
  },
  {
    icon: Inbox,
    title: 'Проще брать заявки в работу',
    text: 'Заявки в одном интерфейсе, назначение на себя в один клик. CRM для сотрудников с удобным потоком обращений.',
  },
  {
    icon: GitBranch,
    title: 'Легче вести клиента по этапам',
    text: 'Сделка привязана к клиенту, этапы воронки понятны. Менеджер видит, что делать дальше.',
  },
  {
    icon: Zap,
    title: 'Понятнее, что делать дальше',
    text: 'Статусы, этапы, непрочитанные — всё в одном месте. Меньше хаоса в задачах и переписке.',
  },
  {
    icon: StickyNote,
    title: 'Меньше хаоса в переписке и заметках',
    text: 'Переписка и заметки в карточке клиента. Не нужно искать по чатам и блокнотам.',
  },
];

const ROLES_BLOCK = [
  {
    icon: UserCheck,
    title: 'Ответственный менеджер',
    text: 'У каждого клиента и заявки — назначенный ответственный. Понятно, кто за кого отвечает в команде.',
  },
  {
    icon: Shield,
    title: 'Роли и права доступа',
    text: 'Разные роли с разными правами. Можно разграничивать доступ к разделам. Подробнее — на странице ролей и прав.',
  },
  {
    icon: Eye,
    title: 'Видно действия команды',
    text: 'Кто что сделал, когда. Работа не на словах, а в системе — с фиксацией в CRM.',
  },
  {
    icon: LayoutDashboard,
    title: 'Работа в системе, а не на словах',
    text: 'Заявки, клиенты, сделки — в одной CRM. Руководитель и команда опираются на данные, а не на отчёты из головы.',
  },
  {
    icon: Shield,
    title: 'Разграничение доступа',
    text: 'Финансы, настройки, аналитика — только тем, кому нужно. CRM для команды с гибкими правами.',
  },
];

const PREVIEW_MODULES = [
  { icon: Users, label: 'Клиенты' },
  { icon: UserCheck, label: 'Менеджеры' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: MessageSquare, label: 'WhatsApp' },
];

const COMPARISON_WITHOUT = [
  'У каждого свои записи',
  'Сложно передавать клиентов',
  'Хаос в сообщениях',
  'Нет прозрачности',
  'Руководитель не видит реальной картины',
];

const COMPARISON_2WIX = [
  'Все работают в одной системе',
  'Роли понятны',
  'Клиенты не теряются',
  'Есть история',
  'Есть контроль и аналитика',
];

const FAQ_ITEMS = [
  {
    q: 'Подходит ли 2wix для команды из нескольких менеджеров?',
    a: 'Да. 2wix — это CRM для команды: несколько менеджеров работают в одной системе, единая база клиентов, назначение ответственного, распределение заявок. Командная работа в CRM с ролями и прозрачностью для руководителя.',
  },
  {
    q: 'Можно ли распределять заявки между сотрудниками?',
    a: 'Да. Заявки попадают в CRM, можно назначить ответственного. Распределение заявок между менеджерами — без потери обращений. Система для командной работы с клиентами и входящими.',
  },
  {
    q: 'Можно ли передавать клиента без потери истории?',
    a: 'Да. Вся история общения и данные по клиенту хранятся в карточке. При переназначении ответственного контекст сохраняется — новый менеджер видит всё в CRM для команды.',
  },
  {
    q: 'Видит ли руководитель работу команды?',
    a: 'Да. Руководитель видит, кто за что отвечает, сколько клиентов и заявок у каждого, где непрочитанные сообщения и просадки. Прозрачность работы команды продаж в одной системе.',
  },
  {
    q: 'Есть ли роли и права доступа?',
    a: 'Да. В 2wix есть роли и права доступа: руководитель, менеджер, сотрудник с разными возможностями. Можно разграничивать доступ к разделам. Подробнее — на странице ролей и прав.',
  },
  {
    q: 'Подходит ли это для малого бизнеса?',
    a: 'Да. CRM для команды полезна уже с двумя-тремя сотрудниками: единая база, понятное распределение, меньше потерь. Система масштабируется при росте команды.',
  },
  {
    q: 'Можно ли работать через WhatsApp всей командой?',
    a: 'Да. В 2wix единый интерфейс для работы с WhatsApp: заявки и переписка в CRM, назначение ответственного, история в карточке клиента. Совместная работа в CRM через один WhatsApp-поток.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const CrmDlyaKomandyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/crm-dlya-komandy">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                CRM для команды: клиенты, заявки и процессы в одной системе
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает менеджерам, руководителям и сотрудникам работать с клиентами, заявками, сделками и сообщениями в одной системе с понятными ролями и прозрачным контролем.
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

      {/* Какие проблемы решает */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Какие проблемы решает CRM для команды
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без общей системы каждый ведёт по-своему, информация теряется, а руководитель не видит картины.
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

      {/* Что даёт 2wix для команды */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix для команды
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Единая база, несколько менеджеров, распределение заявок, роли, история и прозрачность — CRM для сотрудников в одной системе.
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

      {/* Как работает команда в 2wix */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как работает команда в 2wix
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            От заявки до передачи клиента — всё в одной CRM для команды.
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
            Прозрачность работы команды: кто за что отвечает, где нагрузка и просадки.
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
          <p className="mt-8 text-center text-sf-text-secondary">
            Детали — на странице{' '}
            <Link to="/kontrol-menedzherov" className="text-sf-accent font-medium hover:text-sf-primary">контроль менеджеров</Link>.
          </p>
        </div>
      </section>

      {/* Чем удобно для менеджеров */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Чем это удобно для менеджеров
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            CRM для сотрудников — не только контроль, но и удобство работы: всё в одном месте, меньше хаоса.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FOR_MANAGERS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6"
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

      {/* Роли, ответственность и прозрачность */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Роли, ответственность и прозрачность
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            В 2wix есть ответственный по каждому клиенту, роли и права доступа, видимость действий команды.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ROLES_BLOCK.map(({ icon: Icon, title, text }) => (
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
          <p className="mt-8 text-center text-sf-text-secondary">
            Подробнее о разграничении доступа — на странице{' '}
            <Link to="/roli-i-prava" className="text-sf-accent font-medium hover:text-sf-primary">роли и права</Link>.
          </p>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс: клиенты, менеджеры, сделки, WhatsApp
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            CRM для команды с распределением по менеджерам, сделками, перепиской и аналитикой.
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

      {/* Почему лучше, чем работать вразную */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это лучше, чем работать вразную
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без общей CRM — хаос и потери; с 2wix — командная работа в одной системе.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Без общей CRM
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
            Подключите команду к CRM, где все работают в одной системе и ничего не теряется
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Единая база, роли и прозрачность. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
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
            Вопросы о CRM для команды
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о совместной работе, распределении заявок и ролях в 2wix.
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
            <Link to="/roli-i-prava" className={LINK_BTN_CLASS}>Роли и права</Link>
            <Link to="/kontrol-menedzherov" className={LINK_BTN_CLASS}>Контроль менеджеров</Link>
            <Link to="/upravlenie-zayavkami" className={LINK_BTN_CLASS}>Управление заявками</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
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
