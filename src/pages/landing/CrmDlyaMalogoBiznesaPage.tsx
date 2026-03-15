import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import {
  MessageSquare,
  GitBranch,
  BarChart3,
  Users,
  ArrowRight,
  Check,
  AlertCircle,
  LayoutDashboard,
  Zap,
  Eye,
  Filter,
  Smartphone,
  Inbox,
  Shield,
  Target,
} from 'lucide-react';

const TITLE = 'CRM для малого бизнеса — простая система для клиентов, сделок и WhatsApp';
const DESCRIPTION =
  '2wix — удобная CRM для малого бизнеса и небольшой команды. Клиенты, заявки, WhatsApp и аналитика в одном месте. Без сложного внедрения. Подходит для компании из нескольких человек.';

const WHY_SMB_NEEDS_CRM = [
  { title: 'Заявки теряются', text: 'Обращения остаются в личных чатах, в почте или в блокноте. Нет единого места — часть клиентов не получает ответ.' },
  { title: 'Клиенты и переписки разбросаны', text: 'Нет общей базы: кто звонил, что обещали, на каком этапе сделка. Всё держится в голове или в разных мессенджерах.' },
  { title: 'Всё держится на одном человеке', text: 'Если владелец или ключевой менеджер недоступен — никто не видит полную картину. Нет прозрачности для команды.' },
  { title: 'Нет прозрачности по продажам', text: 'Сложно понять, сколько заявок пришло, кто ответил, где застряли сделки. Только «устные отчёты».' },
  { title: 'Сложно контролировать менеджеров', text: 'Несколько человек отвечают клиентам — непонятно, кто что ведёт и не дублируют ли друг друга.' },
  { title: 'Таблицы и мессенджеры не справляются', text: 'Excel и WhatsApp хороши на старте, но при росте заявок и команды перестают работать. Нужна система.' },
];

const WHAT_2WIX_GIVES_SMB = [
  { icon: Users, title: 'Единая база клиентов', text: 'Все контакты, история общения и сделок в одном месте. Никаких разрозненных чатов и таблиц.' },
  { icon: GitBranch, title: 'Сделки и этапы', text: 'Воронка продаж: от первой заявки до закрытия. Видно, на каком этапе каждый клиент.' },
  { icon: MessageSquare, title: 'WhatsApp в одном окне', text: 'Переписка с клиентами прямо в CRM. Заявки из мессенджера не теряются и попадают в воронку.' },
  { icon: Inbox, title: 'Быстрые ответы', text: 'Шаблоны ответов на типовые вопросы — меньше рутины, быстрее реакция на клиента.' },
  { icon: Target, title: 'Контроль входящих заявок', text: 'Все обращения в одном интерфейсе. Можно фильтровать по непрочитанным и назначать ответственного.' },
  { icon: Shield, title: 'Распределение между менеджерами', text: 'Несколько человек работают в одной системе: роли, права и общая база без путаницы.' },
  { icon: BarChart3, title: 'Аналитика по продажам', text: 'Собственник видит, сколько заявок, как идёт воронка и как работает команда.' },
  { icon: LayoutDashboard, title: 'Меньше хаоса в работе', text: 'Один инструмент вместо пяти: клиенты, чаты, сделки, отчёты — без переключения между сервисами.' },
];

const FOR_WHICH_TEAMS = [
  '1 собственник + 1 менеджер',
  'Небольшая команда продаж',
  'Компания с заявками из WhatsApp',
  'Сервисная компания',
  'Производство',
  'Строительство',
  'Локальный бизнес с несколькими сотрудниками',
];

const NOT_COMPLICATED = [
  { title: 'Не нужно долго внедрять', text: 'Создали компанию, пригласили сотрудников — можно начинать. Без месячных проектов и сложной настройки.' },
  { title: 'Понятный интерфейс', text: 'Удобная CRM для малого бизнеса: разобраться может любой. Не нужен отдельный специалист по внедрению.' },
  { title: 'Быстрый старт', text: 'Начали вести клиентов и заявки в первый же день. Постепенно подключаете сделки, чаты и отчёты.' },
  { title: 'Всё в одном месте', text: 'Не нужно собирать данные из почты, мессенджеров и таблиц вручную. Один вход — полная картина.' },
  { title: 'Можно расти постепенно', text: 'Начните с базового набора. Когда понадобится больше возможностей — они уже есть в системе.' },
];

const FLOW_STEPS = [
  'Клиент пишет или оставляет заявку',
  'Контакт попадает в систему',
  'Менеджер ведёт клиента по этапам',
  'Переписка и история сохраняются',
  'Собственник видит статус и аналитику',
];

const PREVIEW_ITEMS = [
  { label: 'WhatsApp', icon: MessageSquare },
  { label: 'Сделки', icon: GitBranch },
  { label: 'Аналитика', icon: BarChart3 },
  { label: 'Карточка клиента', icon: Users },
  { label: 'Команда и права', icon: Filter },
  { label: 'Мобильная версия', icon: Smartphone },
];

const WHY_2WIX_FOR_SMB = [
  { icon: LayoutDashboard, title: 'Всё в одном месте', text: 'Клиенты, заявки, WhatsApp, сделки и отчёты — один продукт вместо нескольких сервисов.' },
  { icon: Zap, title: 'Не нужно 5 разных сервисов', text: 'Один аккаунт для всей команды. Меньше подписок и путаницы.' },
  { icon: Eye, title: 'Удобно для собственника', text: 'Видно, что происходит с заявками и кто что ведёт. Контроль без ежедневных созвонов.' },
  { icon: Users, title: 'Подходит для маленькой команды', text: 'Рассчитано на малый бизнес: от одного до нескольких менеджеров. Без лишней сложности.' },
  { icon: Zap, title: 'Можно начать быстро', text: 'Регистрация и первый клиент — за минуты. Не нужен долгий цикл внедрения.' },
  { icon: GitBranch, title: 'Можно расти дальше', text: 'Когда команда и объём вырастут, те же инструменты масштабируются. Не придётся менять систему.' },
  { icon: MessageSquare, title: 'Подходит для бизнеса с WhatsApp', text: 'Если заявки приходят в мессенджер — они сразу попадают в CRM и не теряются.' },
];

const FAQ_ITEMS = [
  { q: 'Подходит ли 2wix для малого бизнеса?', a: 'Да. 2wix создан в том числе для малого бизнеса и небольшой команды. Единая база клиентов, сделки, WhatsApp и аналитика в одном месте. Запуск без сложного внедрения — можно начать вести заявки с первого дня.' },
  { q: 'Можно ли использовать систему в маленькой команде?', a: 'Да. Подходит для команды из нескольких человек: собственник, менеджер, администратор. Роли и права настраиваются. Все работают в одной системе, без разрозненных чатов и таблиц.' },
  { q: 'Сложно ли начать работу?', a: 'Нет. Регистрация и создание компании занимают минуты. Можно сразу добавлять клиентов и вести заявки. Интерфейс понятный, не требуется отдельный специалист по внедрению.' },
  { q: 'Подходит ли 2wix для заявок из WhatsApp?', a: 'Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном окне, заявки из мессенджера попадают в воронку. Удобно для малого бизнеса, где WhatsApp — основной канал общения с клиентами.' },
  { q: 'Можно ли потом масштабироваться?', a: 'Да. Начните с базового набора — клиенты, сделки, чаты. По мере роста подключайте аналитику, расширенную команду и дополнительные модули. Система растёт вместе с бизнесом.' },
  { q: 'Есть ли аналитика для собственника?', a: 'Да. Собственник видит отчёты по заявкам, сделкам и активности команды. Понятно, сколько обращений пришло, на каком этапе клиенты и как работают менеджеры.' },
];

export const CrmDlyaMalogoBiznesaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/crm-dlya-malogo-biznesa">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Простая CRM для малого бизнеса без хаоса в заявках и переписках
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает малому бизнесу собирать клиентов, вести сделки, отвечать в WhatsApp, контролировать команду и видеть аналитику в одном месте.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
                >
                  Попробовать бесплатно
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
                    <LayoutDashboard className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">CRM для малого бизнеса</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Клиенты', 'Сделки', 'WhatsApp', 'Аналитика'].map((label) => (
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

      {/* Почему малому бизнесу нужна CRM */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему малому бизнесу нужна CRM</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы заявки теряются, а клиенты и переписки разбросаны. CRM возвращает порядок и контроль даже в небольшой команде.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {WHY_SMB_NEEDS_CRM.map(({ title, text }) => (
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

      {/* Что даёт 2wix малому бизнесу */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что даёт 2wix малому бизнесу</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Всё необходимое для небольшой команды: клиенты, сделки, WhatsApp и отчёты в одной системе.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHAT_2WIX_GIVES_SMB.map(({ icon: Icon, title, text }) => (
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

      {/* Для каких команд подходит */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Для каких команд подходит</h2>
          <p className="text-sf-text-secondary text-center mb-12">
            CRM для небольшой компании: от одного менеджера до маленькой команды продаж или сервиса.
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {FOR_WHICH_TEAMS.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 px-5 py-4">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2wix не сложный для малого бизнеса */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">2wix не сложный для малого бизнеса</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Удобная CRM для малого бизнеса: быстрый старт, понятный интерфейс и рост по мере необходимости.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {NOT_COMPLICATED.map(({ title, text }) => (
              <div key={title} className="rounded-sfCard border border-sf-cardBorder bg-sf-surface p-6 shadow-sm">
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
          <p className="text-sf-text-secondary text-center mb-14">Простой сценарий: от заявки до результата в одной системе</p>
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

      {/* Скриншоты / превью продукта */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс продукта</h2>
          <p className="text-sf-text-secondary text-center mb-14">
            WhatsApp, сделки, аналитика, карточка клиента и права доступа — в одной CRM для малого бизнеса.
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

      {/* Почему 2wix подходит именно для малого бизнеса */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему 2wix подходит именно для малого бизнеса</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Всё в одном месте, без лишней сложности и с возможностью расти вместе с вами.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_2WIX_FOR_SMB.map(({ icon: Icon, title, text }) => (
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

      {/* CTA */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Запустите CRM для малого бизнеса, которая помогает не терять клиентов и лучше контролировать продажи
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Начните бесплатно — создайте компанию и пригласите команду.
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
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse border-2 border-sf-border hover:border-sf-borderLight transition-all"
            >
              Посмотреть цены
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы о CRM для малого бизнеса</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы о 2wix для небольшой компании</p>
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
            <Link to="/" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Главная
            </Link>
            <Link to="/crm-dlya-biznesa" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              CRM для бизнеса
            </Link>
            <Link to="/crm-dlya-prodazh" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              CRM для продаж
            </Link>
            <Link to="/whatsapp-crm" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              WhatsApp CRM
            </Link>
            <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Возможности
            </Link>
            <Link to="/ceny" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              Цены
            </Link>
            <Link to="/faq" className="px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </section>

      <PublicCTA />
    </SEOPageLayout>
  );
};
