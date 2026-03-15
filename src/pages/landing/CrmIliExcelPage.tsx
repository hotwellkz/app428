import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
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
  FileSpreadsheet,
  LayoutDashboard,
  FileText,
  Shield,
  Eye,
  X,
  ListChecks,
  Zap,
} from 'lucide-react';

const TITLE =
  'CRM или Excel: что лучше для работы с клиентами и продажами | 2wix';
const DESCRIPTION =
  'CRM или Excel для бизнеса: когда таблиц уже недостаточно. Сравнение Excel и CRM по базе клиентов, заявкам, сделкам, WhatsApp, аналитике. Учёт клиентов в Excel или CRM. Когда переходить с Excel на CRM. 2wix — альтернатива таблицам.';

const WHY_EXCEL = [
  'Привычно — многие начинали с таблиц',
  'Быстро стартовать — не нужно внедрять систему',
  'Дёшево — уже есть под рукой',
  'Кажется, что этого достаточно на старте',
];

const EXCEL_LIMITS = [
  'Рост клиентов',
  'Рост заявок',
  'Рост команды',
  'Больше каналов обращений',
  'Больше хаоса в обновлениях',
];

const EXCEL_STILL_OK = [
  'Вы работаете один',
  'Клиентов мало',
  'Нет команды менеджеров',
  'Нет сложной воронки сделок',
  'Нет большого объёма заявок',
  'Нет потребности в аналитике и контроле',
];

const EXCEL_BREAKS = [
  'Несколько менеджеров работают с клиентами',
  'Заявки приходят из разных каналов',
  'Нужно вести историю по каждому клиенту',
  'Появляется активная WhatsApp-коммуникация',
  'Нужно контролировать сделки по этапам',
  'Важно понимать статус клиента',
  'Нужна аналитика по заявкам и продажам',
  'Требуется передача клиента между сотрудниками',
];

const COMPARISON_ROWS: { criterion: string; excel: string; crm: string }[] = [
  { criterion: 'База клиентов', excel: 'Таблица, часто в разных файлах', crm: 'Единая база, карточка на каждого клиента' },
  { criterion: 'История общения', excel: 'Отдельно (чаты, почта)', crm: 'В карточке клиента' },
  { criterion: 'WhatsApp', excel: 'Личные чаты, не привязаны к учёту', crm: 'Переписка в CRM, привязка к клиенту и сделке' },
  { criterion: 'Сделки и воронка', excel: 'Отдельная таблица или нет', crm: 'Этапы, статусы, видно движение' },
  { criterion: 'Поиск информации', excel: 'Фильтры, поиск по файлу', crm: 'Поиск по клиенту, заявке, сделке в одной системе' },
  { criterion: 'Несколько сотрудников', excel: 'Конфликты версий, кто что обновил', crm: 'Одна система, назначение ответственного' },
  { criterion: 'Роли и права', excel: 'Нет разграничения', crm: 'Доступ по разделам под роль' },
  { criterion: 'Контроль менеджеров', excel: 'На словах или отдельные отчёты', crm: 'Нагрузка, непрочитанные, скорость ответа в системе' },
  { criterion: 'Аналитика', excel: 'Ручные сводки, формулы', crm: 'Отчёты по заявкам, сделкам, конверсии' },
  { criterion: 'Прозрачность для руководителя', excel: 'Нужно собирать вручную', crm: 'Воронка и цифры в реальном времени' },
  { criterion: 'Передача клиентов', excel: 'Потеря контекста, пересылка файлов', crm: 'Передача без потери истории' },
  { criterion: 'Масштабируемость', excel: 'Файл разрастается, тормозит', crm: 'Рост клиентов и команды без хаоса' },
];

const TABLE_PAINS = [
  'Данные обновляются не всеми',
  'Кто-то забывает вносить изменения',
  'Клиенты теряются между файлами',
  'Комментарии лежат отдельно от таблицы',
  'Переписка не привязана к карточке клиента',
  'Непонятно, кто за клиента отвечает',
  'Нет единой системы',
  'Руководитель не видит полной картины',
];

const CRM_INSTEAD_EXCEL = [
  { icon: Users, title: 'Единая база клиентов', text: 'Все в одной системе, не в разрозненных файлах.' },
  { icon: FileText, title: 'Карточка клиента', text: 'История, переписка, сделки в одном месте.' },
  { icon: MessageSquare, title: 'История общения', text: 'Переписка и комментарии в карточке.' },
  { icon: GitBranch, title: 'Сделки и этапы', text: 'Воронка, статусы, видно движение.' },
  { icon: Inbox, title: 'WhatsApp в одной системе', text: 'Переписка привязана к клиенту и сделке.' },
  { icon: Shield, title: 'Роли и права', text: 'Разграничение доступа по разделам.' },
  { icon: BarChart3, title: 'Аналитика', text: 'Отчёты без ручных сводок.' },
  { icon: UserCheck, title: 'Работа команды', text: 'Назначение ответственного, передача без потери контекста.' },
  { icon: Eye, title: 'Прозрачность для руководителя', text: 'Цифры и процессы в реальном времени.' },
  { icon: LayoutDashboard, title: 'Меньше потери данных', text: 'Всё в одном месте, не в чатах и копиях файлов.' },
];

const WHEN_SWITCH = [
  'У вас больше 1 менеджера',
  'Заявки приходят из нескольких каналов',
  'Клиентская история теряется',
  'Данные живут в чатах и таблицах вперемешку',
  'Сложно понять, на каком этапе клиент',
  'Руководителю не видно, что происходит',
  'Excel уже не справляется с объёмом',
];

const WHY_2WIX = [
  { icon: Users, title: 'Единая клиентская база', text: 'Клиенты, карточки, история — в одной CRM.' },
  { icon: MessageSquare, title: 'WhatsApp внутри CRM', text: 'Переписка в карточке клиента, не в личных чатах.' },
  { icon: Inbox, title: 'Заявки под контролем', text: 'Входящие из сайта, WhatsApp, почты — без потери.' },
  { icon: GitBranch, title: 'Сделки и воронка', text: 'Этапы, статусы, видно движение.' },
  { icon: BarChart3, title: 'Аналитика', text: 'Заявки, сделки, конверсия, отчёты по отделу.' },
  { icon: UserCheck, title: 'Командная работа', text: 'Менеджеры, роли, назначение ответственного.' },
  { icon: Eye, title: 'Контроль для руководителя', text: 'Нагрузка, непрочитанные, картина по отделу.' },
  { icon: Zap, title: 'Понятный старт', text: 'Переход с Excel без лишней сложности — быстрая регистрация и начало работы.' },
];

const PREVIEW_MODULES = [
  { icon: FileText, label: 'Карточка клиента' },
  { icon: Users, label: 'Клиенты' },
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: Shield, label: 'Роли' },
];

const FAQ_ITEMS = [
  {
    q: 'Что лучше: CRM или Excel?',
    a: 'Зависит от масштаба. Excel хорошо подходит для старта: один человек, мало клиентов. CRM лучше, когда есть несколько менеджеров, заявки из разных каналов, нужна история по клиенту, сделки по этапам и аналитика. Учёт клиентов в Excel или CRM — выбор по объёму и сложности процессов.',
  },
  {
    q: 'Когда Excel уже не подходит для бизнеса?',
    a: 'Когда появляется команда, заявки из нескольких каналов, нужно вести историю общения и этапы сделок, контролировать менеджеров и видеть аналитику. Когда переходить с Excel на CRM — как только таблицы и чаты перестают справляться с порядком.',
  },
  {
    q: 'Можно ли заменить таблицы на 2wix?',
    a: 'Да. 2wix — CRM вместо Excel для работы с клиентами, заявками и сделками. Единая база, карточка клиента с историей и перепиской, воронка, аналитика, командная работа. Многие переходят с таблиц на 2wix без сложного внедрения.',
  },
  {
    q: 'Подходит ли CRM для небольшой команды?',
    a: 'Да. CRM полезна уже при двух и более людях, работающих с клиентами: единая база, назначение ответственного, история не теряется при передаче. Таблица или CRM для бизнеса с командой — CRM даёт порядок и прозрачность.',
  },
  {
    q: 'Сложно ли перейти с Excel на CRM?',
    a: 'В облачных CRM вроде 2wix — нет. Регистрация, добавление сотрудников, начало ведения клиентов и заявок. Данные можно переносить постепенно. Интерфейс понятный, без долгой настройки.',
  },
  {
    q: 'Подходит ли 2wix для малого бизнеса?',
    a: 'Да. 2wix рассчитан в том числе на малый бизнес: доступные тарифы, быстрый старт. CRM вместо Excel для малого бизнеса — когда таблиц уже не хватает, 2wix даёт единую систему без лишней сложности.',
  },
  {
    q: 'Можно ли вести клиентов, сделки и переписку в одной системе?',
    a: 'Да. В CRM клиент, его переписка (в т.ч. WhatsApp), сделки и комментарии — в одной карточке. Не нужно искать по таблицам и чатам. Excel vs CRM по этому критерию: в CRM всё связано в одном месте.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const CrmIliExcelPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/crm-ili-excel">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                CRM или Excel: что лучше для работы с клиентами и продажами?
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Сравните Excel и CRM на реальных задачах бизнеса: клиенты, заявки, сделки, WhatsApp, команда и аналитика. Поймите, когда пора переходить на систему вроде 2wix.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  to="/vozmozhnosti"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
                >
                  Посмотреть возможности
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder hover:bg-sf-backgroundSection transition-all"
                >
                  Попробовать 2wix
                </button>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="flex gap-4 items-stretch max-w-md w-full">
                <div className="flex-1 rounded-sfCard border border-amber-200 bg-amber-50/80 p-4 flex flex-col items-center justify-center text-center">
                  <FileSpreadsheet className="w-10 h-10 text-amber-600 mb-2" />
                  <span className="text-sm font-semibold text-amber-800">Excel</span>
                  <span className="text-xs text-amber-700 mt-1">Таблицы</span>
                </div>
                <div className="flex items-center text-sf-text-muted">vs</div>
                <div className="flex-1 rounded-sfCard border border-sf-cardBorder bg-sf-primaryLight/30 p-4 flex flex-col items-center justify-center text-center">
                  <LayoutDashboard className="w-10 h-10 text-sf-accent mb-2" />
                  <span className="text-sm font-semibold text-sf-text-primary">CRM</span>
                  <span className="text-xs text-sf-text-secondary mt-1">Система</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Почему бизнес вообще работает в Excel */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Почему бизнес вообще работает в Excel
          </h2>
          <p className="text-lg text-sf-text-secondary mb-6 leading-relaxed">
            Excel часто выбирают не случайно: привычно, быстро стартовать, дёшево, кажется, что для учёта клиентов и заявок этого достаточно.
          </p>
          <ul className="space-y-2 mb-8">
            {WHY_EXCEL.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sf-text-secondary">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sf-text-secondary leading-relaxed">
            Но по мере роста появляются ограничения: больше клиентов, заявок, сотрудников, каналов — и в таблицах начинается путаница. Это не значит, что Excel «плохой»: просто для другой стадии бизнеса. Ниже — где Excel ещё ок, а где уже пора смотреть в сторону CRM.
          </p>
          <ul className="mt-4 space-y-1 text-sf-text-secondary text-sm">
            {EXCEL_LIMITS.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Где Excel ещё может подходить */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Где Excel ещё может подходить
          </h2>
          <p className="text-lg text-sf-text-secondary mb-8 leading-relaxed">
            Честно: таблицы ещё могут быть нормальным решением, если масштаб небольшой.
          </p>
          <ul className="space-y-2">
            {EXCEL_STILL_OK.map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-sfCard border border-sf-border bg-sf-surface px-4 py-2">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Где Excel начинает ломаться */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Где Excel начинает ломаться
          </h2>
          <p className="text-lg text-sf-text-secondary mb-8 leading-relaxed">
            Реальные ограничения таблиц для учёта клиентов и продаж, когда бизнес растёт.
          </p>
          <ul className="space-y-2">
            {EXCEL_BREAKS.map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-4 py-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Сравнение CRM vs Excel */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Сравнение: CRM vs Excel
          </h2>
          <p className="text-sf-text-secondary text-center mb-10">
            По каким критериям таблица или CRM для бизнеса выигрывают по-разному.
          </p>
          <div className="rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sf-border bg-sf-backgroundSection/80">
                    <th className="text-left py-4 px-4 font-semibold text-sf-text-primary">Критерий</th>
                    <th className="text-left py-4 px-4 font-semibold text-amber-800 bg-amber-50/50">Excel</th>
                    <th className="text-left py-4 px-4 font-semibold text-sf-text-primary bg-sf-primaryLight/30">CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.criterion} className="border-b border-sf-borderLight last:border-0">
                      <td className="py-3 px-4 font-medium text-sf-text-primary">{row.criterion}</td>
                      <td className="py-3 px-4 text-sf-text-secondary bg-amber-50/30">{row.excel}</td>
                      <td className="py-3 px-4 text-sf-text-secondary bg-sf-primaryLight/20">{row.crm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Что происходит на практике, если вести всё в таблицах */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Что происходит на практике, если вести всё в таблицах
          </h2>
          <p className="text-lg text-sf-text-secondary mb-8 leading-relaxed">
            Типичные боли, когда учёт клиентов в Excel или в разрозненных файлах уже не справляется.
          </p>
          <ul className="space-y-2">
            {TABLE_PAINS.map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-4 py-3">
                <X className="w-5 h-5 text-amber-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Что даёт CRM вместо Excel */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт CRM вместо Excel
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            CRM — следующий уровень организации: не просто учёт, а единая система для клиентов, заявок, сделок и команды.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CRM_INSTEAD_EXCEL.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-6"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Когда уже пора переходить на CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary mb-4">
            Когда уже пора переходить на CRM
          </h2>
          <p className="text-lg text-sf-text-secondary mb-8 leading-relaxed">
            Чек-лист: если совпадает несколько пунктов — пора смотреть в сторону CRM вместо Excel.
          </p>
          <ul className="space-y-2">
            {WHEN_SWITCH.map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-4 py-3">
                <ListChecks className="w-5 h-5 text-sf-accent flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Почему 2wix — хорошая альтернатива Excel */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему 2wix — хорошая альтернатива Excel
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Как 2wix помогает перейти от таблиц к системной работе с клиентами и продажами — без лишней сложности.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_2WIX.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-6"
              >
                <div className="w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/chto-takoe-crm" className={LINK_BTN_CLASS}>Что такое CRM</Link>
            <Link to="/kak-vybrat-crm" className={LINK_BTN_CLASS}>Как выбрать CRM</Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>Цены</Link>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это выглядит в CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Карточка клиента, список клиентов, WhatsApp, сделки, аналитика и роли — в одной системе вместо разрозненных таблиц.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PREVIEW_MODULES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-sf-borderLight to-sf-backgroundSection flex items-center justify-center p-6">
                  <div className="w-14 h-14 rounded-sfCard bg-sf-surface border border-sf-border shadow flex items-center justify-center text-sf-text-muted">
                    <Icon className="w-7 h-7" />
                  </div>
                </div>
                <div className="p-4 border-t border-sf-borderLight">
                  <p className="font-medium text-sf-text-primary text-center text-sm">{label}</p>
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
            Перейдите от таблиц к CRM, где клиенты, сделки и команда под контролем
          </h2>
          <p className="text-lg text-white/95 mb-10">
            CRM вместо Excel для бизнеса: единая система, а не разрозненные файлы. <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-primary bg-sf-surface hover:bg-sf-borderLight shadow-xl transition-all"
            >
              Попробовать 2wix
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-white/90 hover:text-white border-2 border-white/40 hover:border-white/60 transition-all"
            >
              Создать компанию
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Вопросы: CRM или Excel
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о сравнении таблиц и CRM, переходе на 2wix.
          </p>
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
          <h2 className="text-2xl font-bold text-sf-text-primary text-center mb-10">
            Полезные разделы
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className={LINK_BTN_CLASS}>Главная</Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>Возможности</Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>CRM для бизнеса</Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>CRM для продаж</Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>WhatsApp CRM</Link>
            <Link to="/chto-takoe-crm" className={LINK_BTN_CLASS}>Что такое CRM</Link>
            <Link to="/zachem-nuzhna-crm" className={LINK_BTN_CLASS}>Зачем нужна CRM</Link>
            <Link to="/kak-vybrat-crm" className={LINK_BTN_CLASS}>Как выбрать CRM</Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>Управление клиентами</Link>
            <Link to="/edinaya-baza-klientov" className={LINK_BTN_CLASS}>Единая база клиентов</Link>
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
