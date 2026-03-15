import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import {
  Building2,
  MessageSquare,
  GitBranch,
  BarChart3,
  Users,
  Wallet,
  Package,
  Shield,
  ArrowRight,
  Check,
  AlertCircle,
  LayoutDashboard,
  Zap,
  Eye,
  Layers,
  Target,
  List,
  Filter,
  Smartphone,
} from 'lucide-react';

const TITLE = 'CRM для бизнеса — 2wix | Универсальная система для клиентов, продаж и процессов';
const DESCRIPTION =
  'CRM для бизнеса от 2wix: клиенты, заявки, сделки, WhatsApp, аналитика и сотрудники в одной системе. Подходит для малого и среднего бизнеса, отдела продаж и разных отраслей. Универсальная CRM-система.';

const WHY_CRM = [
  { title: 'Таблиц и мессенджеров уже недостаточно', text: 'Заявки размазаны по почте, WhatsApp и звонкам. Клиенты теряются, непонятно, кто на каком этапе. Руководитель не видит полную картину.' },
  { title: 'Бизнес теряет заявки', text: 'Обращения остаются в личных чатах менеджеров или тонут в почте. Нет единой воронки и ответственного — часть лидов не обрабатывается.' },
  { title: 'Хаос в коммуникациях мешает продажам', text: 'Нет единой истории по клиенту, менеджеры дублируют или конфликтуют. Сложно передать клиента другому сотруднику без потери контекста.' },
  { title: 'Руководителю нужен контроль', text: 'Нужно видеть, сколько заявок пришло, кто отвечает, где теряются сделки и как работает команда. Без системы — только «устные отчёты».' },
];

const WHAT_CLOSES = [
  { icon: Users, title: 'Клиенты и база контактов', text: 'Единая база клиентов с контактами, историей взаимодействий и сделками.' },
  { icon: Target, title: 'Заявки и лиды', text: 'Все заявки в одном месте: из WhatsApp, сайта, звонков. Ни одна не теряется.' },
  { icon: GitBranch, title: 'Сделки и воронка', text: 'Воронка продаж с этапами, ответственные, сроки и отчётность по конверсии.' },
  { icon: MessageSquare, title: 'WhatsApp и переписка', text: 'Переписка с клиентами в CRM, быстрые ответы, связь чатов со сделками.' },
  { icon: BarChart3, title: 'Аналитика и отчёты', text: 'Дашборды и отчёты по сделкам, продажам и активности команды.' },
  { icon: Shield, title: 'Сотрудники и роли', text: 'Владелец, администратор, менеджер — гибкая настройка доступа и прав.' },
  { icon: Wallet, title: 'Финансы и транзакции', text: 'Учёт операций по объектам и проектам, одобрение, лента операций.' },
  { icon: Package, title: 'Склад и материалы', text: 'Остатки, приходы и расходы с привязкой к объектам. Для производства и строительства.' },
];

const FOR_COMPANIES = [
  'Малый бизнес',
  'Отделы продаж',
  'Компании с WhatsApp-заявками',
  'Строительные компании',
  'Производство',
  'Сервисные компании',
  'Команды с несколькими менеджерами',
  'Проектные компании',
];

const FLOW_STEPS = [
  'Заявка приходит',
  'Попадает в CRM',
  'Менеджер работает с клиентом',
  'Сделка идёт по этапам',
  'Руководитель видит аналитику',
  'Команда работает в одной системе',
];

const FOR_LEADER = [
  'Контроль заявок',
  'Контроль менеджеров',
  'Единая история клиентов',
  'Прозрачность сделок',
  'Аналитика по воронке',
  'Снижение хаоса в коммуникациях',
  'Больше управляемости',
];

const WHY_2WIX = [
  { icon: LayoutDashboard, title: 'Всё в одном окне', text: 'Клиенты, заявки, сделки, WhatsApp, финансы и склад — один интерфейс, без переключения между сервисами.' },
  { icon: Layers, title: 'Гибкость под бизнес', text: 'Один продукт для разных сценариев: продажи, производство, строительство, сервис. Настраиваемые модули.' },
  { icon: MessageSquare, title: 'Коммуникации + сделки + аналитика', text: 'Переписка связана с клиентом и сделкой. Отчёты показывают результат работы с заявками.' },
  { icon: Zap, title: 'Быстрый запуск', text: 'Начать работу без долгого внедрения. Создали компанию — пригласили сотрудников — работаете.' },
  { icon: Users, title: 'Работа команды', text: 'Роли и права, назначение ответственных, общая база клиентов. Команда в одной системе.' },
  { icon: Eye, title: 'Прозрачность для руководителя', text: 'Видно, кто что делает, сколько заявок в работе, где теряются клиенты. Управленческая аналитика.' },
];

const PREVIEW_ITEMS = [
  { label: 'Список клиентов', icon: List },
  { label: 'WhatsApp', icon: MessageSquare },
  { label: 'Сделки', icon: GitBranch },
  { label: 'Аналитика', icon: BarChart3 },
  { label: 'Карточка клиента', icon: Users },
  { label: 'Роли и фильтры', icon: Filter },
  { label: 'Мобильная версия', icon: Smartphone },
];

const FAQ_ITEMS = [
  { q: 'Что такое CRM для бизнеса?', a: 'CRM для бизнеса — это система, в которой ведут клиентов, заявки, сделки, переписку и отчётность в одном месте. Руководитель видит полную картину, команда работает по единым процессам, заявки не теряются. 2wix — именно такая CRM: клиенты, продажи, WhatsApp, аналитика, финансы и склад в одной платформе.' },
  { q: 'Подходит ли 2wix для малого бизнеса?', a: 'Да. 2wix рассчитан на малый и средний бизнес. Запуск без сложного внедрения: создали компанию, пригласили сотрудников — можно начинать вести клиентов и заявки. Модули подключаются по мере необходимости.' },
  { q: 'Можно ли использовать систему не только в строительстве?', a: 'Да. 2wix — универсальная CRM для бизнеса. Строительство — один из сценариев (объекты, сметы, склад). Система одинаково подходит для отдела продаж, производства, сервисных команд и любых компаний с клиентами и заявками.' },
  { q: 'Есть ли WhatsApp и работа с чатами?', a: 'Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном интерфейсе, быстрые ответы и шаблоны, связь чатов с клиентом и сделкой. Заявки из мессенджера попадают в воронку.' },
  { q: 'Можно ли вести продажи и воронку?', a: 'Да. Воронка сделок с этапами, назначение ответственных, перенос между этапами и отчётность по конверсии. Всё необходимое для управления продажами и отделом.' },
  { q: 'Есть ли аналитика и контроль сотрудников?', a: 'Да. Дашборды и отчёты по сделкам, заявкам и активности. Роли и права доступа: владелец, администратор, менеджер. Руководитель видит нагрузку и результат по каждому.' },
  { q: 'Можно ли адаптировать систему под свою компанию?', a: 'Да. Этапы воронки и разделы меню настраиваются. Роли и права гибкие. Можно использовать только клиентов и сделки или подключать финансы, склад и документы — в зависимости от задач бизнеса.' },
];

export const CrmDlyaBiznesaPage: React.FC = () => {
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
                Соберите клиентов, сделки, WhatsApp и аналитику в одной CRM
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает бизнесу работать с клиентами, продажами, коммуникациями и внутренними процессами в одной системе.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
                >
                  Попробовать
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/vozmozhnosti"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder hover:bg-sf-backgroundSection transition-all"
                >
                  Посмотреть возможности
                </Link>
              </div>
            </div>
            <div className="rounded-sfCard border border-sf-border bg-sf-surface shadow-xl shadow-sfCard overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-sf-backgroundSection to-sf-primaryLight/30 flex items-center justify-center p-8">
                <div className="w-full max-w-sm rounded-xl bg-sf-surface border border-sf-border shadow-lg p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-sf-borderLight">
                    <LayoutDashboard className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">Рабочий стол</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Клиенты', 'Сделки', 'Чаты', 'Аналитика'].map((label) => (
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

      {/* Зачем бизнесу нужна CRM */}
      <section className="py-16 md:py-24 bg-sf-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Зачем бизнесу нужна CRM</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы заявки, клиенты и коммуникации живут в хаосе. CRM возвращает порядок и контроль.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {WHY_CRM.map(({ title, text }) => (
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

      {/* Что закрывает 2wix */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что закрывает 2wix</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Не только «про клиентов» — рабочая система для управления бизнесом
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHAT_CLOSES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Для каких компаний подходит */}
      <section className="py-16 md:py-24 bg-sf-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Для каких компаний подходит</h2>
          <p className="text-sf-text-secondary text-center mb-12">Универсальная CRM для разных типов бизнеса и отраслей</p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {FOR_COMPANIES.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-xl border border-sf-border bg-sf-backgroundSection/50 px-5 py-4">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Как это работает */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает</h2>
          <p className="text-sf-text-secondary text-center mb-14">Простая логика: от заявки до результата в одной системе</p>
          <ol className="space-y-4">
            {FLOW_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-surface p-5">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-sf-primary text-sf-text-inverse font-bold flex items-center justify-center">{i + 1}</span>
                <span className="font-medium text-sf-text-primary">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Чем 2wix полезен руководителю */}
      <section className="py-16 md:py-24 bg-sf-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Чем 2wix полезен руководителю</h2>
          <p className="text-sf-text-secondary text-center mb-12">Что получает владелец бизнеса от внедрения CRM</p>
          <ul className="grid sm:grid-cols-2 gap-4">
            {FOR_LEADER.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-cardBorder bg-sf-primaryLight/50 px-5 py-4">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Screenshots / Product Preview */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс продукта</h2>
          <p className="text-sf-text-secondary text-center mb-14">Клиенты, WhatsApp, сделки, аналитика и права — в одном продукте</p>
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

      {/* Почему 2wix */}
      <section className="py-16 md:py-24 bg-sf-surface">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему 2wix</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Преимущества системы для бизнеса
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_2WIX.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6">
                <div className="w-11 h-11 rounded-xl bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Запустите CRM, которая собирает клиентов, продажи и процессы в одной системе
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Начните бесплатно — создайте компанию и пригласите команду.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sf-text-primary bg-sf-surface hover:bg-sf-surfaceElevated shadow-xl transition-all"
            >
              Создать компанию
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white/95 border-2 border-white/40 hover:border-white/50 hover:text-sf-text-inverse transition-all"
            >
              Попробовать
            </button>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sf-text-inverse border-2 border-white/50 hover:border-white/60 transition-all"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы и ответы</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы о CRM для бизнеса в 2wix</p>
          <ul className="space-y-6">
            {FAQ_ITEMS.map(({ q, a }) => (
              <li key={q} className="rounded-sfCard border border-sf-border bg-sf-surface p-6">
                <h3 className="font-semibold text-sf-text-primary mb-2">{q}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed">{a}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <Link to="/faq" className="text-sf-accent font-medium hover:text-sf-primaryHover">
              Все вопросы и ответы →
            </Link>
          </div>
        </div>
      </section>

      {/* Перелинковка */}
      <section className="py-16 md:py-24 bg-sf-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sf-text-primary text-center mb-10">Полезные разделы</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className="px-5 py-2.5 rounded-xl bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Главная
            </Link>
            <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-xl bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Возможности
            </Link>
            <Link to="/crm-dlya-prodazh" className="px-5 py-2.5 rounded-xl bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              CRM для продаж
            </Link>
            <Link to="/whatsapp-crm" className="px-5 py-2.5 rounded-xl bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              WhatsApp CRM
            </Link>
            <Link to="/ceny" className="px-5 py-2.5 rounded-xl bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Цены
            </Link>
            <Link to="/faq" className="px-5 py-2.5 rounded-xl bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </section>

      <PublicCTA />
    </SEOPageLayout>
  );
};
