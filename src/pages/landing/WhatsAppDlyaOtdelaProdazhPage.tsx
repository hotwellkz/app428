import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicProductPreview } from '../../public/components/PublicProductPreview';
import {
  MessageSquare,
  Users,
  GitBranch,
  ArrowRight,
  Check,
  AlertCircle,
  Eye,
  LayoutDashboard,
  BarChart3,
  Filter,
  FileText,
  Zap,
  Inbox,
  Clock,
  UserCheck,
  Link2,
} from 'lucide-react';

const TITLE =
  'WhatsApp для отдела продаж — CRM для продаж через WhatsApp, контроль менеджеров | 2wix';
const DESCRIPTION =
  'WhatsApp для отдела продаж в одной CRM: распределение чатов между менеджерами, связь переписки с клиентом и сделкой, контроль команды. Продажи через WhatsApp без хаоса и потери клиентов.';

const PROBLEMS = [
  {
    title: 'Менеджеры пишут клиентам хаотично',
    text: 'Каждый в своём WhatsApp, переписка размазана по личным аккаунтам. Нет единого места — руководитель не видит полной картины и не может контролировать качество.',
  },
  {
    title: 'Часть диалогов теряется',
    text: 'Заявки остаются в личных чатах. Сообщение пришло — менеджер забыл ответить или ушёл. Без CRM в отделе продаж обращения теряются.',
  },
  {
    title: 'Руководитель не видит, кто что отвечает',
    text: 'Нет прозрачности: кто с кем общается, сколько чатов в работе, где клиент ждёт слишком долго. Контроль менеджеров в WhatsApp отсутствует.',
  },
  {
    title: 'Клиентская история не хранится централизованно',
    text: 'Переписка в телефонах сотрудников. При смене менеджера контекст теряется. Нет единой карточки клиента с историей общения.',
  },
  {
    title: 'Сложно передавать диалоги между менеджерами',
    text: 'Клиент передан другому менеджеру — история чата осталась у прежнего. Передача клиента в отделе продаж превращается в ручную переписку.',
  },
  {
    title: 'WhatsApp живёт отдельно от сделок',
    text: 'Переписка в мессенджере, сделки в таблице или другой системе. Нет связи: что обсудили в WhatsApp — не видно в карточке сделки.',
  },
  {
    title: 'Нет прозрачности по скорости ответа и качеству обработки',
    text: 'Кто отвечает быстро, кто затягивает — непонятно. Нет метрик по работе отдела продаж с входящими в WhatsApp.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: MessageSquare,
    title: 'Единый WhatsApp-интерфейс',
    text: 'Менеджеры работают с клиентами в одном интерфейсе. Чаты не размазаны по личным телефонам — всё в CRM для WhatsApp-продаж.',
  },
  {
    icon: Users,
    title: 'Распределение чатов между менеджерами',
    text: 'Назначайте ответственного за диалог. Видно, у кого сколько чатов в работе. Распределение нагрузки и передача клиента — без потери контекста.',
  },
  {
    icon: Inbox,
    title: 'Контроль непрочитанных сообщений',
    text: 'Сколько сообщений ждёт ответа у каждого менеджера. Где клиент ждёт слишком долго. Руководитель видит узкие места в работе отдела.',
  },
  {
    icon: FileText,
    title: 'История переписки по клиенту',
    text: 'Вся переписка хранится в карточке клиента. Смена менеджера — история остаётся в CRM. Централизованная клиентская база и чаты.',
  },
  {
    icon: Link2,
    title: 'Связь чата с карточкой клиента',
    text: 'Сообщение из WhatsApp автоматически привязано к клиенту. Один клиент — одна карточка, одна история. Работа отдела продаж в WhatsApp связана с базой.',
  },
  {
    icon: GitBranch,
    title: 'Связь чата со сделкой',
    text: 'Из переписки создаётся и ведётся сделка. Что обсудили в WhatsApp — видно в воронке. CRM для WhatsApp-продаж без разрывов.',
  },
  {
    icon: Zap,
    title: 'Быстрые ответы и шаблоны',
    text: 'Готовые ответы на типовые вопросы. Менеджеры отвечают быстрее, единый тон коммуникации. Подробнее — в разделе быстрых ответов.',
  },
  {
    icon: Eye,
    title: 'Контроль команды',
    text: 'Руководитель видит, кто отвечает клиентам, сколько чатов в работе, где задержки. Контроль менеджеров в WhatsApp через одну систему.',
  },
  {
    icon: Filter,
    title: 'Фильтры по статусам',
    text: 'Чаты по статусу: новые, в работе, ожидают ответа. Быстро найти диалоги, требующие внимания. Удобная работа отдела продаж с входящими.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика по работе с сообщениями',
    text: 'Сколько обращений обработано, скорость ответа, нагрузка по менеджерам. Цифры по продажам через WhatsApp в одной CRM.',
  },
];

const FLOW_STEPS = [
  'Клиент пишет в WhatsApp',
  'Диалог попадает в 2wix',
  'Назначается менеджер',
  'Менеджер общается с клиентом в CRM',
  'Из переписки создаётся или ведётся сделка',
  'Руководитель видит весь процесс: чаты, клиенты, сделки',
];

const WHAT_LEADER_SEES = [
  {
    icon: Users,
    title: 'Кто отвечает клиентам',
    text: 'По каждому чату и клиенту видно ответственного менеджера. Прозрачность работы отдела продаж в WhatsApp.',
  },
  {
    icon: Inbox,
    title: 'Сколько чатов в работе',
    text: 'У кого сколько диалогов. Нагрузка распределена или кто-то перегружен — видно сразу.',
  },
  {
    icon: AlertCircle,
    title: 'Где есть непрочитанные',
    text: 'Какие сообщения ждут ответа. Руководитель может точечно напомнить или перераспределить чаты.',
  },
  {
    icon: Clock,
    title: 'Где клиент ждёт слишком долго',
    text: 'Задержки с ответом видны в системе. Контроль качества работы с клиентами и скорости реакции.',
  },
  {
    icon: UserCheck,
    title: 'Кто из менеджеров перегружен',
    text: 'Сводная картина по нагрузке. Распределение входящих из WhatsApp между менеджерами отдела продаж.',
  },
  {
    icon: BarChart3,
    title: 'Как WhatsApp влияет на сделки и продажи',
    text: 'Связь переписки с воронкой и сделками. Аналитика: от первого сообщения до закрытой сделки.',
  },
];

const LINK_CHAIN = [
  { icon: MessageSquare, label: 'Сообщение' },
  { icon: Users, label: 'Клиент' },
  { icon: UserCheck, label: 'Менеджер' },
  { icon: Filter, label: 'Статус' },
  { icon: GitBranch, label: 'Сделка' },
  { icon: BarChart3, label: 'Аналитика' },
];

const WHO_ITS_FOR = [
  'Отделы продаж',
  'Малый бизнес',
  'Компании с входящими заявками в WhatsApp',
  'Сервисные компании',
  'Производство',
  'Строительство',
  'Компании, где несколько менеджеров ведут клиентов',
];

const COMPARISON_USUAL = [
  'Всё вперемешку в личных чатах',
  'Нет контроля команды',
  'Нет истории в CRM',
  'Сложно передать клиента другому менеджеру',
  'Сделки живут отдельно от переписки',
];

const COMPARISON_2WIX = [
  'Централизованная работа в одной системе',
  'Видимость для руководителя: кто что ведёт',
  'Связь с клиентом и сделкой',
  'Распределение чатов между менеджерами',
  'Меньше потерь и хаоса в отделе продаж',
];

const PREVIEW_MODULES = [
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: Users, label: 'Менеджеры' },
  { icon: Inbox, label: 'Чаты' },
];

const FAQ_ITEMS = [
  {
    q: 'Можно ли использовать 2wix для продаж через WhatsApp?',
    a: 'Да. 2wix — это CRM для WhatsApp-продаж: единый интерфейс для команды, распределение чатов между менеджерами, связь переписки с карточкой клиента и сделкой. Руководитель видит, кто отвечает, сколько чатов в работе и как переписка влияет на сделки.',
  },
  {
    q: 'Можно ли распределять чаты между менеджерами?',
    a: 'Да. В 2wix каждому диалогу можно назначить ответственного менеджера. Видно, у кого сколько чатов в работе. Чаты можно передавать между сотрудниками без потери истории — всё хранится в карточке клиента.',
  },
  {
    q: 'Видно ли руководителю переписку?',
    a: 'Да. Руководитель видит переписку с клиентами в CRM: кто с кем общается, какие сообщения ждут ответа, где есть задержки. Контроль менеджеров в WhatsApp без тотальной слежки — по факту работы в системе.',
  },
  {
    q: 'Можно ли связать WhatsApp с карточкой клиента и сделкой?',
    a: 'Да. Сообщение из WhatsApp автоматически привязывается к клиенту. Из переписки можно создавать и вести сделку. В карточке клиента — вся история общения и связанные сделки. Одна система вместо разрозненных чатов и таблиц.',
  },
  {
    q: 'Есть ли быстрые ответы?',
    a: 'Да. В 2wix есть шаблоны и быстрые ответы для типовых вопросов. Менеджеры отвечают быстрее, тон коммуникации единый. Удобно для отдела продаж с большим потоком обращений в WhatsApp.',
  },
  {
    q: 'Подходит ли это для небольшого отдела продаж?',
    a: 'Да. Даже с двумя-тремя менеджерами важно не терять заявки, хранить историю в одном месте и видеть, кто что ведёт. Система масштабируется при росте команды.',
  },
  {
    q: 'Можно ли контролировать, кто отвечает клиентам?',
    a: 'Да. В 2wix видно, кто ответственный по каждому чату и клиенту. Руководитель видит нагрузку по менеджерам, непрочитанные сообщения и задержки с ответом. Контроль отдела продаж в WhatsApp — в одной CRM.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const WhatsAppDlyaOtdelaProdazhPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/whatsapp-dlya-otdela-prodazh">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                WhatsApp для отдела продаж в одной CRM
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает команде продаж работать с клиентами в WhatsApp: распределять диалоги, не терять обращения, контролировать менеджеров и связывать переписку со сделками в одной системе.
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
            Какие проблемы решает WhatsApp в отделе продаж
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без CRM переписка хаотична, диалоги теряются, руководитель не видит картины, а сделки живут отдельно от WhatsApp.
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

      {/* Что даёт 2wix для работы через WhatsApp */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix для работы отдела продаж через WhatsApp
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Единый интерфейс, распределение чатов, связь с клиентом и сделкой, контроль команды — CRM для WhatsApp-продаж.
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
            Подробнее о возможностях — в разделе{' '}
            <Link to="/whatsapp-crm" className="text-sf-accent font-medium hover:text-sf-primary">WhatsApp CRM</Link> и{' '}
            <Link to="/upravlenie-zayavkami" className="text-sf-accent font-medium hover:text-sf-primary">управление заявками</Link>.
          </p>
        </div>
      </section>

      {/* Как это работает в отделе продаж */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это работает в отделе продаж
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            От первого сообщения в WhatsApp до сделки и контроля — всё в одной CRM.
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
            Прозрачность работы отдела продаж в WhatsApp: кто отвечает, где задержки, как переписка влияет на сделки.
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
            Детали контроля команды — на странице{' '}
            <Link to="/kontrol-menedzherov" className="text-sf-accent font-medium hover:text-sf-primary">контроль менеджеров</Link>.
          </p>
        </div>
      </section>

      {/* WhatsApp + клиент + сделка */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            WhatsApp + клиент + сделка в одной системе
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            В 2wix переписка не оторвана от остальной CRM: сообщение, клиент, менеджер, статус, сделка и аналитика связаны.
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

      {/* Кому подходит */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Кому подходит WhatsApp для отдела продаж в CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-10">
            Любой бизнес, где менеджеры продают через WhatsApp, принимают заявки и общаются с клиентами в переписке.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {WHO_ITS_FOR.map((item) => (
              <span
                key={item}
                className="px-4 py-2.5 rounded-sfCard border border-sf-border bg-sf-surface text-sf-text-secondary font-medium text-sm shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс: чаты, клиенты, менеджеры, сделки
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Список чатов, карточка клиента, связка с менеджером, сделка рядом с перепиской, фильтры и непрочитанные — в одной CRM.
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

      {/* Почему лучше, чем обычный WhatsApp */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это лучше, чем обычный WhatsApp
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Сравнение: личные чаты и хаос против централизованной работы отдела продаж в CRM.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                Обычный WhatsApp
              </h3>
              <ul className="space-y-2">
                {COMPARISON_USUAL.map((item) => (
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
            Подключите WhatsApp к отделу продаж и работайте с клиентами в одной CRM
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Распределение чатов, связь с клиентом и сделкой, контроль менеджеров. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
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
            Вопросы о WhatsApp для отдела продаж
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о продажах через WhatsApp, контроле менеджеров и CRM для команды.
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
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/upravlenie-zayavkami" className={LINK_BTN_CLASS}>Управление заявками</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/kontrol-menedzherov" className={LINK_BTN_CLASS}>Контроль менеджеров</Link>
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
