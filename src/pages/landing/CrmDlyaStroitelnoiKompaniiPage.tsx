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
  Clock,
} from 'lucide-react';

const TITLE =
  'CRM для строительной компании — заявки, клиенты, сделки и контроль отдела продаж | 2wix';
const DESCRIPTION =
  'CRM для строительной компании 2wix: заявки из WhatsApp и сайта, клиентская база, сделки по этапам, контроль менеджеров и аналитика в одной системе. Универсальная CRM, которая отлично подходит для строительного бизнеса.';

const PROBLEMS = [
  {
    title: 'Заявки из WhatsApp, сайта и звонков теряются',
    text: 'Обращения остаются в личных чатах менеджеров или не доходят до учёта. CRM для заявок в строительстве собирает всё в одном месте.',
  },
  {
    title: 'Менеджеры ведут клиентов хаотично',
    text: 'Каждый по-своему: кто в таблице, кто в чатах. Нет единой системы учёта для строительной компании — трудно контролировать отдел продаж.',
  },
  {
    title: 'Сложно понять, на каком этапе клиент',
    text: 'Неясно, кто на стадии консультации, кто ждёт смету, кто готов к договору. Нет воронки и этапов — руководитель не видит картину.',
  },
  {
    title: 'Сметы, расчёты и договорённости разрознены',
    text: 'Часть в переписке, часть в почте, часть в заметках. Информация по клиенту и объекту не собрана в одной карточке.',
  },
  {
    title: 'Руководитель не видит общую картину',
    text: 'Сколько заявок пришло, сколько клиентов в работе, кто из менеджеров что ведёт — непонятно. Нет прозрачности по отделу продаж строительной компании.',
  },
  {
    title: 'Нет прозрачности по менеджерам и обращениям',
    text: 'Кто сколько обработал, где задержки с ответом, где клиент ждёт — на словах. Программа для строительной компании с контролем решает это.',
  },
  {
    title: 'Информация по клиенту теряется при передаче',
    text: 'Клиента передали другому менеджеру — история переписки и договорённостей осталась у прежнего. Система учёта для строительной компании хранит всё в карточке.',
  },
  {
    title: 'Трудно системно вести продажи объектов и услуг',
    text: 'Дома, ремонт, услуги — длинный цикл сделки, много касаний. Без CRM для строительного бизнеса контекст и этапы теряются.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: Inbox,
    title: 'Учёт входящих заявок',
    text: 'Заявки из WhatsApp, сайта, звонков — в одной CRM. CRM для заявок в строительстве без потери обращений.',
  },
  {
    icon: Users,
    title: 'Клиентская база',
    text: 'Единая база клиентов строительной компании. Контакты, история, ответственный менеджер — в одной системе.',
  },
  {
    icon: FileText,
    title: 'Карточка клиента',
    text: 'Всё по клиенту в одном месте: контакты, переписка, комментарии, сделки. Удобно для отдела продаж строительной компании.',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp-переписка в одном окне',
    text: 'Переписка с клиентом в карточке. Менеджеры работают через единый интерфейс — заявки из мессенджера не теряются.',
  },
  {
    icon: GitBranch,
    title: 'Сделки и этапы продаж',
    text: 'Воронка сделок: от первого контакта до договора. Видно, на каком этапе каждый клиент. CRM для продаж в строительстве.',
  },
  {
    icon: UserCheck,
    title: 'Менеджеры и распределение ответственности',
    text: 'Назначение ответственного по клиенту и заявке. Контроль нагрузки. Система для строительной компании с прозрачностью по команде.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика по обращениям',
    text: 'Сколько заявок пришло, сколько обработано, по каким каналам. Аналитика по отделу продаж в одной CRM.',
  },
  {
    icon: Inbox,
    title: 'Контроль непрочитанных и ожидающих',
    text: 'Где клиент ждёт ответа, где сообщения без реакции. Руководитель видит узкие места в работе с заявками.',
  },
  {
    icon: StickyNote,
    title: 'Комментарии и история общения',
    text: 'Договорённости, обещания, детали по объекту — в карточке. История не теряется при смене менеджера.',
  },
  {
    icon: Shield,
    title: 'Роли и права доступа для команды',
    text: 'Руководитель, менеджер, сотрудник — разные права. CRM для строителей с разграничением доступа к разделам.',
  },
];

const FLOW_STEPS = [
  'Клиент пишет в WhatsApp или оставляет заявку',
  'Заявка попадает в CRM',
  'Менеджер берёт клиента в работу',
  'Ведётся переписка, расчёт, консультация, этапы сделки',
  'Руководитель видит статус, активность и аналитику',
  'Команда не теряет информацию и работает в одной системе',
];

const WHAT_LEADER_SEES = [
  {
    icon: Inbox,
    title: 'Сколько пришло заявок',
    text: 'Входящие по каналам и по периодам. Руководитель строительной компании видит поток обращений.',
  },
  {
    icon: Users,
    title: 'Сколько клиентов в работе',
    text: 'Сколько клиентов на каждом этапе. CRM для отдела продаж строительной компании с наглядной картиной.',
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
    icon: BarChart3,
    title: 'Какие каналы дают обращения',
    text: 'WhatsApp, сайт, звонки — откуда приходят заявки. Аналитика для решений по каналам.',
  },
  {
    icon: LayoutDashboard,
    title: 'Как работает отдел продаж',
    text: 'Сводная картина: заявки, клиенты, сделки, менеджеры. Программа для строительной компании с прозрачностью.',
  },
];

const LINK_CHAIN = [
  { icon: Users, label: 'Клиент' },
  { icon: MessageSquare, label: 'Переписка' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: GitBranch, label: 'Сделка' },
  { icon: StickyNote, label: 'Комментарии' },
  { icon: BarChart3, label: 'Аналитика' },
];

const WHY_FOR_CONSTRUCTION = [
  {
    icon: Clock,
    title: 'Длинный цикл сделки',
    text: 'От первого обращения до договора — недели и месяцы. CRM для строительной компании хранит всю историю и этапы.',
  },
  {
    icon: MessageSquare,
    title: 'Много касаний с клиентом',
    text: 'Консультации, сметы, уточнения. Важно не терять переписку — всё в карточке клиента в одной системе.',
  },
  {
    icon: Inbox,
    title: 'Важно не терять переписку',
    text: 'Обещания, договорённости по объекту — в истории общения. Система учёта для строительной компании сохраняет контекст.',
  },
  {
    icon: StickyNote,
    title: 'Важно хранить историю и обещания',
    text: 'Что обещали, какие условия обсудили — в комментариях и переписке. При передаче клиента контекст не теряется.',
  },
  {
    icon: GitBranch,
    title: 'Важно видеть этапы и менеджеров',
    text: 'На каком этапе клиент, кто ведёт. Руководитель видит воронку и нагрузку на отдел продаж.',
  },
  {
    icon: FileText,
    title: 'Важно быстро находить контекст по клиенту',
    text: 'Один клиент — одна карточка с полной историей. CRM для строителей без поиска по чатам и таблицам.',
  },
];

const PREVIEW_MODULES = [
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: FileText, label: 'Карточка' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: BarChart3, label: 'Аналитика' },
];

const COMPARISON_MANUAL = [
  'Чаты у каждого менеджера',
  'Таблицы в разных файлах',
  'Заметки в разных местах',
  'Потеря контекста при передаче',
  'Нет контроля по заявкам',
  'Трудно анализировать',
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
    q: 'Подходит ли 2wix для строительной компании?',
    a: 'Да. 2wix — универсальная CRM, которая хорошо подходит для строительного бизнеса: заявки из WhatsApp и сайта, клиентская база, карточка клиента с перепиской и комментариями, сделки по этапам, контроль менеджеров и аналитика в одной системе. Многие строительные компании используют 2wix для отдела продаж.',
  },
  {
    q: 'Можно ли вести заявки и клиентов по объектам / направлениям?',
    a: 'Да. В 2wix ведётся учёт заявок и клиентов: каждому клиенту соответствует карточка с контактами, перепиской, сделками и комментариями. Сделки можно вести по этапам (лид, консультация, смета, договор и т.д.). CRM для строительной компании с гибкой воронкой и единой базой.',
  },
  {
    q: 'Есть ли WhatsApp и переписка в одной системе?',
    a: 'Да. Переписка из WhatsApp попадает в CRM и привязывается к карточке клиента. Менеджеры работают в едином интерфейсе — заявки из мессенджера не теряются в личных чатах. CRM для заявок в строительстве с WhatsApp в одном окне.',
  },
  {
    q: 'Можно ли контролировать менеджеров и этапы сделок?',
    a: 'Да. Руководитель видит, кто какой клиент ведёт, сколько заявок у каждого, где непрочитанные сообщения и где сделки зависли. Этапы воронки и активность менеджеров — в одной системе. Контроль отдела продаж строительной компании без ручного сбора отчётов.',
  },
  {
    q: 'Подходит ли 2wix для небольших строительных компаний?',
    a: 'Да. CRM для строительной компании полезна уже с небольшим отделом продаж: заявки не теряются, клиенты и переписка в одном месте, этапы сделок видны. Система масштабируется при росте. Подходит и для малоэтажного строительства, и для компаний с несколькими направлениями.',
  },
  {
    q: 'Можно ли использовать систему не только для стройки?',
    a: 'Да. 2wix — универсальная CRM для бизнеса: подходит для отдела продаж, работы с клиентами и заявками в разных отраслях. Строительная компания — один из сильных кейсов: длинный цикл сделки, много переписки, важна история. Но ту же систему используют и сервисные компании, и продажи услуг.',
  },
  {
    q: 'Есть ли аналитика по обращениям и продажам?',
    a: 'Да. В 2wix есть аналитика: сколько заявок пришло и обработано, по каким каналам, как движутся сделки по этапам, нагрузка по менеджерам. Руководитель строительной компании видит картину по отделу продаж в одной CRM.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const CrmDlyaStroitelnoiKompaniiPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout
      title={TITLE}
      description={DESCRIPTION}
      path="/crm-dlya-stroitelnoi-kompanii"
    >
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                CRM для строительной компании: заявки, клиенты, сделки и контроль процессов
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает строительным компаниям собирать заявки, вести клиентов, контролировать менеджеров, работать с WhatsApp, управлять сделками и видеть аналитику в одной системе.
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

      {/* Какие проблемы решает CRM в строительной компании */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Какие проблемы решает CRM в строительной компании
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

      {/* Что даёт 2wix строительной компании */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix строительной компании
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Заявки, клиенты, переписка, сделки по этапам и контроль отдела продаж — CRM для строительного бизнеса в одной системе.
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

      {/* Как это работает в строительной компании */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это работает в строительной компании
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            От заявки до контроля — всё в одной CRM для строительной компании.
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
            Прозрачность для собственника и руководителя строительной компании: заявки, клиенты, сделки, менеджеры.
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

      {/* WhatsApp + клиент + сделка + команда */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            WhatsApp + клиент + сделка + команда в одной системе
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            2wix — единая система для строительной компании: не набор разрозненных чатов и таблиц, а одна CRM.
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

      {/* Почему это особенно полезно для стройки */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это особенно полезно для строительной компании
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Длинный цикл сделки, много переписки и касаний — CRM для строителей сохраняет контекст и этапы.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_CONSTRUCTION.map(({ icon: Icon, title, text }) => (
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
            Интерфейс: WhatsApp, карточка клиента, сделки, аналитика
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            CRM для строительной компании с перепиской, этапами сделок, менеджерами и отчётами в одной системе.
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
            Ручной подход в строительной компании против CRM в одной системе.
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
            Запустите CRM для строительной компании, где заявки, клиенты и продажи под контролем
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Универсальная CRM, которая отлично подходит для строительного бизнеса. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
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
            Вопросы о CRM для строительной компании
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о 2wix для строительного бизнеса и отдела продаж.
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
            <Link to="/whatsapp-dlya-otdela-prodazh" className={LINK_BTN_CLASS}>WhatsApp для отдела продаж</Link>
            <Link to="/upravlenie-zayavkami" className={LINK_BTN_CLASS}>Управление заявками</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>Сделки и воронка</Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>Аналитика продаж</Link>
            <Link to="/kontrol-menedzherov" className={LINK_BTN_CLASS}>Контроль менеджеров</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
