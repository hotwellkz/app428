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
  Eye,
  LayoutDashboard,
  Inbox,
  Clock,
  Filter,
  FileSpreadsheet,
  Shield,
  Zap,
  Target,
  Activity,
  TrendingUp,
} from 'lucide-react';

const TITLE = 'Контроль менеджеров в CRM — заявки, переписка, сделки, аналитика по команде | 2wix';
const DESCRIPTION =
  'Система контроля менеджеров и отдела продаж в 2wix: заявки, переписка, сделки, нагрузка и активность в одной CRM. Учёт работы менеджеров и прозрачность для руководителя.';

const PROBLEMS = [
  {
    title: 'Непонятно, кто из менеджеров реально работает',
    text: 'Нет прозрачности: кто сколько заявок обработал, кто отвечает быстро, а кто затягивает. Руководитель узнаёт о проблемах постфактум.',
  },
  {
    title: 'Заявки теряются или обрабатываются с задержкой',
    text: 'Сообщения остаются в личных чатах менеджеров. Часть заявок не получает ответа вовремя, часть теряется. Контроль невозможен.',
  },
  {
    title: 'Переписка ведётся хаотично',
    text: 'Каждый менеджер в своих мессенджерах. Нет единой истории, нельзя проверить качество ответов и скорость реакции.',
  },
  {
    title: 'Трудно оценить нагрузку на сотрудников',
    text: 'Кто перегружен, кто простаивает — непонятно. Распределение клиентов и заявок неочевидно, решения принимаются вслепую.',
  },
  {
    title: 'Руководитель не видит, кто отвечает быстро, а кто тормозит',
    text: 'Нет метрик по скорости ответа и количеству обработанных обращений. Субъективные отчёты вместо объективных цифр.',
  },
  {
    title: 'Нет прозрачности по сделкам и клиентам',
    text: 'Кто какой клиент ведёт, на каком этапе сделки — размазано по таблицам и переписке. Контроль отдела продаж слабый.',
  },
  {
    title: 'Нет единой системы контроля',
    text: 'Отчёты в чате, данные в Excel, часть в мессенджерах. Руководитель тратит время на сбор информации вместо управления.',
  },
];

const WHAT_CONTROL = [
  { icon: Inbox, title: 'Новые заявки по менеджерам', text: 'Видно, кто сколько заявок получил и обработал. Распределение входящего потока и нагрузка по команде.' },
  { icon: Users, title: 'Распределение клиентов', text: 'У кого сколько клиентов в работе. Можно балансировать нагрузку и переназначать контакты.' },
  { icon: MessageSquare, title: 'Непрочитанные и ожидающие чаты', text: 'Сколько сообщений ждут ответа у каждого менеджера. Контроль скорости реакции и качества работы с клиентами.' },
  { icon: Clock, title: 'Скорость ответа', text: 'Как быстро менеджеры реагируют на обращения. Объективные метрики вместо «на словах».' },
  { icon: GitBranch, title: 'Количество сделок в работе', text: 'Сколько сделок ведёт каждый менеджер, на каких этапах. Прозрачность по воронке и результативности.' },
  { icon: Filter, title: 'Статус клиентов', text: 'По каждому клиенту видно ответственного и этап. Руководитель в курсе, кто что ведёт.' },
  { icon: Activity, title: 'Нагрузка на менеджера', text: 'Сводная картина: заявки, чаты, сделки. Понятно, кто перегружен, кому можно дать больше.' },
  { icon: BarChart3, title: 'История действий', text: 'Действия фиксируются в CRM. Можно оценить активность и последовательность работы с клиентами.' },
  { icon: LayoutDashboard, title: 'Аналитика по менеджерам', text: 'Отчёты по каждому: обработанные заявки, сделки, конверсия. Контроль работы отдела продаж на цифрах.' },
  { icon: Eye, title: 'Прозрачность по этапам', text: 'Воронка и этапы сделок видны по менеджерам. Где просадки и кто двигает клиентов быстрее.' },
];

const COMMUNICATION_CONTROL = [
  { icon: MessageSquare, title: 'Вся переписка в одном месте', text: 'Чаты с клиентами не размазаны по личным аккаунтам. Вся коммуникация в CRM — руководитель видит полную картину.' },
  { icon: Eye, title: 'Руководитель видит, кто и как отвечает', text: 'Можно проверить качество ответов, тон и скорость. Контроль коммуникаций без тотальной слежки — по факту работы.' },
  { icon: MessageSquare, title: 'Единый WhatsApp-интерфейс', text: 'Менеджеры работают через общий интерфейс. Заявки из мессенджера не теряются и попадают в учёт. Подробнее — в разделе WhatsApp CRM.' },
  { icon: Shield, title: 'Менеджеры не уводят общение в личные каналы', text: 'Переписка остаётся в системе. Клиенты не «уезжают» в личный WhatsApp сотрудника — база и история принадлежат компании.' },
  { icon: BarChart3, title: 'История сохраняется', text: 'Вся переписка привязана к клиенту и сохраняется. При смене менеджера контекст не теряется.' },
];

const DEALS_CONTROL = [
  { icon: GitBranch, title: 'Видно, сколько сделок у каждого менеджера', text: 'Сколько сделок в работе, сколько на каждом этапе. Нагрузка и результативность по каждому.' },
  { icon: Filter, title: 'Видно, на каком этапе клиент', text: 'По каждой сделке — этап воронки. Руководитель понимает, где каждый клиент и кто за него отвечает.' },
  { icon: AlertCircle, title: 'Видно, где просадки', text: 'Где сделки застревают, у кого мало движения по этапам. Можно точечно помогать и корректировать работу.' },
  { icon: TrendingUp, title: 'Отслеживание движения по воронке', text: 'Как сделки переходят между этапами. Контроль отдела продаж и конверсии в реальном времени.' },
  { icon: Target, title: 'Легко оценивать результативность', text: 'Кто сколько закрыл, кто быстрее ведёт. Объективная оценка работы менеджеров на основе данных CRM.' },
];

const WHY_FOR_LEADER = [
  { icon: Zap, title: 'Меньше хаоса', text: 'Один источник правды: заявки, чаты, сделки в одной системе. Нет разрозненных таблиц и переписок для отчётов.' },
  { icon: Eye, title: 'Больше прозрачности', text: 'Видно, кто что делает. Контроль менеджеров и отдела продаж без ежедневных созвонов «как дела».' },
  { icon: AlertCircle, title: 'Видно слабые места команды', text: 'Где задержки, где мало обработанных заявок, где сделки стоят. Можно развивать и обучать точечно.' },
  { icon: LayoutDashboard, title: 'Легко принимать решения', text: 'Данные в реальном времени. Решения по нагрузке, мотивации и процессам — на основе фактов.' },
  { icon: GitBranch, title: 'Видно, где теряются лиды', text: 'На каком этапе отваливаются клиенты и у кого. Управление воронкой и качеством работы с заявками.' },
  { icon: Users, title: 'Проще управлять ростом отдела продаж', text: 'При добавлении менеджеров — понятная система учёта и контроля. Масштабирование без потери прозрачности.' },
];

const FLOW_STEPS = [
  'Заявки и сообщения попадают в 2wix',
  'Менеджеры берут клиентов в работу',
  'Все действия фиксируются в CRM',
  'Руководитель видит чаты, сделки и статусы',
  'Аналитика показывает реальную картину по команде',
];

const COMPARISON_MANUAL = [
  'Отчёты в чате и на словах',
  'Таблицы, которые кто-то ведёт',
  'Разрозненные сообщения и выгрузки',
  'Задержки с актуальностью данных',
  'Субъективная оценка работы',
];

const COMPARISON_2WIX = [
  'Данные в реальном времени',
  'Всё в одной системе',
  'Видно по каждому менеджеру',
  'Видно по сделкам и этапам',
  'Видно по коммуникациям с клиентами',
];

const PREVIEW_ITEMS = [
  { label: 'Аналитика по менеджерам', icon: BarChart3 },
  { label: 'Показатели по команде', icon: Users },
  { label: 'WhatsApp и чаты', icon: MessageSquare },
  { label: 'Фильтры по чатам', icon: Filter },
  { label: 'Сделки и воронка', icon: GitBranch },
  { label: 'Панель руководителя', icon: LayoutDashboard },
];

const FAQ_ITEMS = [
  {
    q: 'Можно ли контролировать работу менеджеров в 2wix?',
    a: 'Да. В 2wix руководитель видит заявки по менеджерам, распределение клиентов, непрочитанные и ожидающие чаты, скорость ответа, количество сделок в работе и аналитику по каждому. Контроль менеджеров и отдела продаж строится на данных из CRM, а не на устных отчётах.',
  },
  {
    q: 'Видно ли, кто отвечает клиентам?',
    a: 'Да. Вся переписка с клиентами ведётся в CRM. Руководитель видит, кто с кем общается, сколько сообщений ждёт ответа и как быстро менеджеры реагируют. Переписка не уходит в личные мессенджеры — она в системе.',
  },
  {
    q: 'Можно ли отслеживать переписку и сделки?',
    a: 'Да. Переписка привязана к клиентам и видна в карточках. Сделки по каждому менеджеру и по этапам воронки отображаются в отчётах и на панели. Контроль переписки и сделок — в одном месте.',
  },
  {
    q: 'Есть ли аналитика по менеджерам?',
    a: 'Да. В 2wix есть аналитика по менеджерам: сколько заявок обработано, сколько чатов и сделок в работе, скорость ответа, движение по воронке. Это помогает объективно оценивать работу и нагрузку команды.',
  },
  {
    q: 'Подходит ли это для небольшой команды?',
    a: 'Да. Контроль менеджеров в CRM полезен и для небольшой команды: даже с двумя-тремя менеджерами важно видеть, кто что ведёт, не теряются ли заявки и как идёт переписка. Система масштабируется при росте отдела.',
  },
  {
    q: 'Можно ли использовать 2wix для контроля отдела продаж?',
    a: 'Да. 2wix подходит для контроля отдела продаж: заявки, переписка, сделки по этапам, распределение клиентов и аналитика по менеджерам — в одной системе. Руководитель видит реальную картину без ручного сбора отчётов.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const KontrolMenedzherovPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/kontrol-menedzherov">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Контроль менеджеров в CRM: заявки, переписка, сделки и результаты
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Видьте, как реально работает команда продаж. 2wix помогает руководителю контролировать заявки, переписку, нагрузку, сделки и активность менеджеров в одной системе.
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
                    <span className="font-semibold text-sf-text-primary">Контроль менеджеров</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Заявки', 'Чаты', 'Сделки', 'Аналитика'].map((label) => (
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Какие проблемы решает контроль менеджеров в CRM</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без единой системы непонятно, кто как работает, заявки теряются, а прозрачность по отделу продаж отсутствует.
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

      {/* Что можно контролировать в 2wix */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что можно контролировать в 2wix</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Заявки, распределение клиентов, переписка, сделки и аналитика по менеджерам — в одной системе контроля отдела продаж.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_CONTROL.map(({ icon: Icon, title, text }) => (
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

      {/* Контроль переписки и коммуникаций */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Контроль переписки и коммуникаций</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Вся переписка в одном месте — руководитель видит, кто и как отвечает клиентам. Подробнее о работе с чатами — в разделе <Link to="/whatsapp-crm" className="text-sf-accent font-medium hover:text-sf-primary">WhatsApp CRM</Link>.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMMUNICATION_CONTROL.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6">
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

      {/* Контроль сделок и этапов */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Контроль сделок и этапов</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Видно, сколько сделок у каждого менеджера, на каком этапе клиенты и где есть просадки.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEALS_CONTROL.map(({ icon: Icon, title, text }) => (
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

      {/* Чем это полезно руководителю */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Чем это полезно руководителю</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Меньше хаоса, больше прозрачности и решений на основе данных — управление менеджерами в CRM становится понятным.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_LEADER.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6">
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

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает</h2>
          <p className="text-sf-text-secondary text-center mb-14">От заявок до полной прозрачности по команде — данные в CRM обновляются автоматически</p>
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

      {/* Почему 2wix лучше ручного контроля */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему 2wix лучше ручного контроля</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Система контроля менеджеров вместо отчётов в чате и разрозненных таблиц.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Ручной контроль
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
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс контроля</h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Аналитика по менеджерам, чаты, сделки и панель руководителя — в одной CRM.
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
            Контролируйте менеджеров, заявки и продажи в одной CRM
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Прозрачность по команде, переписке и сделкам. Начните бесплатно.
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы о контроле менеджеров</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы о контроле отдела продаж и работе с командой в 2wix</p>
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
          <h2 className="text-2xl font-bold text-sf-text-primary text-center mb-10">Полезные разделы</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className={LINK_BTN_CLASS}>Главная</Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>Аналитика продаж</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
