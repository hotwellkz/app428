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
} from 'lucide-react';

const TITLE =
  'Единая база клиентов — CRM для клиентской базы, хранение контактов и истории | 2wix';
const DESCRIPTION =
  'Единая база клиентов в 2wix: карточка клиента, контакты, переписка, сделки и заметки в одной системе. Программа для клиентской базы без потери данных. CRM для бизнеса и команды.';

const PROBLEMS = [
  {
    title: 'Клиенты записаны в разных местах',
    text: 'Контакты в блокноте, в почте, в мессенджерах у разных сотрудников. Нет единой базы клиентов — сложно найти нужного и понять полную картину.',
  },
  {
    title: 'Контакты и история теряются',
    text: 'Кто что обещал, когда звонили, о чём договаривались — в головах или в разрозненных чатах. При смене менеджера контекст теряется.',
  },
  {
    title: 'Менеджеры ведут базу кто как хочет',
    text: 'Нет единых правил: кто за кого отвечает, где хранить контакты. Дубли клиентов, разная структура данных, хаос в учёте.',
  },
  {
    title: 'Сложно быстро найти нужного клиента',
    text: 'Поиск по таблицам, по почте, по чатам. Нет единого поиска по клиентской базе — время теряется на рутину.',
  },
  {
    title: 'Нет прозрачности по прошлым обращениям',
    text: 'Неясно, когда клиент обращался в последний раз, что обсуждали, какой менеджер вёл. История обращений размазана.',
  },
  {
    title: 'WhatsApp, сделки и клиенты не связаны',
    text: 'Переписка в мессенджере, сделки в таблице. Нет связи: один клиент — одна карточка с полной историей общения и сделок.',
  },
  {
    title: 'При передаче клиента другому менеджеру теряется контекст',
    text: 'Вся информация у прежнего менеджера. Новому приходится выспрашивать или искать по разным источникам. Единая база клиентов решает это.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: Users,
    title: 'Единый список клиентов',
    text: 'Вся клиентская база в одной системе. Один источник правды — без таблиц в разных местах и дублей.',
  },
  {
    icon: FileText,
    title: 'Карточка клиента',
    text: 'Всё по клиенту в одном месте: имя, контакты, комментарии, история общения, сделки, менеджер, файлы, статус.',
  },
  {
    icon: Phone,
    title: 'Телефоны и контакты',
    text: 'Хранение базы клиентов с телефонами и другими контактами. Быстрый поиск и доступ для всей команды.',
  },
  {
    icon: MessageSquare,
    title: 'История сообщений',
    text: 'Переписка с клиентом хранится в карточке. WhatsApp и другие каналы — в одном окне, с привязкой к клиенту.',
  },
  {
    icon: StickyNote,
    title: 'Комментарии и заметки',
    text: 'Договорённости, важные детали, заметки по клиенту — в карточке. Вся команда видит контекст.',
  },
  {
    icon: UserCheck,
    title: 'Ответственный менеджер',
    text: 'Назначьте менеджера на клиента. Понятно, кто ведёт контакт. Руководитель видит распределение и может переназначить.',
  },
  {
    icon: GitBranch,
    title: 'Сделки клиента',
    text: 'Сделки по клиенту видны в его карточке. Этапы воронки, суммы, ответственный — без переключения между разделами.',
  },
  {
    icon: FolderOpen,
    title: 'Файлы клиента',
    text: 'Документы, договоры, сметы — в карточке клиента. Всё привязано к контакту в единой базе.',
  },
  {
    icon: Search,
    title: 'Поиск и фильтры',
    text: 'Поиск по имени, телефону, комментарию. Фильтры по менеджеру, статусу, дате. Быстро найти нужного клиента в базе.',
  },
  {
    icon: Filter,
    title: 'Статус клиента',
    text: 'Размечайте клиентов по статусам. Ведение клиентской базы с понятной структурой — лиды, в работе, закрыты.',
  },
];

const CARD_FIELDS = [
  { icon: Users, label: 'Имя' },
  { icon: Phone, label: 'Телефон' },
  { icon: Filter, label: 'Источник обращения' },
  { icon: StickyNote, label: 'Комментарии' },
  { icon: MessageSquare, label: 'История общения' },
  { icon: MessageSquare, label: 'WhatsApp-переписка' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: FolderOpen, label: 'Файлы' },
  { icon: Filter, label: 'Статус' },
];

const FLOW_STEPS = [
  'Клиент пишет или оставляет заявку',
  'Обращение попадает в 2wix',
  'Создаётся карточка клиента',
  'К ней привязываются сообщения, сделки и заметки',
  'Менеджер ведёт клиента в системе',
  'Руководитель видит полную историю по каждому клиенту',
];

const WHY_FOR_TEAM = [
  {
    icon: Users,
    title: 'Все работают с одной базой',
    text: 'Единая клиентская база для всей команды. Нет разрозненных таблиц и личных списков — один источник данных.',
  },
  {
    icon: Check,
    title: 'Меньше потерь информации',
    text: 'Всё в CRM: контакты, переписка, заметки. Информация не теряется при смене менеджера или уходе сотрудника.',
  },
  {
    icon: UserCheck,
    title: 'Легче передавать клиента между менеджерами',
    text: 'Переназначили ответственного — вся история остаётся в карточке. Контекст не теряется.',
  },
  {
    icon: LayoutDashboard,
    title: 'Проще контролировать качество работы',
    text: 'Руководитель видит, кто кого ведёт, какая история по клиенту. Система ведения клиентской базы с прозрачностью.',
  },
  {
    icon: BarChart3,
    title: 'Проще масштабировать продажи',
    text: 'Новые менеджеры сразу работают с общей базой. Не нужно собирать контакты с нуля — единая база клиентов и обращений.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Меньше хаоса и дублей',
    text: 'Один клиент — одна карточка. Нет дублирования контактов и путаницы, кто где что вёл.',
  },
];

const LINK_CHAIN = [
  { icon: Users, label: 'Клиент' },
  { icon: MessageSquare, label: 'Сообщения' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: GitBranch, label: 'Сделка' },
  { icon: StickyNote, label: 'Заметки' },
  { icon: BarChart3, label: 'Аналитика' },
];

const PREVIEW_MODULES = [
  { icon: Users, label: 'База клиентов' },
  { icon: FileText, label: 'Карточка' },
  { icon: MessageSquare, label: 'История' },
  { icon: GitBranch, label: 'Сделки' },
];

const COMPARISON_SCATTERED = [
  'Таблицы в разных файлах',
  'Личные переписки у каждого',
  'Заметки в разных местах',
  'Потеря истории при смене человека',
  'Нет единого контекста по клиенту',
];

const COMPARISON_2WIX = [
  'Единая база клиентов в одной системе',
  'Всё по клиенту в одном месте',
  'Понятный ответственный менеджер',
  'История не теряется',
  'Легче работать командой',
];

const FAQ_ITEMS = [
  {
    q: 'Можно ли вести клиентскую базу в 2wix?',
    a: 'Да. В 2wix есть единая база клиентов: список контактов, карточка клиента с именем, телефоном, комментариями, историей общения, сделками, файлами и ответственным менеджером. Вся клиентская база для бизнеса в одной CRM-системе.',
  },
  {
    q: 'Есть ли карточка клиента?',
    a: 'Да. У каждого клиента есть карточка, в которой собраны контакты, источник обращения, комментарии, история сообщений и WhatsApp-переписка, сделки, менеджер, файлы и статус. Вся информация по клиенту в одном месте.',
  },
  {
    q: 'Можно ли хранить историю общения с клиентом?',
    a: 'Да. Вся переписка с клиентом сохраняется в карточке. История сообщений и общения привязана к клиенту — при смене менеджера контекст не теряется. Хранение базы клиентов с полной историей в CRM.',
  },
  {
    q: 'Можно ли связать клиента с WhatsApp и сделкой?',
    a: 'Да. Сообщения из WhatsApp автоматически привязываются к карточке клиента. Из переписки можно создавать и вести сделки. Клиент, переписка и сделка связаны в единой базе — CRM для клиентской базы с живыми процессами.',
  },
  {
    q: 'Подходит ли это для малого бизнеса?',
    a: 'Да. Единая база клиентов полезна и для малого бизнеса: даже с небольшим количеством клиентов важно не терять контакты, историю и контекст. Система ведения клиентской базы масштабируется при росте.',
  },
  {
    q: 'Можно ли искать клиентов по базе?',
    a: 'Да. В 2wix есть поиск по базе клиентов: по имени, телефону, комментарию. Фильтры по менеджеру, статусу, дате. Быстро найти нужного клиента в единой клиентской базе.',
  },
  {
    q: 'Можно ли работать одной командой с общей клиентской базой?',
    a: 'Да. Вся команда работает с одной базой клиентов: общий список, назначение ответственного, передача клиента без потери истории. Единая база клиентов и обращений — основа системной работы с клиентами в 2wix.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const EdinayaBazaKlientovPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/edinaya-baza-klientov">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Единая база клиентов в одной CRM-системе
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает собирать клиентскую базу, хранить контакты, переписку, сделки, заметки и ответственных менеджеров в одной системе без хаоса и потери данных.
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
            Какие проблемы решает единая база клиентов
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без единой системы клиенты разбросаны, история теряется, а передача клиента между менеджерами забирает время и контекст.
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

      {/* Что даёт 2wix для единой базы клиентов */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix для единой базы клиентов
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Список клиентов, карточка, контакты, история, заметки, сделки и поиск — программа для клиентской базы в одной CRM.
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
            <Link to="/upravlenie-zayavkami" className="text-sf-accent font-medium hover:text-sf-primary">управление заявками</Link>.
          </p>
        </div>
      </section>

      {/* Карточка клиента */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Карточка клиента: вся информация в одном месте
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            В карточке клиента в 2wix собрано всё необходимое для работы с контактом — от имени и телефона до истории общения и сделок.
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
            От обращения клиента до полной истории в карточке — единая база клиентов и обращений в действии.
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

      {/* Почему это важно для команды */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это важно для команды
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Единая база клиентов снижает потери информации, упрощает передачу клиентов и масштабирование продаж.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_TEAM.map(({ icon: Icon, title, text }) => (
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

      {/* Клиент + переписка + сделка */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Клиент + переписка + сделка в одной системе
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Не просто контактная база — живая CRM-база, связанная с сообщениями, менеджером, сделкой, заметками и аналитикой.
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
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс: список клиентов, карточка, история, сделки
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Единая база клиентов с поиском, карточкой клиента, историей сообщений, привязанными сделками и заметками.
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

      {/* Почему лучше, чем таблицы и мессенджеры по отдельности */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это лучше, чем таблицы и мессенджеры по отдельности
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Разрозненный подход против единой базы клиентов в CRM.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Разрозненный подход
              </h3>
              <ul className="space-y-2">
                {COMPARISON_SCATTERED.map((item) => (
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
            Соберите единую базу клиентов в CRM, где вся информация всегда под рукой
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Контакты, переписка, сделки и заметки в одной системе. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
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
            Вопросы о единой базе клиентов
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о клиентской базе, карточке клиента и работе команды в 2wix.
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
            <Link to="/upravlenie-zayavkami" className={LINK_BTN_CLASS}>Управление заявками</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>Аналитика продаж</Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>Сделки и воронка</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
