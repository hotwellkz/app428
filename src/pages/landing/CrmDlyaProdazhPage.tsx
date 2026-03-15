import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import {
  Target,
  MessageCircle,
  Users,
  TrendingUp,
  BarChart3,
  GitBranch,
  Zap,
  Filter,
  ArrowRight,
  Check,
  AlertCircle,
  UserCheck,
  LayoutGrid,
  FileText,
  MessageSquare,
  CalendarCheck,
} from 'lucide-react';

const TITLE = 'CRM для отдела продаж — 2wix | Лиды, воронка, заявки и контроль менеджеров';
const DESCRIPTION =
  'CRM для продаж от 2wix: лиды и заявки, воронка сделок, назначение менеджеров, WhatsApp и аналитика. Управление отделом продаж и заявками в одной системе. Подходит для малого и среднего бизнеса.';

const PROBLEMS = [
  { text: 'Лиды и заявки теряются' },
  { text: 'Менеджеры ведут клиентов хаотично' },
  { text: 'Нет единой воронки продаж' },
  { text: 'Сложно понять, на каком этапе клиент' },
  { text: 'Нет контроля по касаниям и срокам' },
  { text: 'Нет прозрачности по менеджерам' },
  { text: 'Руководитель не видит реальную картину продаж' },
  { text: 'Заявки из WhatsApp, сайта и звонков живут отдельно' },
];

const FEATURES = [
  { icon: Target, title: 'Лиды и заявки', text: 'Все заявки в одном месте: из WhatsApp, сайта, звонков. Ни одна не теряется, каждая попадает в работу.' },
  { icon: Users, title: 'Карточка клиента', text: 'Контакты, история взаимодействий, сделки и переписка в одной карточке. Полный контекст для менеджера.' },
  { icon: GitBranch, title: 'Сделки и воронка', text: 'Воронка с этапами, перенос сделок, сроки и ответственные. Прозрачность по конвейеру и конверсии.' },
  { icon: UserCheck, title: 'Назначение ответственного', text: 'Каждая сделка и заявка привязаны к менеджеру. Руководитель видит нагрузку и может перераспределять.' },
  { icon: LayoutGrid, title: 'Этапы сделок', text: 'Настраиваемые этапы воронки. Клиент движется по этапам — видно, где он сейчас и что дальше.' },
  { icon: CalendarCheck, title: 'Контроль следующего шага', text: 'Не теряйте касания: видно, когда последний контакт и какой следующий шаг запланирован.' },
  { icon: MessageCircle, title: 'WhatsApp и переписка', text: 'Переписка с клиентом в CRM, заявки из чатов попадают в воронку. Всё в одном окне.' },
  { icon: Zap, title: 'Быстрые ответы', text: 'Шаблоны сообщений для типовых ситуаций. Менеджеры отвечают быстрее и единообразно.' },
  { icon: BarChart3, title: 'Аналитика менеджеров', text: 'Кто сколько сделок вёл, конверсия по менеджерам, скорость обработки заявок. Отчёты для руководителя.' },
  { icon: TrendingUp, title: 'Отчёты по заявкам и продажам', text: 'Сколько заявок пришло, сколько в работе, сколько закрыто. Дашборды и выгрузки для планирования.' },
];

const FLOW_STEPS = [
  'Приходит заявка',
  'Создаётся клиент',
  'Назначается менеджер',
  'Создаётся сделка',
  'Клиент проходит этапы воронки',
  'Руководитель видит аналитику',
  'Команда не теряет касания',
];

const FOR_WHO = [
  'Отделы продаж',
  'Малый и средний бизнес',
  'Компании с входящими заявками',
  'Бизнес с WhatsApp-продажами',
  'Строительные компании',
  'Производственные компании',
  'Сервисные команды',
  'Компании, где нужно контролировать менеджеров',
];

const FOR_LEADER = [
  'Видно, сколько заявок пришло',
  'Видно, кто отвечает и как быстро',
  'Видно, где теряются клиенты',
  'Видно, на каком этапе каждая сделка',
  'Видно, сколько продаж в работе',
  'Контроль отдела продаж без хаоса',
];

const PREVIEW_ITEMS = [
  { label: 'Сделки и воронка', icon: GitBranch },
  { label: 'Карточка клиента', icon: Users },
  { label: 'WhatsApp', icon: MessageSquare },
  { label: 'Аналитика', icon: BarChart3 },
  { label: 'Фильтры', icon: Filter },
  { label: 'Статусы и этапы', icon: Target },
];

const FAQ_ITEMS = [
  { q: 'Что такое CRM для продаж?', a: 'CRM для продаж — это система, в которой ведут лиды и заявки, сделки по этапам воронки, назначают ответственных менеджеров и смотрят аналитику. Всё в одном месте: заявки не теряются, руководитель видит реальную картину, команда работает по единому процессу.' },
  { q: 'Подходит ли 2wix для небольшого отдела продаж?', a: 'Да. 2wix рассчитан на малый и средний бизнес. Небольшой отдел продаж может начать работу быстро: заявки, клиенты, воронка и отчётность — без сложного внедрения.' },
  { q: 'Можно ли вести сделки и воронку?', a: 'Да. В 2wix есть воронка сделок с настраиваемыми этапами, перенос сделок между этапами, назначение ответственного и сроки. Отчётность по конверсии и по менеджерам встроена.' },
  { q: 'Есть ли контроль менеджеров?', a: 'Да. По каждой сделке и заявке видно ответственного. Руководитель видит нагрузку, историю касаний и может перераспределять задачи. Права доступа настраиваются под роли.' },
  { q: 'Можно ли работать через WhatsApp?', a: 'Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном интерфейсе, заявки из чатов попадают в воронку, быстрые ответы и шаблоны. Идеально для бизнеса, где клиенты пишут в мессенджер.' },
  { q: 'Подходит ли 2wix для разных отраслей?', a: 'Да. CRM для продаж в 2wix универсальна: отделы продаж, сервисные команды, строительство, производство, услуги. Строительство — один из сценариев, система подходит для любого бизнеса с заявками и сделками.' },
  { q: 'Есть ли аналитика продаж?', a: 'Да. Дашборды и отчёты по заявкам, сделкам, конверсии и менеджерам. Руководитель видит, сколько заявок пришло, сколько в работе, где теряются клиенты и как работает отдел.' },
  { q: 'Можно ли адаптировать систему под процессы компании?', a: 'Да. Этапы воронки настраиваются, роли и права гибкие. Можно вести только заявки и клиентов или подключать финансы, склад и документы — в зависимости от задач.' },
];

export const CrmDlyaProdazhPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION}>
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Управляйте лидами, сделками и менеджерами в одной CRM
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает собирать заявки, вести клиентов по воронке, контролировать менеджеров, работать через WhatsApp и видеть аналитику продаж в одном окне.
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
                    <GitBranch className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">Сделки</span>
                  </div>
                  <div className="space-y-2">
                    {['Новая заявка', 'В работе', 'Договор'].map((label, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-lg bg-sf-backgroundSection">
                        <div className="w-2 h-2 rounded-full bg-sf-primaryLight0" />
                        <span className="text-sm font-medium text-sf-text-secondary">{label}</span>
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Какие проблемы решает CRM для продаж</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы заявки и менеджеры живут в хаосе. 2wix возвращает порядок и прозрачность.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROBLEMS.map(({ text }) => (
              <div key={text} className="flex items-start gap-3 rounded-sfCard border border-red-100 bg-red-50/50 p-5">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sf-text-secondary font-medium text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что умеет CRM для продаж в 2wix */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что умеет CRM для продаж в 2wix</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Всё необходимое для управления заявками, сделками и отделом продаж
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
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
          <p className="text-sf-text-secondary text-center mb-14">От заявки до сделки и отчёта — единый процесс в одной системе</p>
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

      {/* Кому подходит */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Кому подходит</h2>
          <p className="text-sf-text-secondary text-center mb-12">2wix используют отделы продаж и бизнесы разных отраслей</p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {FOR_WHO.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-4">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Чем 2wix полезен руководителю */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Чем 2wix полезен руководителю</h2>
          <p className="text-sf-text-secondary text-center mb-12">Прозрачность отдела продаж без хаоса и «устных отчётов»</p>
          <ul className="grid sm:grid-cols-2 gap-4">
            {FOR_LEADER.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-emerald-200 bg-sf-primaryLight/50 px-5 py-4">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Screenshots / UI Preview */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс CRM для продаж</h2>
          <p className="text-sf-text-secondary text-center mb-14">Сделки, клиенты, WhatsApp и аналитика в одном продукте</p>
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
            Постройте прозрачный отдел продаж в 2wix
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Соберите заявки, воронку и команду в одной системе. Начните бесплатно.
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
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse border-2 border-sf-border hover:border-sf-borderLight transition-all"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы и ответы</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы о CRM для продаж в 2wix</p>
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
            <Link to="/" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Главная
            </Link>
            <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Возможности
            </Link>
            <Link to="/whatsapp-crm" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              WhatsApp CRM
            </Link>
            <Link to="/crm-dlya-biznesa" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              CRM для бизнеса
            </Link>
            <Link to="/sdelki-i-voronka" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Сделки и воронка
            </Link>
            <Link to="/ceny" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Цены
            </Link>
            <Link to="/faq" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </section>

      <PublicCTA />
    </SEOPageLayout>
  );
};
