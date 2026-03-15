import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import {
  GitBranch,
  ArrowRight,
  Check,
  AlertCircle,
  LayoutGrid,
  UserCheck,
  MessageSquare,
  Users,
  Filter,
  FileText,
  Target,
  ArrowDownRight,
} from 'lucide-react';

const TITLE =
  'Сделки и воронка продаж в CRM 2wix — этапы сделок, контроль воронки, управление продажами';
const DESCRIPTION =
  'Ведение сделок по этапам в 2wix: воронка продаж с настраиваемыми стадиями, привязка к клиенту и переписке, ответственный менеджер, сумма и статус. Контроль воронки для руководителя и отдела продаж. Подходит для любого бизнеса.';

const PROBLEMS = [
  { text: 'Сделки ведутся хаотично — в таблицах или «в голове»' },
  { text: 'Непонятно, на каком этапе каждый клиент' },
  { text: 'Менеджеры забывают двигать клиентов по воронке' },
  { text: 'Руководитель не видит, где зависли лиды' },
  { text: 'Сложно понять, сколько сделок реально в работе' },
  { text: 'Нет прозрачности по этапам и конверсии' },
  { text: 'Воронка есть только на бумаге или в Excel' },
  { text: 'Нет связи сделки с клиентом и перепиской' },
];

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Список сделок и этапы воронки',
    text: 'Все сделки в одном месте. Настраиваемые этапы под ваш процесс: от первого контакта до оплаты и завершения.',
  },
  {
    icon: LayoutGrid,
    title: 'Перемещение по стадиям',
    text: 'Перетаскивание или смена этапа в один клик. Сделка движется по воронке — видно, на какой стадии она сейчас.',
  },
  {
    icon: Users,
    title: 'Привязка к клиенту',
    text: 'Каждая сделка связана с карточкой клиента: контакты, история, переписка и документы в одном контексте.',
  },
  {
    icon: UserCheck,
    title: 'Ответственный менеджер',
    text: 'Назначение ответственного по сделке. Руководитель видит нагрузку и может перераспределять задачи.',
  },
  {
    icon: Target,
    title: 'Сумма и статус',
    text: 'Сумма сделки, сроки, комментарии и статус. Вся информация по сделке в одной карточке.',
  },
  {
    icon: MessageSquare,
    title: 'Связь с заявками и перепиской',
    text: 'Входящая заявка или сообщение из WhatsApp может превратиться в сделку. Переписка привязана к сделке и клиенту.',
  },
  {
    icon: Filter,
    title: 'Фильтрация и контроль',
    text: 'Фильтры по этапу, менеджеру, дате. Руководитель видит, где просадки и какие сделки требуют внимания.',
  },
];

const FUNNEL_STAGES = [
  'Новый лид',
  'Связались',
  'Встреча / замер / расчёт',
  'Предложение / смета',
  'Договор',
  'Оплата',
  'Завершение',
];

const HOW_IT_WORKS = [
  'Приходит заявка или сообщение от клиента',
  'Создаётся клиент и/или сделка в CRM',
  'Менеджер берёт сделку в работу',
  'Сделка двигается по этапам воронки',
  'Руководитель видит, где она находится и кто отвечает',
  'После оплаты и завершения всё остаётся в истории',
];

const FOR_LEADER = [
  'Сколько сделок на каждом этапе',
  'Где есть просадки в воронке',
  'Какие сделки зависли',
  'Кто из менеджеров что ведёт',
  'Сколько денег в работе',
  'Как движется воронка в целом',
];

const LINKED_BENEFITS = [
  'Сделка не «висит в воздухе» — у неё есть клиент с контактами и историей',
  'Вся переписка с клиентом доступна из карточки сделки',
  'Заявки из сайта, WhatsApp или звонков превращаются в сделки без потери контекста',
  'Руководитель и менеджер видят полную картину: кто, что, на каком этапе',
];

const PREVIEW_ITEMS = [
  { label: 'Воронка этапов', icon: GitBranch },
  { label: 'Карточка сделки', icon: FileText },
  { label: 'Клиент и переписка', icon: Users },
  { label: 'Ответственный', icon: UserCheck },
  { label: 'Фильтры', icon: Filter },
];

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-surface border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

export const SdelkiVoronkaPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/sdelki-i-voronka">
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                Сделки и воронка продаж в одной CRM
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix помогает вести клиентов от первого обращения до оплаты: фиксировать сделки,
                двигать их по этапам, назначать ответственных и видеть реальную картину по воронке
                продаж.
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
                    <span className="font-semibold text-sf-text-primary">Воронка</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {['Новая', 'В работе', 'Договор', 'Оплата'].map((label, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 w-20 rounded-lg bg-sf-backgroundSection border border-sf-borderLight p-2 text-center"
                      >
                        <div className="w-2 h-2 rounded-full bg-sf-primaryLight0 mx-auto mb-1" />
                        <span className="text-xs font-medium text-sf-text-secondary">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-sf-borderLight space-y-2">
                    {['Сделка №1', 'Сделка №2'].map((label, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 py-2 px-2 rounded-lg bg-sf-backgroundSection"
                      >
                        <FileText className="w-4 h-4 text-sf-text-muted" />
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
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Какие проблемы решает воронка сделок в CRM
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Без системы учёта сделок трудно контролировать продажи. 2wix даёт прозрачную воронку и
            единый процесс.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROBLEMS.map(({ text }) => (
              <div
                key={text}
                className="flex items-start gap-3 rounded-sfCard border border-red-100 bg-red-50/50 p-5"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sf-text-secondary font-medium text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Что даёт 2wix для работы со сделками */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что даёт 2wix для работы со сделками
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Воронка, этапы, клиент, ответственный и связь с перепиской — всё в одном месте
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
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
        </div>
      </section>

      {/* Воронка продаж — этапы */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Воронка продаж: этапы под ваш бизнес
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Этапы можно настроить под свой процесс — от лида до завершения. Универсальная логика
            подходит для продаж, услуг, строительства и любого бизнеса со сделками.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {FUNNEL_STAGES.map((stage, i) => (
              <div
                key={stage}
                className="flex items-center gap-2 rounded-sfCard border border-sf-border bg-sf-backgroundSection/80 px-4 py-3"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-sfCard bg-sf-primary/10 text-sf-primary font-bold text-sm flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="font-medium text-sf-text-primary">{stage}</span>
                {i < FUNNEL_STAGES.length - 1 && (
                  <ArrowDownRight className="w-4 h-4 text-sf-text-muted flex-shrink-0" />
                )}
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
            От заявки до сделки и до завершения — единый процесс в одной системе
          </p>
          <ol className="space-y-4">
            {HOW_IT_WORKS.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-4 rounded-sfCard border border-sf-border bg-sf-surface p-5"
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

      {/* Что видит руководитель */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что видит руководитель
          </h2>
          <p className="text-sf-text-secondary text-center mb-12">
            Прозрачность воронки и контроля без «устных отчётов»
          </p>
          <ul className="grid sm:grid-cols-2 gap-4">
            {FOR_LEADER.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-sfCard border border-emerald-200 bg-sf-primaryLight/50 px-5 py-4"
              >
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Сделка связана с клиентом и перепиской */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Сделка связана с клиентом и перепиской
          </h2>
          <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-12">
            Главное отличие от хаотичного учёта: в 2wix сделка не живёт отдельно — у неё есть клиент
            и вся история общения.
          </p>
          <ul className="space-y-4">
            {LINKED_BENEFITS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-sfCard border border-sf-border bg-sf-surface px-5 py-4"
              >
                <MessageSquare className="w-5 h-5 text-sf-accent flex-shrink-0 mt-0.5" />
                <span className="font-medium text-sf-text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Интерфейс / превью */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс: сделки и воронка в 2wix
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Воронка этапов, карточки сделок, клиенты и переписка в одном продукте
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PREVIEW_ITEMS.map(({ label, icon: Icon }) => (
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

      {/* CTA */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Ведите сделки по этапам в 2wix
          </h2>
          <p className="text-lg text-white/95 mb-10">
            Воронка, этапы, клиенты и контроль — в одной системе. Начните бесплатно.
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
              to="/vozmozhnosti"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-white/90 hover:text-white border-2 border-white/40 hover:border-white/60 transition-all"
            >
              Посмотреть возможности
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
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>
              CRM для продаж
            </Link>
            <Link to="/upravlenie-klientami" className={LINK_BTN_CLASS}>
              Управление клиентами
            </Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>
              WhatsApp CRM
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

      <PublicCTA />
    </SEOPageLayout>
  );
};
