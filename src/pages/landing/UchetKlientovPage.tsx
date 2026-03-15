import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicProductPreview } from '../../public/components/PublicProductPreview';
import {
  Users,
  FileText,
  MessageSquare,
  GitBranch,
  StickyNote,
  UserCheck,
  FolderOpen,
  Search,
  Filter,
  ArrowRight,
  Check,
  AlertCircle,
  BarChart3,
  FileSpreadsheet,
  LayoutDashboard,
  Phone,
  Inbox,
} from 'lucide-react';

const TITLE =
  'Учёт клиентов в CRM — система учёта клиентов, программа для ведения клиентской базы | 2wix';
const DESCRIPTION =
  'Учёт клиентов в 2wix: контакты, история общения, статусы и сделки в одной системе. CRM для учёта клиентов без таблиц и хаоса. Ведение клиентов и учёт обращений в одной программе.';

const PROBLEMS = [
  {
    title: 'Клиенты записаны в разных местах',
    text: 'Контакты в блокноте, в почте, в мессенджерах. Нет единого учёта клиентов — сложно понять, где актуальная информация и кто за кого отвечает.',
  },
  {
    title: 'История общения теряется',
    text: 'Кто что обещал, когда звонили, о чём договаривались — в головах или в разрозненных чатах. Учёт клиентов и обращений не ведётся системно.',
  },
  {
    title: 'Менеджеры ведут базу по-разному',
    text: 'Нет единых правил ведения клиентов: кто как записывает, где хранит. Дубли, путаница, неудобный поиск. Система учёта клиентов отсутствует.',
  },
  {
    title: 'Сложно понять, кто и когда общался с клиентом',
    text: 'Нет прозрачности: какой менеджер вёл контакт, когда было последнее обращение. Учёт клиентской базы вручную не даёт полной картины.',
  },
  {
    title: 'Трудно быстро найти информацию по человеку',
    text: 'Поиск по таблицам, по почте, по чатам. Нет единого места, где по клиенту собрано всё. Программа учёта клиентов решает это.',
  },
  {
    title: 'Нет единого учёта клиентов и обращений',
    text: 'Заявки в одном месте, переписка в другом, контакты в третьем. Нет связи между обращением, клиентом и сделкой.',
  },
  {
    title: 'При передаче клиента другому менеджеру теряется контекст',
    text: 'Вся информация у прежнего менеджера. Новому приходится выспрашивать. Учёт клиентов в CRM сохраняет историю и контекст при передаче.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: Users,
    title: 'Единая клиентская база',
    text: 'Все клиенты в одной системе. Один источник правды для учёта клиентов — без разрозненных таблиц и дублей.',
  },
  {
    icon: FileText,
    title: 'Карточка клиента',
    text: 'По каждому клиенту — карточка с контактами, заметками, историей и сделками. Всё в одном месте, учёт не теряется.',
  },
  {
    icon: Phone,
    title: 'Контакты и данные',
    text: 'Телефоны, источники обращения, комментарии. Хранение данных по клиенту в CRM для учёта клиентской базы.',
  },
  {
    icon: StickyNote,
    title: 'Заметки и комментарии',
    text: 'Договорённости, важные детали — в карточке. Ведение клиентов с фиксацией контекста для всей команды.',
  },
  {
    icon: MessageSquare,
    title: 'История общения',
    text: 'Переписка с клиентом хранится в карточке. Учёт клиентов и обращений — с полной историей сообщений.',
  },
  {
    icon: MessageSquare,
    title: 'Связь с WhatsApp-перепиской',
    text: 'Сообщения из мессенджера привязываются к клиенту. Учёт клиентов в CRM с перепиской в одном месте.',
  },
  {
    icon: GitBranch,
    title: 'Связь со сделками',
    text: 'Сделки по клиенту видны в карточке. Ведение клиентов и учёт обращений связаны с воронкой продаж.',
  },
  {
    icon: Filter,
    title: 'Статусы клиента',
    text: 'Размечайте клиентов по статусам. Система учёта клиентов с понятной структурой: лид, в работе, закрыт.',
  },
  {
    icon: UserCheck,
    title: 'Ответственный менеджер',
    text: 'Назначьте менеджера на клиента. Понятно, кто ведёт учёт по контакту. Руководитель видит распределение.',
  },
  {
    icon: Search,
    title: 'Поиск и фильтры',
    text: 'Поиск по имени, телефону, комментарию. Фильтры по менеджеру, статусу. Быстро найти клиента в программе учёта.',
  },
];

const CARD_FIELDS = [
  { icon: Users, label: 'Имя' },
  { icon: Phone, label: 'Телефон' },
  { icon: Filter, label: 'Источник обращения' },
  { icon: StickyNote, label: 'Комментарии' },
  { icon: MessageSquare, label: 'История сообщений' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: FolderOpen, label: 'Файлы' },
  { icon: Filter, label: 'Статус клиента' },
];

const FLOW_STEPS = [
  'Клиент пишет или оставляет заявку',
  'Обращение попадает в CRM',
  'Создаётся карточка клиента',
  'К ней привязываются сообщения, менеджер и сделка',
  'История сохраняется в системе',
  'Руководитель видит всю работу по клиенту',
];

const WHY_FOR_BUSINESS = [
  {
    icon: Check,
    title: 'Меньше потерь информации',
    text: 'Всё в CRM: контакты, переписка, заметки. Учёт клиентов не теряется при смене менеджера или уходе сотрудника.',
  },
  {
    icon: UserCheck,
    title: 'Понятнее передача клиента внутри команды',
    text: 'Переназначили ответственного — вся история в карточке. Ведение клиентов с сохранением контекста при передаче.',
  },
  {
    icon: Inbox,
    title: 'Быстрее работа с обращениями',
    text: 'Заявки и сообщения привязаны к клиенту. Учёт клиентов и обращений в одном месте — меньше рутины.',
  },
  {
    icon: LayoutDashboard,
    title: 'Лучше контроль менеджеров',
    text: 'Руководитель видит, кто кого ведёт, какая история. Система учёта клиентов с прозрачностью для команды.',
  },
  {
    icon: BarChart3,
    title: 'Проще аналитика по клиентам',
    text: 'Сколько клиентов, по статусам, по менеджерам. Учёт клиентской базы даёт цифры для решений.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Меньше хаоса и дублей',
    text: 'Один клиент — одна карточка. Программа учёта клиентов без дублирования и разрозненных списков.',
  },
];

const LINK_CHAIN = [
  { icon: Users, label: 'Клиент' },
  { icon: Inbox, label: 'Заявка' },
  { icon: MessageSquare, label: 'Переписка' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: GitBranch, label: 'Сделка' },
  { icon: BarChart3, label: 'Аналитика' },
];

const PREVIEW_MODULES = [
  { icon: Users, label: 'Клиенты' },
  { icon: FileText, label: 'Карточка' },
  { icon: Filter, label: 'Статусы' },
  { icon: MessageSquare, label: 'История' },
];

const COMPARISON_MANUAL = [
  'Таблицы в разных файлах',
  'Разрозненные заметки',
  'Сообщения отдельно от учёта',
  'Потеря истории',
  'Неудобный поиск',
];

const COMPARISON_2WIX = [
  'Единая база в одной системе',
  'Всё по клиенту в одном месте',
  'Удобно работать командой',
  'Есть статусы и история',
  'Легко найти нужную информацию',
];

const FAQ_ITEMS = [
  {
    q: 'Можно ли вести учёт клиентов в 2wix?',
    a: 'Да. В 2wix есть полноценный учёт клиентов: единая база, карточка клиента с контактами, заметками, историей общения, сделками и ответственным менеджером. CRM для учёта клиентов — контакты, обращения и статусы в одной системе.',
  },
  {
    q: 'Есть ли карточка клиента?',
    a: 'Да. У каждого клиента есть карточка с именем, телефоном, источником обращения, комментариями, историей сообщений, менеджером, сделками, файлами и статусом. Вся информация по клиенту в одном месте — учёт не теряется.',
  },
  {
    q: 'Можно ли хранить историю общения?',
    a: 'Да. Вся переписка с клиентом сохраняется в карточке. История общения привязана к клиенту — при смене менеджера контекст сохраняется. Система учёта клиентов с полной историей обращений.',
  },
  {
    q: 'Можно ли связать клиента с перепиской и сделкой?',
    a: 'Да. Сообщения из WhatsApp и других каналов привязываются к карточке клиента. Из обращений создаются и ведутся сделки. Клиент, переписка и сделка связаны — 2wix это не просто список контактов, а живая CRM для ведения клиентов.',
  },
  {
    q: 'Подходит ли это для малого бизнеса?',
    a: 'Да. Учёт клиентов в CRM полезен и для малого бизнеса: даже с небольшим количеством клиентов важно не терять контакты, историю и контекст. Программа учёта клиентов масштабируется при росте.',
  },
  {
    q: 'Можно ли искать клиентов по базе?',
    a: 'Да. В 2wix есть поиск по базе клиентов: по имени, телефону, комментарию. Фильтры по менеджеру, статусу, дате. Быстро найти нужного клиента в системе учёта клиентов.',
  },
  {
    q: 'Можно ли назначать ответственного менеджера?',
    a: 'Да. На каждого клиента можно назначить ответственного менеджера. Понятно, кто ведёт учёт по контакту. Руководитель видит распределение и может переназначить. Ведение клиентов с прозрачностью для команды.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const UchetKlientovPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/uchet-klientov">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Учёт клиентов в CRM: контакты, история и сделки в одном месте
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает бизнесу фиксировать клиентов, хранить контакты, вести историю общения, отслеживать статусы и работать с клиентской базой в одной системе.
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
            Какие проблемы решает учёт клиентов в CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы учёта клиенты разбросаны, история теряется, а ведение клиентской базы превращается в хаос.
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

      {/* Что даёт 2wix для учёта клиентов */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix для учёта клиентов
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Единая база, карточка клиента, контакты, заметки, история, переписка, сделки и статусы — программа учёта клиентов в одной CRM.
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
          <p className="mt-8 text-center text-sf-text-secondary">
            Подробнее — в разделе{' '}
            <Link to="/upravlenie-klientami" className="text-sf-accent font-medium hover:text-sf-primary">управление клиентами</Link> и{' '}
            <Link to="/edinaya-baza-klientov" className="text-sf-accent font-medium hover:text-sf-primary">единая база клиентов</Link>.
          </p>
        </div>
      </section>

      {/* Карточка клиента */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Карточка клиента: всё по клиенту в одном месте
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            В карточке в 2wix собрано всё необходимое для учёта клиента — по контакту ничего не теряется.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {CARD_FIELDS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-5 flex flex-col items-center text-center"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sf-text-primary text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это работает
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            От обращения клиента до полной истории в карточке — учёт клиентов и обращений в действии.
          </p>
          <ol className="space-y-4">
            {FLOW_STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-surface p-5 shadow-sm"
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

      {/* Почему это важно для бизнеса */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это важно для бизнеса
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Системный учёт клиентов снижает потери, ускоряет работу с обращениями и упрощает контроль команды.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_BUSINESS.map(({ icon: Icon, title, text }) => (
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

      {/* Учёт клиентов + переписка + сделки */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Учёт клиентов + переписка + сделки в одной системе
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            2wix — не просто список контактов: клиент, заявка, переписка, менеджер, сделка и аналитика связаны в живой CRM.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {LINK_CHAIN.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-5 flex flex-col items-center text-center shadow-sm"
              >
                <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-3">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="font-medium text-sf-text-primary text-sm">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sf-text-secondary">
            Связка с <Link to="/whatsapp-crm" className="text-sf-accent font-medium hover:text-sf-primary">WhatsApp CRM</Link> и{' '}
            <Link to="/sdelki-i-voronka" className="text-sf-accent font-medium hover:text-sf-primary">сделками и воронкой</Link> — учёт клиентов в CRM с полным циклом от обращения до сделки.
          </p>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс: список клиентов, карточка, статусы, история
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Учёт клиентов с поиском, карточкой, историей общения, связью с WhatsApp и сделками.
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

      {/* Почему лучше, чем таблицы и ручной учёт */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это лучше, чем таблицы и ручной учёт
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Ручной учёт против системы учёта клиентов в CRM.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Ручной учёт
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
            Переведите учёт клиентов в CRM, где вся информация всегда под рукой
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Контакты, история и сделки в одной системе. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
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
            Вопросы об учёте клиентов
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о программе учёта клиентов, карточке и ведении клиентской базы в 2wix.
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
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/edinaya-baza-klientov" className={LINK_BTN_CLASS}>Единая база клиентов</Link>
            <Link to="/upravlenie-zayavkami" className={LINK_BTN_CLASS}>Управление заявками</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
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
