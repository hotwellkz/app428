import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import {
  MessageSquare,
  Zap,
  Users,
  GitBranch,
  History,
  BarChart2,
  List,
  Image,
  Filter,
  Smartphone,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  FileText,
  MessageCircle,
  Shield,
} from 'lucide-react';

const TITLE = 'WhatsApp CRM для бизнеса — 2wix | Переписка, заявки и сделки в одной системе';
const DESCRIPTION =
  'WhatsApp CRM от 2wix: единый интерфейс чатов, быстрые ответы, привязка к сделкам и клиентам. Управляйте заявками из мессенджера, контролируйте менеджеров и не теряйте обращения. CRM для отдела продаж и бизнеса с WhatsApp.';

const PROBLEMS = [
  { text: 'Заявки теряются в личных WhatsApp менеджеров' },
  { text: 'Невозможно контролировать переписку' },
  { text: 'Нет единой истории по клиенту' },
  { text: 'Сложно распределять обращения между менеджерами' },
  { text: 'Нет связи между чатом и сделкой' },
  { text: 'Менеджеры отвечают по-разному, нет стандартов' },
  { text: 'Нет аналитики по коммуникации' },
];

const FEATURES = [
  { icon: List, title: 'Единый список чатов', text: 'Все диалоги в одном окне. Фильтры по непрочитанным, ожидающим ответа и менеджерам.' },
  { icon: Zap, title: 'Быстрые ответы и шаблоны', text: 'Текстовые шаблоны для типовых ситуаций. Один клик — готовое сообщение в чате.' },
  { icon: Image, title: 'Медиа-шаблоны', text: 'Шаблоны с изображениями и картинками для быстрой отправки клиентам.' },
  { icon: GitBranch, title: 'Привязка к сделкам', text: 'Чат связан с клиентом и сделкой. Заявка из переписки попадает в воронку.' },
  { icon: Users, title: 'Назначение менеджеров', text: 'Распределение чатов между менеджерами, роли и прозрачность для руководителя.' },
  { icon: Filter, title: 'Непрочитанные, статусы, фильтры', text: 'Фильтры по статусу, непрочитанным и ответственным. Ни одно обращение не теряется.' },
  { icon: MessageCircle, title: 'Работа с голосовыми, фото, видео, файлами', text: 'Поддержка всех типов сообщений WhatsApp в одном интерфейсе.' },
  { icon: History, title: 'История клиента', text: 'Вся переписка и взаимодействия по клиенту в одной карточке. Контекст для любого сотрудника.' },
  { icon: BarChart2, title: 'Аналитика по переписке', text: 'Объёмы переписки, скорость ответов, активность менеджеров. Отчёты для оптимизации.' },
  { icon: Shield, title: 'Контроль и права', text: 'Кто видит какие чаты, кто может отвечать. Единое пространство для команды.' },
];

const FLOW_STEPS = [
  'Клиент пишет в WhatsApp',
  'Сообщение попадает в 2wix',
  'Менеджер отвечает из CRM',
  'Создаётся или привязывается сделка',
  'Сохраняется история клиента',
  'Руководитель видит контроль и аналитику',
];

const FOR_WHO = [
  'Для отдела продаж',
  'Для бизнеса с большим потоком заявок',
  'Для компаний с несколькими менеджерами',
  'Для сервисных команд',
  'Для строительных компаний',
  'Для производства',
  'Для компаний, где WhatsApp — основной канал общения',
];

const VS_WHATSAPP = [
  { normal: 'Переписка в личных аккаунтах', crm: 'Общий доступ команды к чатам' },
  { normal: 'Риск потери переписки при уходе сотрудника', crm: 'Вся история в CRM, ничего не теряется' },
  { normal: 'Нет фильтров и статусов', crm: 'Фильтры, непрочитанные, ожидающие ответа' },
  { normal: 'Нет ролей и контроля', crm: 'Менеджеры, роли, прозрачность для руководителя' },
  { normal: 'Каждый отвечает как умеет', crm: 'Шаблоны ответов и единый стандарт' },
  { normal: 'Чат отдельно от продаж', crm: 'Связь чата со сделкой и воронкой' },
  { normal: 'Нет отчётности по переписке', crm: 'Аналитика по сообщениям и менеджерам' },
  { normal: 'История размазана по чатам', crm: 'Единая история клиента в карточке' },
];

const PREVIEW_ITEMS = [
  { label: 'Список чатов', icon: List },
  { label: 'Карточка клиента', icon: Users },
  { label: 'Шаблоны', icon: FileText },
  { label: 'Фильтры', icon: Filter },
  { label: 'Сделки', icon: GitBranch },
  { label: 'Мобильная версия', icon: Smartphone },
];

const FAQ_ITEMS = [
  { q: 'Что такое WhatsApp CRM?', a: 'WhatsApp CRM — это система, в которой переписка с клиентами из мессенджера ведётся внутри CRM: все чаты в одном интерфейсе, связь с клиентской базой и сделками, шаблоны ответов, контроль менеджеров и аналитика. Заявки из WhatsApp не теряются и попадают в воронку продаж.' },
  { q: 'Чем 2wix отличается от обычного WhatsApp?', a: 'В 2wix переписка ведётся из единого интерфейса CRM: общий доступ команды, привязка чата к клиенту и сделке, быстрые ответы и шаблоны, назначение менеджеров, фильтры по статусам и аналитика. Руководитель видит всю картину, история не теряется при смене сотрудника.' },
  { q: 'Можно ли работать нескольким менеджерам?', a: 'Да. В 2wix можно назначать ответственных за чаты, распределять обращения между менеджерами и настраивать права доступа. Руководитель видит нагрузку и может перераспределять диалоги.' },
  { q: 'Есть ли шаблоны ответов?', a: 'Да. В 2wix есть текстовые шаблоны сообщений и медиа-шаблоны (изображения). Один клик — и готовое сообщение в чате. Это ускоряет работу и задаёт единый стандарт общения.' },
  { q: 'Можно ли привязать чат к сделке?', a: 'Да. Чат в 2wix связан с карточкой клиента и сделкой. Заявка из переписки может сразу попадать в воронку продаж. Вся история общения доступна в карточке клиента и сделки.' },
  { q: 'Подходит ли 2wix для бизнеса с большим потоком сообщений?', a: 'Да. Единый список чатов, фильтры по непрочитанным и статусам, распределение между менеджерами и быстрые ответы помогают справляться с большим потоком обращений. Аналитика показывает нагрузку и скорость ответов.' },
  { q: 'Есть ли мобильная версия?', a: 'Да. 2wix корректно работает в мобильном браузере: можно отвечать клиентам, смотреть чаты и сделки с телефона. Удобно для сервисных и полевых сотрудников.' },
  { q: 'Можно ли использовать не только для стройки?', a: 'Да. WhatsApp CRM в 2wix универсален: подходит для отдела продаж, сервисных команд, производства, услуг и любого бизнеса, где клиенты пишут в мессенджер. Строительство — один из сценариев, но не единственный.' },
];

export const WhatsAppCrmPage: React.FC = () => {
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
                Управляйте WhatsApp-перепиской, клиентами и сделками в одной CRM
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает собирать заявки, отвечать клиентам, работать с шаблонами, контролировать менеджеров и видеть всю историю общения в одном интерфейсе.
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
              <div className="aspect-video bg-gradient-to-br from-sf-primaryLight to-sf-backgroundSection flex items-center justify-center p-8">
                <div className="w-full max-w-sm rounded-sfCard bg-sf-surface border border-sf-border shadow-lg p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-sf-borderLight">
                    <MessageSquare className="w-5 h-5 text-sf-accent" />
                    <span className="font-semibold text-sf-text-primary">Чаты</span>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-lg bg-sf-backgroundSection">
                        <div className="w-9 h-9 rounded-full bg-sf-border" />
                        <div className="flex-1 min-w-0">
                          <div className="h-3 bg-sf-border rounded w-3/4" />
                          <div className="h-2 bg-sf-borderLight rounded w-1/2 mt-1" />
                        </div>
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Какие проблемы решает WhatsApp CRM</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без CRM переписка в WhatsApp создаёт риски и хаос. 2wix возвращает порядок и контроль.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEMS.map(({ text }) => (
              <div key={text} className="flex items-start gap-3 rounded-sfCard border border-red-100 bg-red-50/50 p-5">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sf-text-secondary font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что умеет WhatsApp CRM в 2wix */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Что умеет WhatsApp CRM в 2wix</h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Всё необходимое для работы с перепиской, заявками и командой в одном интерфейсе
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
          <p className="text-sf-text-secondary text-center mb-14">От сообщения в мессенджере до сделки и отчёта — в одной системе</p>
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

      {/* Для кого подходит */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Для кого подходит</h2>
          <p className="text-sf-text-secondary text-center mb-12">WhatsApp CRM в 2wix используют в разных отраслях и типах бизнеса</p>
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

      {/* Почему удобнее обычного WhatsApp */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Почему это удобнее обычного WhatsApp</h2>
          <p className="text-sf-text-secondary text-center mb-14">Сравнение подхода «каждый со своим WhatsApp» и работы через CRM</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse rounded-sfCard overflow-hidden border border-sf-border">
              <thead>
                <tr className="bg-sf-borderLight">
                  <th className="text-left py-4 px-5 font-semibold text-sf-text-secondary border-b border-sf-border">Обычный WhatsApp</th>
                  <th className="text-left py-4 px-5 font-semibold text-sf-primary border-b border-sf-border bg-sf-primaryLight/50">2wix WhatsApp CRM</th>
                </tr>
              </thead>
              <tbody>
                {VS_WHATSAPP.map((row, i) => (
                  <tr key={i} className="border-b border-sf-borderLight last:border-0">
                    <td className="py-4 px-5 text-sf-text-secondary">
                      <span className="inline-flex items-center gap-2">
                        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                        {row.normal}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-sf-text-primary bg-sf-primaryLight/30">
                      <span className="inline-flex items-center gap-2">
                        <Check className="w-4 h-4 text-sf-accent flex-shrink-0" />
                        {row.crm}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Screenshots / UI Preview */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Интерфейс WhatsApp CRM</h2>
          <p className="text-sf-text-secondary text-center mb-14">Всё под рукой: чаты, клиенты, шаблоны и сделки в одном продукте</p>
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
            Соберите WhatsApp, клиентов и сделки в одной CRM
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Начните вести переписку из 2wix — без потери заявок, с контролем команды и связью со сделками.
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
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse border-2 border-sf-border hover:border-sf-borderLight transition-all"
            >
              Войти
            </Link>
            <Link
              to="/vozmozhnosti"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-white/90 hover:text-white border-2 border-white/40 hover:border-white/60 transition-all"
            >
              Попробовать демо
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Вопросы и ответы</h2>
          <p className="text-sf-text-secondary text-center mb-14">Частые вопросы о WhatsApp CRM в 2wix</p>
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
            <Link to="/crm-dlya-prodazh" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              CRM для продаж
            </Link>
            <Link to="/crm-dlya-biznesa" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              CRM для бизнеса
            </Link>
            <Link to="/whatsapp-i-chaty" className="px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors">
              WhatsApp и чаты (подробнее)
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
