import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import {
  Inbox,
  Users,
  MessageSquare,
  GitBranch,
  BarChart3,
  ArrowRight,
  Check,
  AlertCircle,
  Eye,
  Filter,
  FileSpreadsheet,
  UserPlus,
  Clock,
  StickyNote,
  LayoutDashboard,
  Zap,
  Link2,
} from 'lucide-react';

const TITLE = 'Управление заявками в CRM — учёт, распределение, контроль заявок | 2wix';
const DESCRIPTION =
  'Система управления заявками в 2wix: единый список заявок, распределение по менеджерам, привязка к клиенту и сделке. Обработка заявок в CRM без потерь. Учёт и контроль заявок для любого бизнеса.';

const PROBLEMS = [
  {
    title: 'Заявки приходят из разных каналов',
    text: 'WhatsApp, сайт, звонки, почта — всё в разных местах. Нет единого входа: часть обращений теряется или обрабатывается с задержкой.',
  },
  {
    title: 'Часть обращений теряется',
    text: 'Сообщения остаются в личных чатах, письма забываются, заявки с сайта не доходят до ответственного. Клиенты не получают ответ вовремя.',
  },
  {
    title: 'Непонятно, кто ответственный',
    text: 'Заявка пришла — кто её ведёт? Нет назначения менеджера, заявки «висят» или обрабатываются всеми подряд без учёта.',
  },
  {
    title: 'Менеджеры обрабатывают заявки хаотично',
    text: 'Нет единых правил: кто первый взял, кто перехватил. Дублирование ответов или, наоборот, заявка остаётся без ответа.',
  },
  {
    title: 'Нет истории по заявке',
    text: 'Что обещали клиенту, когда перезвонили, на каком этапе обращение — не зафиксировано. Контекст теряется при передаче или смене менеджера.',
  },
  {
    title: 'Сложно понять, на каком этапе клиент',
    text: 'Заявка обработана или ещё нет? Доведена до сделки или отвалилась? Руководитель не видит полной картины по обращениям.',
  },
  {
    title: 'Руководитель не видит, как реально обрабатываются обращения',
    text: 'Сколько заявок пришло, сколько обработано, где зависли — неизвестно. Контроль заявок возможен только «со слов» менеджеров.',
  },
];

const WHAT_2WIX_GIVES = [
  { icon: Inbox, title: 'Единый список заявок', text: 'Все обращения в одном интерфейсе. Управление заявками без разбросанных чатов и таблиц. Видно, что пришло и что в работе.' },
  { icon: UserPlus, title: 'Распределение по менеджерам', text: 'Назначьте ответственного за заявку. Понятно, кто обрабатывает каждое обращение. Можно переназначить при необходимости.' },
  { icon: Filter, title: 'Статусы и этапы обработки', text: 'Новая, в работе, ответ дан, сделка создана. Контроль заявок по статусам и фильтрам — видно, где что застряло.' },
  { icon: Users, title: 'Привязка к клиенту', text: 'Заявка связана с карточкой клиента. История обращений в одном месте. Учёт заявок с привязкой к контакту.' },
  { icon: GitBranch, title: 'Привязка к сделке', text: 'Обращение можно превратить в сделку. Заявка → клиент → сделка — полная цепочка в CRM. Обработка заявок с выходом в воронку.' },
  { icon: MessageSquare, title: 'История коммуникации', text: 'Вся переписка по заявке сохраняется. Что писали, когда ответили — видно в карточке клиента и в истории.' },
  { icon: MessageSquare, title: 'WhatsApp и переписка', text: 'Заявки из мессенджера попадают в CRM. Ответ из одного интерфейса. Не нужно искать чаты в личных аккаунтах.' },
  { icon: Filter, title: 'Фильтры по непрочитанным и ожидающим', text: 'Быстро найти заявки, которые ждут ответа. Контроль сроков реакции и качества обработки обращений.' },
  { icon: StickyNote, title: 'Комментарии и заметки', text: 'Добавляйте заметки к заявке и клиенту. Договорённости и детали видны всей команде. Учёт заявок с контекстом.' },
  { icon: Clock, title: 'Контроль сроков реакции', text: 'Видно, как быстро обрабатываются обращения. Менеджеры не «забывают» заявки — всё в едином списке и с статусами.' },
];

const FLOW_STEPS = [
  'Клиент оставляет заявку или пишет',
  'Заявка попадает в 2wix',
  'Назначается ответственный менеджер',
  'Менеджер связывается с клиентом',
  'Заявка превращается в сделку',
  'Руководитель видит статус и результат',
];

const FOR_LEADER = [
  { icon: Inbox, title: 'Видно, сколько пришло заявок', text: 'Все обращения в одном месте. Руководитель видит входящий поток без опросов менеджеров.' },
  { icon: Users, title: 'Видно, кто их обрабатывает', text: 'По каждой заявке назначен ответственный. Контроль заявок: кто что ведёт и не зависло ли обращение.' },
  { icon: AlertCircle, title: 'Видно, где заявки зависли', text: 'Статусы и фильтры показывают, что ждёт ответа или застряло. Можно точечно подключаться и ускорять обработку.' },
  { icon: GitBranch, title: 'Видно, сколько доведено до сделки', text: 'Связь заявка → сделка. Конверсия от обращения до сделки. Оценка эффективности обработки заявок.' },
  { icon: Eye, title: 'Можно быстро находить узкие места', text: 'Где очередь, где задержки, у кого перегруз — данные в CRM. Решения на основе фактов, а не ощущений.' },
  { icon: Zap, title: 'Меньше потери клиентов', text: 'Заявки не теряются в чатах и почте. Единая система учёта заявок — меньше пропущенных обращений и недовольных клиентов.' },
];

const CHAIN_ITEMS = [
  { label: 'Заявка', icon: Inbox },
  { label: 'Клиент', icon: Users },
  { label: 'Переписка', icon: MessageSquare },
  { label: 'Менеджер', icon: UserPlus },
  { label: 'Сделка', icon: GitBranch },
  { label: 'Аналитика', icon: BarChart3 },
];

const COMPARISON_MANUAL = [
  'Таблицы, которые кто-то ведёт',
  'Пересылка заявок в чатах',
  'Потеря обращений',
  'Нет явного ответственного',
  'Сложно контролировать сроки',
];

const COMPARISON_2WIX = [
  'Все заявки в одной системе',
  'Есть ответственный за каждую',
  'Есть статус обработки',
  'Есть история по заявке',
  'Есть связь с клиентом и сделкой',
  'Есть аналитика по обращениям',
];

const PREVIEW_ITEMS = [
  { label: 'Список заявок', icon: Inbox },
  { label: 'Карточка клиента', icon: Users },
  { label: 'WhatsApp и чаты', icon: MessageSquare },
  { label: 'Сделки', icon: GitBranch },
  { label: 'Фильтры и статусы', icon: Filter },
  { label: 'Аналитика по обращениям', icon: BarChart3 },
];

const FAQ_ITEMS = [
  {
    q: 'Можно ли вести заявки в 2wix?',
    a: 'Да. В 2wix есть единый список заявок и обращений. Заявки привязываются к клиентам, назначается ответственный менеджер, ведётся учёт заявок со статусами. Обработка заявок в CRM — без потерь и хаоса.',
  },
  {
    q: 'Можно ли назначать ответственного за заявку?',
    a: 'Да. На каждую заявку или клиента можно назначить ответственного менеджера. Видно, кто что обрабатывает. Руководитель контролирует распределение и может переназначить заявку.',
  },
  {
    q: 'Можно ли видеть статус обработки?',
    a: 'Да. Заявки имеют статусы, можно фильтровать по непрочитанным, ожидающим ответа, в работе. Контроль заявок и сроков реакции — в одном интерфейсе.',
  },
  {
    q: 'Можно ли связать заявку с клиентом и сделкой?',
    a: 'Да. Заявка привязывается к карточке клиента. Из заявки можно создать сделку и вести её по этапам воронки. Вся цепочка: обращение → клиент → переписка → сделка — в одной системе.',
  },
  {
    q: 'Есть ли история общения по заявке?',
    a: 'Да. Вся переписка с клиентом сохраняется в его карточке. История по заявке не теряется — видно, что писали, когда ответили, какие договорённости.',
  },
  {
    q: 'Подходит ли это для малого бизнеса?',
    a: 'Да. Управление заявками в CRM полезно и для малого бизнеса: даже при небольшом потоке важно не терять обращения, назначать ответственных и видеть статусы. Запуск без сложного внедрения.',
  },
  {
    q: 'Можно ли работать через WhatsApp?',
    a: 'Да. Заявки из WhatsApp попадают в 2wix и отображаются в общем списке. Ответы можно давать из CRM. Переписка привязывается к клиенту и заявке. Подробнее — в разделе WhatsApp CRM.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const UpravlenieZayavkamiPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/upravlenie-zayavkami">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Управление заявками в CRM: без потерь, хаоса и ручного контроля
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Собирайте и обрабатывайте заявки в одной системе. 2wix помогает не терять обращения, распределять заявки между менеджерами, связывать их с клиентами и сделками и видеть весь процесс в одном интерфейсе.
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
                    <Inbox className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">Управление заявками</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Заявки', 'Клиенты', 'Сделки', 'Статусы'].map((label) => (
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Какие проблемы решает управление заявками в CRM</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы заявки разбросаны, теряются, непонятно кто ответственный и на каком этапе каждое обращение.
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

      {/* Что даёт 2wix для управления заявками */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что даёт 2wix для управления заявками</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Единый список заявок, распределение по менеджерам, статусы, привязка к клиенту и сделке — учёт и контроль заявок в одной системе.
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

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает</h2>
          <p className="text-sf-text-secondary text-center mb-14">От обращения до сделки — заявки не теряются и ведут к результату</p>
          <ol className="space-y-4">
            {FLOW_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-5">
                <span className="flex-shrink-0 w-10 h-10 rounded-sfCard bg-sf-primary text-sf-text-inverse font-bold flex items-center justify-center">{i + 1}</span>
                <span className="font-medium text-sf-text-primary">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Контроль заявок для руководителя */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Контроль заявок для руководителя</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Видно, сколько пришло обращений, кто обрабатывает, где заявки зависли и сколько доведено до сделки.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FOR_LEADER.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm">
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

      {/* Заявки + WhatsApp + Сделки */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Заявки, клиент, переписка, сделка — в одной цепочке</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            В 2wix заявки не живут отдельно: обращение привязано к клиенту, переписке, менеджеру и сделке. Полный цикл от первого контакта до результата. Узнайте больше про <Link to="/upravlenie-klientami" className="text-sf-accent font-medium hover:text-sf-primary">управление клиентами</Link> и <Link to="/whatsapp-crm" className="text-sf-accent font-medium hover:text-sf-primary">WhatsApp CRM</Link>.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {CHAIN_ITEMS.map(({ label, icon: Icon }, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-2 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-6 py-5 min-w-[120px]">
                  <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="font-medium text-sf-text-primary text-sm text-center">{label}</span>
                </div>
                {i < CHAIN_ITEMS.length - 1 && (
                  <div className="hidden sm:flex items-center text-sf-text-muted">
                    <Link2 className="w-5 h-5" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Почему лучше чем вручную */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему это лучше, чем вести заявки вручную</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Система управления заявками вместо таблиц и пересылок в чатах.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Ручной подход
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

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс: заявки, клиенты, сделки</h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Список заявок, карточка клиента, WhatsApp, сделки, фильтры и аналитика — в одной CRM для управления заявками.
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
            Управляйте заявками в CRM, где всё под контролем — от первого обращения до сделки
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Не теряйте обращения. Собирайте, распределяйте и доводите заявки до результата в одной системе.
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
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы об управлении заявками</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы об учёте и обработке заявок в 2wix</p>
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
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>Аналитика продаж</Link>
            <Link to="/kontrol-menedzherov" className={LINK_BTN_CLASS}>Контроль менеджеров</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
