import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicProductPreview } from '../../public/components/PublicProductPreview';
import {
  Users,
  Shield,
  Lock,
  Settings,
  ArrowRight,
  Check,
  AlertCircle,
  Eye,
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  GitBranch,
  Wallet,
  FileText,
  UserCog,
  ShieldCheck,
  Zap,
  FolderOpen,
  FileSpreadsheet,
} from 'lucide-react';

const TITLE =
  'Роли и права доступа в CRM — разграничение доступа сотрудников, управление командой | 2wix';
const DESCRIPTION =
  'Роли и права доступа в CRM 2wix: настройте, кто и что видит. Разграничение доступа по разделам, роли пользователей, контроль действий команды. CRM для сотрудников и руководителя.';

const PROBLEMS = [
  {
    title: 'Все сотрудники видят лишние данные',
    text: 'В общей таблице или системе каждый видит всё: финансы, чужих клиентов, аналитику. Нет разделения — выше риски утечек и путаницы.',
  },
  {
    title: 'Нет разделения прав доступа',
    text: 'Невозможно ограничить, кто что может делать. Менеджер меняет настройки, сотрудник видит чужие сделки. Контроль доступа отсутствует.',
  },
  {
    title: 'Менеджеры могут менять то, что не должны',
    text: 'Удаление данных, смена настроек, доступ к финансам — без разграничения прав любая ошибка или действие одного человека влияет на всех.',
  },
  {
    title: 'Сложно ограничить доступ к финансам или аналитике',
    text: 'Транзакции и отчёты должны быть у ограниченного круга. Без ролей и прав доступа в CRM чувствительные данные видны всем.',
  },
  {
    title: 'Нет прозрачности, кто за что отвечает',
    text: 'Неясно, у кого какие права, кто что может редактировать. Трудно масштабировать команду без понятной модели доступа.',
  },
  {
    title: 'Трудно управлять командой при росте компании',
    text: 'Чем больше людей в системе — тем больше хаос, если нет ролей. Новый сотрудник видит всё или наоборот ничего — настроить сложно.',
  },
  {
    title: 'Система не даёт нормального контроля доступа',
    text: 'Либо все видят всё, либо настройка такая сложная, что проще не использовать. Нужна простая и гибкая модель ролей и прав в CRM.',
  },
];

const WHAT_2WIX_GIVES = [
  {
    icon: UserCog,
    title: 'Роли сотрудников',
    text: 'Назначайте роли: собственник, руководитель, менеджер, сотрудник. Система разграничивает доступ по ролям — каждый видит своё.',
  },
  {
    icon: Lock,
    title: 'Права доступа по разделам',
    text: 'Включайте и отключайте доступ к разделам: клиенты, сделки, WhatsApp, аналитика, транзакции, сотрудники, настройки.',
  },
  {
    icon: Shield,
    title: 'Разграничение по функциям',
    text: 'Не только «видеть», но и «редактировать», «одобрять», «удалять». Гибкая настройка прав под задачи бизнеса.',
  },
  {
    icon: Users,
    title: 'Управление командой',
    text: 'Приглашение сотрудников, назначение ролей, отключение доступа. Всё в одном месте — удобная админка для руководителя.',
  },
  {
    icon: Eye,
    title: 'Видимость нужных модулей',
    text: 'Сотрудник видит только те разделы меню, к которым у него есть доступ. Лишнее скрыто — интерфейс проще и понятнее.',
  },
  {
    icon: ShieldCheck,
    title: 'Ограничение лишнего доступа',
    text: 'Финансы, аналитика, настройки — только тем, кому нужно. Остальные работают с клиентами, сделками и чатами без доступа к чувствительным данным.',
  },
  {
    icon: Zap,
    title: 'Безопасная работа внутри CRM',
    text: 'Действия фиксируются, права заданы явно. Меньше риска случайных изменений и утечек. CRM как система управления, а не просто хранилище.',
  },
  {
    icon: LayoutDashboard,
    title: 'Контроль действий сотрудников',
    text: 'Руководитель видит, кто что делает. В сочетании с ролями и правами — полный контроль над командой и данными.',
  },
  {
    icon: Settings,
    title: 'Удобная админка для собственника',
    text: 'Настройка ролей и прав без программиста. Понятный интерфейс управления доступами — быстро и прозрачно.',
  },
];

const ROLES = [
  { name: 'Собственник', desc: 'Полный доступ: настройки, финансы, сотрудники, все разделы. Управление компанией и правами.' },
  { name: 'Руководитель', desc: 'Доступ к операционным разделам и отчётам. Контроль команды, клиентов, сделок, аналитики. Ограничение чувствительных настроек при необходимости.' },
  { name: 'Менеджер', desc: 'Клиенты, сделки, переписка, свои отчёты. Без доступа к финансам и настройкам компании — только работа с клиентами.' },
  { name: 'Сотрудник', desc: 'Ограниченный доступ под задачу: например только клиенты и чаты, без сделок и аналитики. Гибко настраивается.' },
  { name: 'Оператор / администратор', desc: 'Технические или узкие права: шаблоны, справочники, приём заявок. Без доступа к финансам и личным данным клиентов при необходимости.' },
  { name: 'Ограниченный пользователь', desc: 'Минимальный набор: только то, что нужно для работы. Система поддерживает тонкую настройку под любую модель доступа.' },
];

const RESTRICTABLE_SECTIONS = [
  { icon: Users, label: 'Клиенты' },
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: Wallet, label: 'Транзакции' },
  { icon: UserCog, label: 'Сотрудники' },
  { icon: FolderOpen, label: 'Файлы клиентов' },
  { icon: FileText, label: 'Шаблоны' },
  { icon: Settings, label: 'Настройки' },
];

const WHY_FOR_OWNER = [
  {
    icon: Eye,
    title: 'Сотрудники видят только нужное',
    text: 'Каждый работает в своей зоне. Менеджер — с клиентами и сделками, бухгалтерия — с транзакциями. Меньше отвлечений и ошибок.',
  },
  {
    icon: Shield,
    title: 'Меньше риска ошибок',
    text: 'Нет доступа к удалению или смене критичных настроек у тех, кому это не нужно. Случайные действия ограничены правами.',
  },
  {
    icon: Zap,
    title: 'Меньше хаоса',
    text: 'Понятно, кто за что отвечает и что может делать. Структура работы и доступа явная — проще масштабировать команду.',
  },
  {
    icon: Users,
    title: 'Проще масштабировать команду',
    text: 'Нового сотрудника добавляете с нужной ролью — он сразу видит только свои разделы. Не нужно объяснять «это не трогай».',
  },
  {
    icon: Lock,
    title: 'Контроль доступа к чувствительным данным',
    text: 'Финансы, персональные данные, аналитика — только у тех, кому необходимо. Соответствие требованиям и внутренним правилам.',
  },
  {
    icon: LayoutDashboard,
    title: 'Структура работы становится понятнее',
    text: 'Роли и права задают рамки. Команда знает границы, руководитель — кто что видит и делает. Управление процессами проще.',
  },
];

const FLOW_STEPS = [
  'В компанию добавляют сотрудника',
  'Назначают роль (руководитель, менеджер, сотрудник и т.д.)',
  'Система открывает только нужные разделы и действия',
  'Руководитель при необходимости меняет права доступа',
  'Команда работает безопасно и структурно в одной CRM',
];

const COMPARISON_WITHOUT = [
  'Хаос: все видят всё или наоборот',
  'Лишний доступ к финансам и настройкам',
  'Ошибки и случайные изменения сотрудников',
  'Риск утечек и неконтролируемых действий',
  'Сложно масштабировать команду',
];

const COMPARISON_2WIX = [
  'Каждый видит своё по ролям и правам',
  'Роли и доступ понятны и настраиваются',
  'Контроль выше — действия ограничены правами',
  'Безопасность и разграничение доступа',
  'Управление командой и доступами проще',
];

const PREVIEW_MODULES = [
  { icon: Users, label: 'Сотрудники' },
  { icon: Shield, label: 'Роли' },
  { icon: Lock, label: 'Права' },
  { icon: Settings, label: 'Доступы' },
];

const FAQ_ITEMS = [
  {
    q: 'Можно ли настроить права доступа в 2wix?',
    a: 'Да. В 2wix есть роли и права доступа: вы назначаете сотруднику роль и при необходимости настраиваете, к каким разделам у него есть доступ — клиенты, сделки, WhatsApp, аналитика, транзакции, настройки. Разграничение доступа в CRM настраивается под вашу команду.',
  },
  {
    q: 'Можно ли ограничить сотрудникам доступ к отдельным разделам?',
    a: 'Да. Можно включать и отключать доступ по разделам: клиенты, WhatsApp, сделки, аналитика, транзакции, сотрудники, файлы, шаблоны, настройки. Каждый сотрудник видит только те разделы, к которым у него есть права.',
  },
  {
    q: 'Есть ли роли пользователей в CRM?',
    a: 'Да. В 2wix поддерживаются роли: собственник, руководитель, менеджер, сотрудник, оператор и ограниченный пользователь. Модель гибкая — роли и права настраиваются под задачи бизнеса.',
  },
  {
    q: 'Можно ли скрыть аналитику или финансы от части команды?',
    a: 'Да. Доступ к аналитике и транзакциям (финансам) настраивается по ролям и правам. Вы можете выдать доступ только руководителю или отдельным сотрудникам, остальные будут работать без доступа к этим разделам.',
  },
  {
    q: 'Подходит ли это для небольшой компании?',
    a: 'Да. Разграничение доступа полезно и в малой команде: даже с двумя-тремя людьми важно, чтобы менеджер не видел лишнего, а доступ к настройкам и финансам был только у ответственных. При росте команды права и роли масштабируются.',
  },
  {
    q: 'Можно ли управлять доступами без сложной настройки?',
    a: 'Да. Назначение ролей и прав в 2wix делается через понятный интерфейс: пригласили сотрудника, выбрали роль, при необходимости отключили или включили разделы. Без программирования и сложных схем.',
  },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const RoliPravaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/roli-i-prava">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Роли и права доступа в CRM для команды
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает разграничивать доступы сотрудников, назначать роли, контролировать действия команды и безопасно управлять процессами внутри одной CRM-системы.
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
            Какие проблемы решает разграничение доступа в CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без ролей и прав доступа сотрудники видят лишнее, менеджеры могут менять то, что не должны, а масштабировать команду сложно.
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

      {/* Что даёт 2wix для управления доступами */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix для управления доступами
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Роли, права по разделам, видимость модулей и удобная админка — управление командой и разграничение доступа в одной CRM.
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
            Подробнее о контроле работы команды — в разделе{' '}
            <Link to="/kontrol-menedzherov" className="text-sf-accent font-medium hover:text-sf-primary">контроль менеджеров</Link>.
          </p>
        </div>
      </section>

      {/* Какие роли могут быть */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Какие роли могут быть в CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Универсальная модель ролей: от собственника до ограниченного пользователя. Система поддерживает разграничение доступа под задачи вашего бизнеса.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ROLES.map(({ name, desc }) => (
              <div
                key={name}
                className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <UserCog className="w-5 h-5 text-sf-accent" />
                  <h3 className="font-semibold text-sf-text-primary">{name}</h3>
                </div>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что можно ограничить */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что можно ограничить по разделам
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Управление доступом к разделам CRM: включайте и отключайте видимость и действия по каждому модулю. Связка с{' '}
            <Link to="/upravlenie-klientami" className="text-sf-accent font-medium hover:text-sf-primary">управлением клиентами</Link>,{' '}
            <Link to="/sdelki-i-voronka" className="text-sf-accent font-medium hover:text-sf-primary">сделками и воронкой</Link> — каждый сотрудник видит только свои разделы.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {RESTRICTABLE_SECTIONS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-sfCard border border-sf-border bg-sf-surface p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center"
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

      {/* Почему это важно для собственника */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Почему это важно для собственника
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Роли и права доступа снижают риски, упорядочивают работу команды и упрощают масштабирование.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FOR_OWNER.map(({ icon: Icon, title, text }) => (
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

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Как это работает
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Простой сценарий: от добавления сотрудника до безопасной работы команды с разграничением прав.
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

      {/* Product preview / Screenshots */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Управление ролями и доступами в интерфейсе
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Экран сотрудников, выбор прав доступа, роли и разделы — настраивается в одной CRM.
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

      {/* Чем лучше, чем когда все видят всё */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Чем лучше, чем когда все видят всё
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Сравнение: без ролей и прав — хаос и риски; с 2wix — структура и контроль доступа.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
              <h3 className="font-semibold text-sf-text-primary mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                Без ролей и прав
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
            Настройте роли и права доступа в CRM, где команда работает структурно и безопасно
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Разграничение доступа, управление командой и контроль действий — в одной системе.{' '}
            <Link to="/ceny" className="text-white/95 underline hover:text-white">Тарифы</Link> и бесплатный старт — на странице цен.
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
            Вопросы о ролях и правах доступа в CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Частые вопросы о разграничении доступа, ролях пользователей и управлении командой в 2wix.
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
            <Link to="/" className={LINK_BTN_CLASS}>
              Главная
            </Link>
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>
              Возможности
            </Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>
              CRM для бизнеса
            </Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>
              CRM для продаж
            </Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>
              Управление клиентами
            </Link>
            <Link to="/kontrol-menedzherov" className={LINK_BTN_CLASS}>
              Контроль менеджеров
            </Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>
              Сделки и воронка
            </Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>
              Аналитика продаж
            </Link>
            <Link to="/ceny" className={LINK_BTN_CLASS}>
              Цены
            </Link>
            <Link to="/faq" className={LINK_BTN_CLASS}>
              FAQ
            </Link>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
