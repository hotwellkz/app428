import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { PublicProductPreview } from '../../public';
import {
  Users,
  MessageSquare,
  GitBranch,
  Zap,
  BarChart3,
  Wallet,
  Package,
  Shield,
  ArrowRight,
  Check,
  Phone,
} from 'lucide-react';

const TITLE = 'Возможности CRM 2wix — функции и модули для бизнеса';
const DESCRIPTION =
  'Полный обзор возможностей CRM 2wix: клиенты, WhatsApp, телефония и звонки, сделки, быстрые ответы, аналитика, транзакции, склад, роли и права. Единая система для продаж и операционного управления.';

const FEATURE_BLOCKS = [
  { icon: Users, title: 'Клиенты', slug: 'klienty', to: '/klienty', desc: 'Единая база клиентов с контактами, историей общения и статусами.' },
  { icon: MessageSquare, title: 'WhatsApp и чаты', slug: 'whatsapp-i-chaty', to: '/whatsapp-i-chaty', desc: 'Переписка с клиентами, быстрые ответы и медиа-шаблоны в одном интерфейсе.' },
  { icon: Phone, title: 'Телефония и звонки', slug: 'crm-twilio', to: '/crm-twilio', desc: 'Исходящие звонки и голосовые сценарии в CRM; подключение voice-провайдера (например Twilio) на уровне компании.' },
  { icon: GitBranch, title: 'Сделки и воронка', slug: 'sdelki-i-voronka', to: '/sdelki-i-voronka', desc: 'Воронка продаж, этапы, назначение менеджеров и контроль конверсии.' },
  { icon: Zap, title: 'Быстрые ответы и шаблоны', slug: 'bystrye-otvety', to: '/bystrye-otvety', desc: 'Шаблоны сообщений и документов для типовых ситуаций.' },
  { icon: BarChart3, title: 'Аналитика и отчёты', slug: 'analitika', to: '/analitika', desc: 'Показатели по менеджерам, сделкам, обращениям и активности.' },
  { icon: Wallet, title: 'Транзакции и финансы', slug: 'tranzakcii-i-finansy', to: '/tranzakcii-i-finansy', desc: 'Учёт операций по объектам, одобрение и лента операций.' },
  { icon: Package, title: 'Склад и материалы', slug: 'sklad-i-materialy', to: '/sklad-i-materialy', desc: 'Остатки, приходы и расходы, привязка к объектам и проектам.' },
  { icon: Shield, title: 'Роли, сотрудники и права', slug: 'roli-i-prava', to: '/roli-i-prava', desc: 'Владелец, администратор, менеджер. Гибкая настройка доступа.' },
];

const DETAIL_SECTIONS = [
  { id: 'klienty', title: 'Клиенты', to: '/klienty', desc: 'Храните базу клиентов, комментарии, контакты, историю общения и статусы в одном месте. Единая карточка по каждому клиенту — основа для продаж и сервиса.', bullets: ['Карточка клиента с контактами и историей', 'Связь с сделками и перепиской', 'Файлы и документы по клиенту', 'Удобный поиск и фильтры'] },
  { id: 'whatsapp', title: 'WhatsApp и чаты', to: '/whatsapp-i-chaty', desc: 'Работайте с перепиской, быстрыми ответами, медиа-шаблонами и чатами в одном интерфейсе. Заявки из мессенджера не теряются и попадают в CRM.', bullets: ['Все диалоги в одном окне', 'Быстрые ответы и шаблоны сообщений', 'Связь чата со сделкой и клиентом', 'Контроль менеджеров и нагрузка'] },
  { id: 'telefoniya', title: 'Телефония и звонки', to: '/crm-twilio', desc: 'Телефония в CRM для продаж: исходящие звонки, статусы, история и связка со сделкой. Voice-провайдер (например Twilio) подключается в настройках компании; биллинг телефонии — в вашем аккаунте у провайдера.', bullets: ['Звонки в контексте клиента и сделки', 'Голосовые сценарии и автоматизация касаний', 'Callback и повторные попытки дозвона', 'Единая картина: WhatsApp + звонки + воронка'] },
  { id: 'sdelki', title: 'Сделки и воронка', to: '/sdelki-i-voronka', desc: 'Ведите сделки по этапам, назначайте менеджеров, отслеживайте статусы и контролируйте воронку. Прозрачность для руководителя и удобство для отдела продаж.', bullets: ['Воронка с настраиваемыми этапами', 'Перенос сделок между этапами', 'Ответственный и сроки', 'Отчётность по конверсии'] },
  { id: 'bystrye-otvety', title: 'Быстрые ответы и шаблоны', to: '/bystrye-otvety', desc: 'Шаблоны сообщений для типовых ситуаций и шаблоны документов по сделкам. Ускорение работы менеджеров и единый стандарт общения.', bullets: ['Текстовые шаблоны для чатов', 'Медиа-шаблоны (изображения)', 'Шаблоны договоров и документов', 'Быстрая вставка в переписку'] },
  { id: 'analitika', title: 'Аналитика и отчёты', to: '/analitika', desc: 'Смотрите показатели по менеджерам, обращениям, сделкам, непрочитанным и активности. Управленческая аналитика для принятия решений.', bullets: ['Дашборды и сводные показатели', 'Отчёты по сделкам и конверсии', 'Активность команды и нагрузка', 'Экспорт и детализация'] },
  { id: 'tranzakcii', title: 'Транзакции и финансы', to: '/tranzakcii-i-finansy', desc: 'Фиксируйте операции по объектам и проектам: приходы, расходы, переводы. Одобрение транзакций и лента операций для полного контроля.', bullets: ['Операции по объектам и категориям', 'Одобрение и статусы транзакций', 'Лента операций и история', 'Связь с клиентами и сделками'] },
  { id: 'sklad', title: 'Склад и материалы', to: '/sklad-i-materialy', desc: 'Остатки, приходы и расходы с привязкой к объектам и проектам. Учёт для производства, строительства и любых бизнесов с материалами.', bullets: ['Справочник товаров и материалов', 'Приходы и расходы по объектам', 'Остатки и движение', 'Документы и накладные'] },
  { id: 'roli', title: 'Роли, сотрудники и права', to: '/roli-i-prava', desc: 'Владелец, администратор, менеджер, сотрудник — гибкая настройка доступа к разделам и действиям. Дополнительные права, например одобрение транзакций.', bullets: ['Роли и доступ к разделам меню', 'Приглашение сотрудников', 'Права на одобрение и удаление', 'Прозрачность действий'] },
];

const FLOW_STEPS = [
  { title: 'Клиент пишет в WhatsApp', sub: 'Обращение попадает в CRM' },
  { title: 'Менеджер отвечает', sub: 'Быстрые ответы и шаблоны' },
  { title: 'Создаётся сделка', sub: 'Воронка и этапы' },
  { title: 'Фиксируются финансы', sub: 'Транзакции и объекты' },
  { title: 'Аналитика показывает результат', sub: 'Отчёты и дашборды' },
];

const TASKS = [
  'Управление заявками',
  'Контроль продаж',
  'Коммуникация с клиентами',
  'Аналитика отдела продаж',
  'Операционный контроль',
  'Управление сотрудниками',
  'Фиксация расходов и движения денег',
  'Работа с материалами и складом',
];

const FAQ_ITEMS = [
  { q: 'Что входит в 2wix?', a: 'В 2wix входят модули: клиенты, WhatsApp и чаты, сделки и воронка, быстрые ответы и шаблоны, аналитика, транзакции и финансы, склад и материалы, роли и права доступа. Всё в одной системе.' },
  { q: 'Подходит ли 2wix для малого бизнеса?', a: 'Да. 2wix рассчитан на малый и средний бизнес и отделы продаж. Запуск без длительного внедрения, гибкая настройка под размер команды.' },
  { q: 'Можно ли работать через WhatsApp?', a: 'Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном интерфейсе, быстрые ответы, связь чатов со сделками и клиентской базой.' },
  { q: 'Есть ли сделки и воронка?', a: 'Да. Воронка продаж с этапами, перенос сделок, назначение менеджеров и отчётность по конверсии. Полный цикл от заявки до результата.' },
  { q: 'Можно ли вести сотрудников и роли?', a: 'Да. Настраиваются роли (владелец, администратор, менеджер, сотрудник), доступ к разделам меню и дополнительные права, например одобрение транзакций.' },
  { q: 'Есть ли аналитика и отчёты?', a: 'Да. Дашборды, отчёты по сделкам, продажам и активности команды. Управленческая аналитика для контроля и планирования.' },
];

export const VozmozhnostiPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION}>
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight">
            Все возможности 2wix в одной CRM-системе
          </h1>
          <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-3xl mx-auto leading-relaxed">
            Управление клиентами, WhatsApp, сделками, аналитикой, сотрудниками, финансами и операционными процессами в одной системе.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
            >
              Попробовать
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder hover:bg-sf-backgroundSection transition-all"
            >
              Создать компанию
            </button>
          </div>
          <div className="mt-12 max-w-3xl mx-auto">
            <PublicProductPreview />
          </div>
        </div>
      </section>

      {/* Короткий обзор */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-sf-text-primary mb-6">Один продукт — полный цикл</h2>
          <p className="text-sf-text-secondary leading-relaxed">
            2wix объединяет клиентскую базу, коммуникации в WhatsApp, воронку продаж, аналитику, финансы и склад в одной платформе. Вы не переключаетесь между сервисами: заявка из чата становится сделкой, операция фиксируется в финансах, а отчёты показывают результат. Система подходит для разных отраслей — от отдела продаж до производства и строительства.
          </p>
        </div>
      </section>

      {/* 8 функциональных блоков — grid */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Ключевые блоки продукта</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Всё необходимое для продаж, коммуникаций и операционного управления
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURE_BLOCKS.map(({ icon: Icon, title, to, desc }) => (
              <div
                key={title}
                className="group rounded-sfCard border border-sf-border bg-sf-surface p-6 shadow-sm hover:shadow-lg hover:border-sf-cardBorder transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-4 group-hover:bg-sf-primaryLight transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{title}</h3>
                <p className="text-sf-text-secondary text-sm leading-relaxed mb-4">{desc}</p>
                <Link
                  to={to}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sf-accent hover:text-sf-primary"
                >
                  Подробнее
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Подробные секции по каждому блоку */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-sf-text-primary text-center mb-14">Подробнее о каждом блоке</h2>
          <div className="space-y-20">
            {DETAIL_SECTIONS.map(({ id, title, to, desc, bullets }) => (
              <div key={id} id={id} className="scroll-mt-28">
                <h3 className="text-2xl font-bold text-sf-text-primary mb-4">{title}</h3>
                <p className="text-sf-text-secondary leading-relaxed mb-6">{desc}</p>
                <ul className="space-y-2 mb-6">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sf-text-secondary">
                      <Check className="w-4 h-4 text-sf-accent flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  to={to}
                  className="inline-flex items-center gap-2 text-sm font-medium text-sf-accent hover:text-sf-primary"
                >
                  Узнать больше
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как это работает вместе */}
      <section className="py-20 md:py-28 bg-sf-backgroundSection/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает вместе</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            2wix — не набор разрозненных функций, а единая система. От обращения до результата.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="rounded-sfCard border border-sf-border bg-sf-surface p-5 shadow-sm h-full">
                  <span className="inline-flex w-8 h-8 rounded-lg bg-sf-primaryLight text-sf-primary font-semibold text-sm items-center justify-center mb-3">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-sf-text-primary mb-1">{step.title}</h3>
                  <p className="text-sm text-sf-text-secondary">{step.sub}</p>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-sf-border -translate-y-1/2 z-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Для каких задач подходит */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-sf-text-primary text-center mb-4">Для каких задач подходит</h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Система закрывает ключевые бизнес-задачи продаж и операционного управления
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {TASKS.map((task) => (
              <li key={task} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-4 py-3">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{task}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Попробуйте 2wix и соберите продажи, WhatsApp и процессы в одной системе
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Создайте компанию за минуту и начните вести клиентов, сделки и коммуникации в одном месте.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-primary bg-sf-surface hover:bg-sf-borderLight shadow-xl transition-all"
            >
              Создать компанию
              <ArrowRight className="w-5 h-5" />
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

      {/* FAQ mini-block */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-sf-text-primary text-center mb-12">Частые вопросы о возможностях</h2>
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

      <PublicCTA />
    </SEOPageLayout>
  );
};
