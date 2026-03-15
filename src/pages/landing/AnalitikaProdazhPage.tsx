import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import {
  BarChart3,
  TrendingUp,
  Users,
  GitBranch,
  MessageSquare,
  ArrowRight,
  Check,
  AlertCircle,
  LayoutDashboard,
  Eye,
  FileSpreadsheet,
  Zap,
  Inbox,
  Filter,
  PieChart,
  Clock,
} from 'lucide-react';

const TITLE = 'Аналитика продаж в CRM — отчёты, воронка, контроль менеджеров | 2wix';
const DESCRIPTION =
  'Система аналитики продаж в 2wix: заявки, сделки по этапам, конверсия, отчёты по менеджерам. Контроль продаж и воронки в реальном времени. Аналитика заявок для руководителя.';

const PROBLEMS = [
  {
    title: 'Руководитель не видит реальную картину',
    text: 'Сколько заявок пришло, сколько в работе, где застряли сделки — неизвестно. Приходится спрашивать у менеджеров и собирать отчёты вручную.',
  },
  {
    title: 'Заявки есть, но непонятно, сколько качественных',
    text: 'Нет связи между заявкой, сделкой и результатом. Сложно оценить конверсию и качество входящего потока.',
  },
  {
    title: 'Не видно, кто из менеджеров реально работает',
    text: 'Нет прозрачности по нагрузке и результатам. Кто сколько обработал, кто быстрее отвечает, где просадки — неясно.',
  },
  {
    title: 'Сложно понять, где теряются клиенты',
    text: 'На каком этапе воронки отваливаются лиды, почему не доходят до сделки — данные размазаны по чатам и таблицам.',
  },
  {
    title: 'Воронка есть, но цифры по этапам не прозрачны',
    text: 'Этапы сделок есть, но сводной картины нет. Сколько на каждом этапе, как движется конверсия — считают вручную или не считают.',
  },
  {
    title: 'Отчёты собираются вручную',
    text: 'Таблицы, выгрузки, созвоны для «как дела». Время уходит на сбор данных вместо анализа и решений.',
  },
  {
    title: 'Данные разбросаны по таблицам и чатам',
    text: 'Часть в Excel, часть в мессенджерах, часть в головах. Нет единого источника правды для аналитики продаж.',
  },
];

const WHAT_ANALYTICS = [
  { icon: Inbox, title: 'Заявки сегодня и за период', text: 'Сколько заявок пришло, обработано, в работе. Аналитика заявок по дням и выбранному периоду.' },
  { icon: Users, title: 'Новые клиенты', text: 'Динамика новых контактов. Видно, как растёт база и откуда приходят клиенты.' },
  { icon: GitBranch, title: 'Сделки по этапам', text: 'Воронка продаж: сколько сделок на каждом этапе. Конверсия между этапами и движение по воронке.' },
  { icon: TrendingUp, title: 'Конверсия по воронке', text: 'От заявки до сделки: где теряются клиенты, какой процент доходит до закрытия.' },
  { icon: Users, title: 'Активность менеджеров', text: 'Аналитика по менеджерам: сколько заявок обработано, сколько чатов в работе, сколько сделок ведёт каждый.' },
  { icon: MessageSquare, title: 'Непрочитанные и ожидающие чаты', text: 'Сколько сообщений ждут ответа. Контроль скорости реакции и нагрузки по коммуникациям.' },
  { icon: Filter, title: 'Показатели по источникам', text: 'Откуда приходят заявки и клиенты. Какие каналы работают лучше для принятия решений.' },
  { icon: BarChart3, title: 'Общая динамика продаж', text: 'Тренды по сделкам, суммам и активности. Видно, как меняется картина во времени.' },
  { icon: LayoutDashboard, title: 'Операционная аналитика', text: 'Оперативные метрики: заявки, ответы, сделки в работе. Всё в одном дашборде.' },
  { icon: Eye, title: 'Руководительская панель', text: 'Сводка ключевых показателей для собственника и руководителя. Цифры в реальном времени.' },
];

const FOR_LEADER = [
  { icon: Inbox, title: 'Видно, сколько пришло заявок', text: 'Не нужно спрашивать у менеджеров — заявки и входящие обращения видны в отчётах и на панели.' },
  { icon: GitBranch, title: 'Видно, сколько дошло до сделки', text: 'Конверсия от заявки до сделки. Понятно, какой объём воронки и сколько закрывается.' },
  { icon: Users, title: 'Видно, кто из менеджеров эффективнее', text: 'Аналитика по менеджерам: обработанные заявки, сделки, активность. Сравнение и контроль.' },
  { icon: AlertCircle, title: 'Видно, где теряются лиды', text: 'На каком этапе отваливаются клиенты. Можно точечно улучшать процесс и воронку.' },
  { icon: Filter, title: 'Видно, какие каналы работают лучше', text: 'Откуда приходят заявки и конверсия по каналам. Решения по маркетингу и каналам на цифрах.' },
  { icon: Zap, title: 'Можно быстро принимать решения на цифрах', text: 'Данные в одном месте, обновляются автоматически. Нет ручного сбора — есть время на управление.' },
];

const FOR_MANAGERS_SECTION = [
  { label: 'Сколько заявок обработал менеджер', icon: Inbox },
  { label: 'Сколько чатов в работе', icon: MessageSquare },
  { label: 'Сколько сделок ведёт', icon: GitBranch },
  { label: 'Где есть просадки', icon: AlertCircle },
  { label: 'Где есть непрочитанные', icon: MessageSquare },
  { label: 'Кто быстрее отвечает', icon: Clock },
];

const FLOW_STEPS = [
  'Заявки и сообщения попадают в систему',
  'Менеджеры работают с клиентами',
  'Сделки двигаются по этапам',
  'Данные автоматически попадают в отчёты',
  'Руководитель видит аналитику в реальном времени',
];

const COMPARISON_MANUAL = [
  'Долго собирать и сводить',
  'Нет актуальности — данные устаревают',
  'Легко ошибиться в расчётах',
  'Сложно контролировать команду по цифрам',
];

const COMPARISON_2WIX = [
  'Данные в одном месте',
  'Обновление автоматически',
  'Видно воронку и работу менеджеров',
  'Быстрые решения на основе цифр',
];

const PREVIEW_ITEMS = [
  { label: 'Панель руководителя', icon: LayoutDashboard },
  { label: 'Операционная аналитика', icon: BarChart3 },
  { label: 'Заявки и конверсия', icon: Inbox },
  { label: 'Показатели по менеджерам', icon: Users },
  { label: 'Воронка продаж', icon: GitBranch },
  { label: 'Дашборд и метрики', icon: PieChart },
];

const FAQ_ITEMS = [
  {
    q: 'Что показывает аналитика продаж в 2wix?',
    a: 'В 2wix отображаются заявки за период, новые клиенты, сделки по этапам воронки, конверсия, активность менеджеров, непрочитанные и ожидающие чаты, показатели по источникам и общая динамика. Руководитель видит ключевые метрики в одной панели без ручного сбора отчётов.',
  },
  {
    q: 'Можно ли видеть показатели по менеджерам?',
    a: 'Да. Аналитика по менеджерам в 2wix включает: сколько заявок обработал каждый, сколько чатов и сделок в работе, где есть непрочитанные сообщения, скорость ответов. Это помогает контролировать нагрузку и эффективность команды.',
  },
  {
    q: 'Есть ли воронка и конверсия?',
    a: 'Да. Сделки ведутся по этапам воронки, и в аналитике видно, сколько сделок на каждом этапе, как движется конверсия между этапами и где теряются клиенты. Воронка продаж и аналитика по ней доступны в одной системе.',
  },
  {
    q: 'Можно ли отслеживать заявки и сделки по периодам?',
    a: 'Да. Можно смотреть заявки и сделки за выбранный период: день, неделя, месяц. Динамика и тренды помогают оценивать эффективность и принимать решения.',
  },
  {
    q: 'Подходит ли это для малого бизнеса?',
    a: 'Да. Аналитика продаж в 2wix полезна и для малого бизнеса: даже с одним-двумя менеджерами важно видеть заявки, воронку и не терять лиды. Настройка не требует отдельного аналитика.',
  },
  {
    q: 'Нужны ли отдельные таблицы и ручные отчёты?',
    a: 'Нет. Данные из CRM автоматически попадают в отчёты и дашборд. Руководитель видит актуальные цифры без выгрузок в Excel и ручного сведения. Экономия времени и меньше ошибок.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const AnalitikaProdazhPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/analitika-prodazh">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Аналитика продаж в CRM: заявки, менеджеры, воронка и результаты
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Видьте реальные цифры по продажам, заявкам и работе менеджеров. 2wix помогает отслеживать заявки, сделки, конверсию, активность команды и ключевые показатели в одной системе.
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
                    <BarChart3 className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">Аналитика продаж</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Заявки', 'Воронка', 'Менеджеры', 'Конверсия'].map((label) => (
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Какие проблемы решает аналитика продаж в CRM</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без единой системы отчёты собираются вручную, картина по заявкам и воронке размыта, контроль менеджеров слабый.
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

      {/* Что можно видеть в аналитике 2wix */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что можно видеть в аналитике 2wix</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Заявки, воронка, конверсия, отчёты по менеджерам и операционные метрики — в одной системе аналитики продаж.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_ANALYTICS.map(({ icon: Icon, title, text }) => (
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

      {/* Аналитика для руководителя */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Аналитика для руководителя</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Контроль продаж на цифрах: заявки, конверсия, эффективность менеджеров и каналов в одном месте.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FOR_LEADER.map(({ icon: Icon, title, text }) => (
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

      {/* Аналитика по менеджерам */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Аналитика по менеджерам</h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Контроль команды: кто сколько обработал, где просадки и кто быстрее отвечает клиентам.
          </p>
          <ul className="grid sm:grid-cols-2 gap-4">
            {FOR_MANAGERS_SECTION.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-surface p-5 shadow-sm">
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sf-text-primary">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает</h2>
          <p className="text-sf-text-secondary text-center mb-14">Данные из CRM автоматически попадают в отчёты — без ручного сбора</p>
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

      {/* Лучше таблиц и ручных отчётов */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему это лучше таблиц и ручных отчётов</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Контроль продаж в CRM: данные обновляются сами, воронка и менеджеры видны в реальном времени.
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
                <BarChart3 className="w-5 h-5 text-sf-accent" />
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс аналитики</h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Панель руководителя, операционная аналитика, заявки, менеджеры и воронка — в одной CRM.
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
            Получите CRM-аналитику, которая помогает видеть реальные цифры и контролировать продажи
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Заявки, воронка, менеджеры и конверсия в одной системе. Начните бесплатно.
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы об аналитике продаж</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы об отчётах, воронке и контроле в 2wix</p>
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
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>FAQ</Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
