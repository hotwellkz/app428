import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import {
  Users,
  MessageSquare,
  GitBranch,
  BarChart3,
  ArrowRight,
  Check,
  AlertCircle,
  FileText,
  UserPlus,
  Search,
  Filter,
  LayoutDashboard,
  Eye,
  StickyNote,
  FolderOpen,
} from 'lucide-react';

const TITLE = 'Управление клиентами в CRM — база клиентов, карточка клиента, история общения | 2wix';
const DESCRIPTION =
  'Система управления клиентами в одной CRM: единая база клиентов, карточка клиента, история переписки, сделки и ответственный менеджер. Ведение клиентской базы для любого бизнеса.';

const PROBLEMS = [
  {
    title: 'Клиенты записаны в разных местах',
    text: 'Контакты в блокноте, в почте, в мессенджерах у разных сотрудников. Нет единой базы — сложно найти клиента и понять полную картину.',
  },
  {
    title: 'История общения теряется',
    text: 'Кто что обещал, когда звонили, о чём договаривались — всё в головах или в разрозненных чатах. При смене менеджера контекст теряется.',
  },
  {
    title: 'Менеджеры ведут клиентов хаотично',
    text: 'Нет единых правил: кто за кого отвечает, на каком этапе клиент. Дублирование обращений и потеря заявок.',
  },
  {
    title: 'Сложно понять, кто за кого отвечает',
    text: 'Неясно, какой менеджер ведёт клиента. Руководитель не видит распределения нагрузки и не может быстро переназначить контакт.',
  },
  {
    title: 'Данные по клиенту разбросаны',
    text: 'Телефон в одном месте, переписка в другом, сделки в третьем. Нет единой карточки клиента с полной историей.',
  },
  {
    title: 'Заявки и переписка не связаны',
    text: 'Сообщение из WhatsApp не привязано к карточке клиента и сделке. Нужно вручную искать контекст и собирать информацию.',
  },
  {
    title: 'Нет единой карточки клиента',
    text: 'Всё по одному клиенту — контакты, комментарии, сделки, файлы — должно быть в одном месте. Без этого работа с базой клиентов неэффективна.',
  },
];

const WHAT_2WIX_GIVES = [
  { icon: Users, title: 'Единая база клиентов', text: 'Все контакты в одной системе. Учёт клиентов без таблиц и разрозненных списков. Быстрый поиск по имени, телефону, комментарию.' },
  { icon: FileText, title: 'Карточка клиента', text: 'Всё по клиенту в одном месте: имя, телефон, комментарий, статус, ответственный менеджер, история сообщений, сделки, файлы и заметки.' },
  { icon: StickyNote, title: 'Комментарии и заметки', text: 'Добавляйте комментарии к карточке клиента. Фиксируйте договорённости и важные детали — они видны всей команде.' },
  { icon: MessageSquare, title: 'История общения', text: 'Вся переписка с клиентом сохраняется в карточке. WhatsApp и другие каналы — в одном окне, с привязкой к клиенту.' },
  { icon: MessageSquare, title: 'Привязка WhatsApp-переписки', text: 'Переписка из мессенджера автоматически попадает в карточку клиента. Не нужно искать чаты в личных аккаунтах.' },
  { icon: GitBranch, title: 'Привязка сделок', text: 'Сделки по клиенту видны в его карточке. Этапы воронки, суммы и ответственный менеджер — без переключения между разделами.' },
  { icon: UserPlus, title: 'Ответственный менеджер', text: 'Назначьте менеджера на клиента. Понятно, кто ведёт контакт. Руководитель видит распределение и может переназначить.' },
  { icon: Filter, title: 'Статусы и фильтры', text: 'Размечайте клиентов по статусам. Фильтруйте базу по менеджеру, этапу сделки, дате — быстро находите нужных клиентов.' },
  { icon: Search, title: 'Быстрый поиск', text: 'Поиск по базе клиентов: по имени, телефону, комментарию. Система управления клиентами должна позволять находить контакт за секунды.' },
  { icon: FolderOpen, title: 'Файлы клиента', text: 'Храните документы и файлы в карточке клиента. Договоры, сметы, фото — всё в одном месте, с привязкой к контакту.' },
];

const CARD_ITEMS = [
  'Имя и контакты',
  'Комментарий',
  'Статус',
  'Ответственный менеджер',
  'История сообщений',
  'Сделки',
  'Файлы',
  'Заметки',
];

const FLOW_STEPS = [
  'Клиент пишет или оставляет заявку',
  'Контакт попадает в CRM',
  'Создаётся карточка клиента',
  'Назначается ответственный менеджер',
  'Ведётся переписка и сделка',
  'Руководитель видит весь процесс',
];

const FOR_WHICH_BUSINESSES = [
  'Отделы продаж',
  'Малый бизнес',
  'Компании с заявками из WhatsApp',
  'Строительные компании',
  'Производство',
  'Сервисные компании',
  'Команды с несколькими менеджерами',
];

const WHY_FOR_LEADER = [
  { icon: Eye, title: 'Все клиенты под контролем', text: 'Единая база и карточки клиентов. Видно, кто в работе, кто на каком этапе, кто за кого отвечает.' },
  { icon: Users, title: 'Видно, кто отвечает', text: 'По каждому клиенту назначен ответственный. Нет путаницы и дублирования. Легко переназначить при необходимости.' },
  { icon: LayoutDashboard, title: 'Видна история работы', text: 'Вся переписка, сделки и заметки в карточке клиента. Руководитель может быстро вникнуть в контекст.' },
  { icon: AlertCircle, title: 'Нет потери заявок', text: 'Заявки попадают в CRM и привязываются к клиенту. Ничего не теряется в личных чатах и почте.' },
  { icon: Filter, title: 'Быстро понять статус клиента', text: 'Статусы, этапы сделок, последний контакт — всё в одном месте. Удобно для контроля и отчётности.' },
  { icon: BarChart3, title: 'Контроль менеджеров', text: 'Видно нагрузку, кто сколько клиентов ведёт и как движутся сделки. Аналитика по работе с клиентской базой.' },
];

const PREVIEW_ITEMS = [
  { label: 'Список клиентов', icon: Users },
  { label: 'Карточка клиента', icon: FileText },
  { label: 'Сделки по клиенту', icon: GitBranch },
  { label: 'История сообщений', icon: MessageSquare },
  { label: 'Комментарии и заметки', icon: StickyNote },
  { label: 'Поиск по базе', icon: Search },
];

const FAQ_ITEMS = [
  {
    q: 'Что даёт CRM для управления клиентами?',
    a: 'CRM даёт единую базу клиентов, карточку клиента с контактами, комментариями, историей общения и сделками, назначение ответственного менеджера, поиск и фильтры. Всё по клиенту в одном месте — без таблиц и разрозненных чатов.',
  },
  {
    q: 'Можно ли хранить историю общения с клиентом?',
    a: 'Да. В 2wix вся переписка с клиентом сохраняется в его карточке. WhatsApp и другие каналы привязаны к карточке клиента, так что история общения не теряется и доступна всей команде.',
  },
  {
    q: 'Есть ли карточка клиента?',
    a: 'Да. В карточке клиента в 2wix: имя, телефон, комментарий, статус, ответственный менеджер, история сообщений, сделки, файлы и заметки. Всё в одном месте для удобного ведения клиентской базы.',
  },
  {
    q: 'Можно ли назначать ответственного менеджера?',
    a: 'Да. На каждого клиента можно назначить ответственного менеджера. Руководитель видит распределение и может переназначать контакты. Это упорядочивает работу с клиентами и исключает дублирование.',
  },
  {
    q: 'Можно ли связать клиента с перепиской и сделкой?',
    a: 'Да. Переписка из WhatsApp и другие сообщения привязываются к карточке клиента. Сделки тоже привязаны к клиенту и видны в его карточке. Вся информация по клиенту собрана в одном месте.',
  },
  {
    q: 'Подходит ли 2wix для малого бизнеса?',
    a: 'Да. 2wix подходит для малого бизнеса и команд из нескольких человек. Управление клиентами, ведение базы, карточка клиента, сделки и переписка — в одной системе, без сложного внедрения.',
  },
  {
    q: 'Можно ли искать клиентов по базе?',
    a: 'Да. В 2wix есть быстрый поиск по базе клиентов: по имени, телефону, комментарию. Фильтры по статусу, менеджеру и другим параметрам помогают быстро находить нужных клиентов.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const UpravlenieKlientamiPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/upravlenie-klientami">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Управление клиентами в одной CRM-системе
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Ведите клиентскую базу, заявки и историю общения в одном месте. 2wix помогает собирать клиентов, хранить переписку, вести сделки, назначать менеджеров и контролировать работу с клиентами.
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
            <div className="rounded-sfCard border border-sf-border bg-sf-surface shadow-xl shadow-sfCard overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-sf-backgroundSection to-sf-primaryLight/30 flex items-center justify-center p-8">
                <div className="w-full max-w-sm rounded-sfCard bg-sf-surface border border-sf-border shadow-lg p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-sf-borderLight">
                    <Users className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">Управление клиентами</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['База клиентов', 'Карточка', 'Сделки', 'Переписка'].map((label) => (
                      <div key={label} className="rounded-lg bg-sf-backgroundSection py-2 px-3 text-center text-sm font-medium text-sf-text-secondary">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Какие проблемы решает */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Какие проблемы решает система управления клиентами</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без единой базы и карточки клиента данные разбросаны, история теряется, а контроль над работой с клиентами слабеет.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {PROBLEMS.map(({ title, text }) => (
              <div key={title} className="flex items-start gap-4 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6">
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

      {/* Что даёт 2wix для работы с клиентами */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что даёт 2wix для работы с клиентами</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Единая база клиентов, карточка клиента, учёт клиентов и связь с перепиской и сделками в одной системе.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_2WIX_GIVES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm hover:shadow-md transition-shadow">
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

      {/* Карточка клиента */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Всё по клиенту в одной карточке</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Карточка клиента в CRM — это единое место для контактов, истории общения, сделок и файлов. Ведение клиентской базы становится прозрачным.
          </p>
          <div className="max-w-2xl mx-auto rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-sf-border bg-white">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-sf-accent" />
                <span className="font-semibold text-sf-text-primary">Карточка клиента</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CARD_ITEMS.map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg bg-sf-borderLight py-2 px-3 text-sm font-medium text-sf-text-secondary">
                    <Check className="w-4 h-4 text-sf-accent flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 text-center text-sf-text-muted text-sm">
              Имя, телефон, комментарий, статус, менеджер, история сообщений, сделки, файлы, заметки — всё в одном месте
            </div>
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает</h2>
          <p className="text-sf-text-secondary text-center mb-14">От заявки до полной карточки клиента и контроля руководителя</p>
          <ol className="space-y-4">
            {FLOW_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-surface p-5 shadow-sm">
                <span className="flex-shrink-0 w-10 h-10 rounded-sfCard bg-sf-primary text-sf-text-inverse font-bold flex items-center justify-center">{i + 1}</span>
                <span className="font-medium text-sf-text-primary">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Для каких бизнесов подходит */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Для каких бизнесов подходит</h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Управление клиентами и ведение клиентской базы нужно любому бизнесу, где есть заявки, переписка и несколько менеджеров.
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {FOR_WHICH_BUSINESSES.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-5 py-4">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Почему это удобно руководителю */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему это удобно руководителю</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Контроль базы клиентов, распределение менеджеров и прозрачность работы с клиентами в одной системе.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_LEADER.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm hover:shadow-md transition-shadow">
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс: база клиентов и карточка</h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Список клиентов, карточка клиента, сделки, переписка и поиск — в одной CRM для управления клиентами.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PREVIEW_ITEMS.map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
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
            Соберите клиентскую базу, переписку и сделки в одной системе
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Управление клиентами в 2wix: карточка клиента, история общения, ответственный менеджер и аналитика. Начните бесплатно.
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
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse border-2 border-sf-border hover:border-sf-borderLight transition-all"
            >
              Посмотреть цены
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы об управлении клиентами</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы о базе клиентов и карточке клиента в 2wix</p>
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
          <h2 className="text-2xl font-bold text-sf-text-primary text-center mb-10">Полезные разделы</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className={LINK_BTN_CLASS}>Главная</Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>Сделки и воронка</Link>
            <Link to="/analitika" className={LINK_BTN_CLASS}>Аналитика</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
