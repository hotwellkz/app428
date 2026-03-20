import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { SEO_BASE_URL } from '../../config/seo';
import {
  Phone,
  PhoneCall,
  MessageSquare,
  GitBranch,
  BarChart3,
  Users,
  Zap,
  Check,
  ArrowRight,
  Mic2,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react';

const PATH = '/crm-twilio';

const TITLE = 'CRM с телефонией и интеграцией Twilio для продаж и обзвона | 2wix';

const DESCRIPTION =
  '2wix — CRM для продаж с телефонией: исходящие звонки и голосовые сценарии через Twilio в одном окне с WhatsApp, сделками и клиентами. Обзвон из CRM, статусы звонков, пост-обработка. Не официальный партнёр Twilio — подключение на стороне вашей компании.';

const LINK_BTN_CLASS =
  'px-5 py-2.5 rounded-sfCard bg-sf-backgroundSection border border-sf-border text-sf-text-secondary font-medium hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-colors';

const FOR_WHO = [
  'Отделы продаж и колл-центры',
  'Строительные и проектные компании',
  'Сервисные компании с заявками',
  'Малый и средний бизнес',
  'Команды, где важны и WhatsApp, и звонки',
  'Компании, которым нужны повторные касания и callback после контакта',
];

const HOW_STEPS = [
  'В настройках компании подключается voice-провайдер (например Twilio): учётные данные и номера задаются на уровне вашей организации.',
  'Вы добавляете исходящий номер и при необходимости отмечаете номер по умолчанию для звонков.',
  'Звонок можно запускать из сценариев автоматизации и голосового модуля: контекст клиента и сделки остаётся в CRM.',
  'Статусы звонка и события жизненного цикла фиксируются в сессии звонка и доступны для анализа и контроля.',
  'Результаты и пост-обработка (в том числе с участием AI-control) связываются с операционным следом сделки и задачами follow-up.',
];

const CAPABILITIES = [
  {
    icon: PhoneCall,
    title: 'Исходящие звонки из CRM',
    text: 'Запуск голосового контакта в контексте клиента и сделки — без переключения в отдельную «телефонную программу».',
  },
  {
    icon: GitBranch,
    title: 'Связка со сделкой и воронкой',
    text: 'Голосовой контакт остаётся в одной цепочке с этапами сделки и историей взаимодействий.',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp и звонки рядом',
    text: 'Переписка в мессенджере и телефония — в рамках одной CRM: меньше разрывов между каналами.',
  },
  {
    icon: Mic2,
    title: 'Голосовые сценарии и боты',
    text: 'В продукте развиваются сценарии голосового взаимодействия и автоматизации; доступность функций зависит от настроек компании и тарифа.',
  },
  {
    icon: RefreshCw,
    title: 'Callback и повторные касания',
    text: 'Поддерживается логика повторных попыток и отложенного дозвона в рамках voice-модуля — удобно для отделов продаж.',
  },
  {
    icon: BarChart3,
    title: 'Статусы и диагностика',
    text: 'Статусы звонка и технические детали помогают понять исход дозвона и при необходимости скорректировать процесс.',
  },
  {
    icon: LayoutDashboard,
    title: 'AI-control и пост-обработка',
    text: 'После звонка может выполняться пост-обработка и сводка в контексте операционного следа (в зависимости от настроек и сценария).',
  },
  {
    icon: Users,
    title: 'Командная работа',
    text: 'Роли и ответственные в CRM: руководитель видит связку каналов и этапов без «теневых» звонков вне системы.',
  },
];

const BUSINESS_VALUE = [
  'Быстрее первый живой контакт с лидом',
  'Меньше ручного переноса данных между чатом, телефоном и сделкой',
  'Единая история клиента: сообщения, звонки, этапы воронки',
  'Прозрачность для руководителя: кто и как выходит на связь',
  'Меньше потерянных лидов за счёт повторных касаний и напоминаний',
  'Проще масштабировать отдел продаж на несколько каналов',
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Что такое CRM с телефонией?',
    a: 'Это система, где вместе с клиентами, сделками и перепиской вы можете вести и голосовые контакты: звонки, статусы, историю. В 2wix телефония встроена в общую логику CRM, а не живёт отдельным приложением.',
  },
  {
    q: 'Как работает интеграция Twilio с CRM 2wix?',
    a: 'Twilio может выступать voice-провайдером: вы подключаете учётные данные и номера в настройках компании. Звонки идут через инфраструктуру Twilio, а учёт, клиенты и сделки остаются в 2wix. Разработка 2wix не является официальным партнёром или реселлером Twilio — это техническая интеграция для вашего аккаунта.',
  },
  {
    q: 'Можно ли звонить клиенту из карточки сделки?',
    a: 'В продукте предусмотрен запуск звонков в связке с контекстом сделки и клиента. Детализация интерфейса зависит от подключённых модулей и настроек вашей компании.',
  },
  {
    q: 'Можно ли запускать обзвон из чатов и сценариев?',
    a: 'Да, голосовые сценарии и автоматизация развиваются в связке с чатами и воронкой: звонок может быть частью цепочки касаний после заявки или переписки.',
  },
  {
    q: 'Подходит ли это отделу продаж?',
    a: 'Да. Отдел продаж получает единое окно: WhatsApp, сделки, звонки, статусы и контроль касаний — без разрозненных таблиц и личных телефонов как единственного канала.',
  },
  {
    q: 'Можно ли подключить свой номер?',
    a: 'Да, в рамках настроек voice-интеграции вы задаёте номера исходящего звонка, привязанные к вашей компании. Условия и биллинг номеров у провайдера (например Twilio) оформляются в вашем аккаунте провайдера.',
  },
  {
    q: 'Где хранится история звонков?',
    a: 'Сессии звонков и события связаны с компанией в CRM: статусы, длительность и диагностические поля доступны в контексте работы с клиентом и сделкой.',
  },
  {
    q: 'Как работает callback и повтор дозвона?',
    a: 'В voice-модуле поддерживается логика повторных попыток и отложенного дозвона в рамках сценариев — чтобы не терять лиды при неответе или занятости.',
  },
  {
    q: 'Можно ли автоматизировать follow-up после звонка?',
    a: 'Да, в связке с сделкой, задачами и сценариями автоматизации можно планировать следующие шаги после звонка; доступна пост-обработка и сводки в операционном следе.',
  },
  {
    q: 'Подходит ли решение для малого бизнеса?',
    a: 'Да. Даже небольшой отдел продаж выигрывает от того, что звонки и переписка не разъезжаются по личным устройствам без учёта в CRM.',
  },
  {
    q: 'Можно ли использовать не только Twilio?',
    a: 'Архитектура 2wix рассчитана на несколько voice-провайдеров; Twilio — один из поддерживаемых сценариев подключения. Конкретный набор провайдеров и настроек зависит от версии продукта и конфигурации.',
  },
  {
    q: 'Чем CRM с телефонией удобнее обычного обзвона?',
    a: 'Менеджер не «теряет» звонок вне системы: есть связь с клиентом, сделкой, статусами и последующими задачами. Руководитель видит картину по каналам, а не только «количество набранных номеров».',
  },
];

function getFaqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question' as const,
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: item.a,
      },
    })),
  };
}

function getSoftwareSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '2wix',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'CRM для бизнеса и продаж: клиенты, WhatsApp, сделки, аналитика, телефония через подключаемых voice-провайдеров.',
    url: SEO_BASE_URL + '/',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KZT',
      description: 'Начать можно с бесплатного тарифа — смотрите страницу цен.',
    },
  };
}

export const CrmTwilioTelefoniyaPage: React.FC = () => {
  const navigate = useNavigate();
  const structuredData = useMemo(() => [getFaqSchema(), getSoftwareSchema()], []);

  return (
    <SEOPageLayout
      title={TITLE}
      description={DESCRIPTION}
      path={PATH}
      breadcrumbs={[
        { name: 'Главная', item: SEO_BASE_URL + '/' },
        { name: 'CRM с телефонией и Twilio', item: SEO_BASE_URL + PATH },
      ]}
      structuredData={structuredData}
    >
      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight leading-tight">
                CRM с телефонией и звонками для продаж — вместе с WhatsApp и сделками
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                2wix объединяет клиентов, переписку, воронку и голосовые сценарии. Исходящие звонки и телефония могут подключаться через{' '}
                <strong className="text-sf-text-primary font-semibold">Twilio</strong> как через одного из voice-провайдеров — без смешения данных между компаниями и с прозрачным биллингом на стороне вашего аккаунта у провайдера.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row flex-wrap gap-4">
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
                <Link
                  to="/ceny"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-accent border border-sf-border hover:bg-sf-primaryLight/40 transition-all"
                >
                  Запросить демо / тарифы
                </Link>
              </div>
              <p className="mt-6 text-sm text-sf-text-muted max-w-lg">
                Twilio® — товарный знак Twilio Inc. 2wix не является официальным партнёром, реселлером или интегратором Twilio; мы предоставляем возможность подключить телефонию через API-провайдера в рамках вашей CRM.
              </p>
            </div>
            <div className="rounded-sfCard border border-sf-border bg-sf-surface p-8 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center">
                  <Phone className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-sf-text-muted">Схема в одном окне</p>
                  <p className="text-lg font-semibold text-sf-text-primary">Клиент → сделка → чат → звонок</p>
                </div>
              </div>
              <ul className="space-y-3 text-sf-text-secondary text-sm">
                <li className="flex gap-2">
                  <Check className="w-5 h-5 text-sf-accent shrink-0" />
                  WhatsApp и CRM без разрыва контекста
                </li>
                <li className="flex gap-2">
                  <Check className="w-5 h-5 text-sf-accent shrink-0" />
                  Исходящий звонок с привязкой к сделке
                </li>
                <li className="flex gap-2">
                  <Check className="w-5 h-5 text-sf-accent shrink-0" />
                  Статусы звонка и события в CRM
                </li>
                <li className="flex gap-2">
                  <Check className="w-5 h-5 text-sf-accent shrink-0" />
                  Повторные касания и пост-обработка
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Что это такое */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что такое CRM с телефонией через Twilio
          </h2>
          <div className="max-w-3xl mx-auto text-sf-text-secondary text-lg leading-relaxed space-y-4">
            <p>
              <strong className="text-sf-text-primary">CRM с телефонией</strong> — это когда звонки не живут отдельно от базы клиентов и сделок: вы видите, кому звонили, из какого контекста (сделка, чат, сценарий), с каким результатом и что делать дальше.
            </p>
            <p>
              <strong className="text-sf-text-primary">Интеграция с Twilio</strong> в 2wix означает: вы подключаете учётные данные и номера в настройках компании, а звонки идут через инфраструктуру Twilio. Мы не продаём услуги Twilio и не выступаем от их имени — это ваш договор с провайдером, а CRM даёт единое место для учёта и процессов.
            </p>
            <p>
              <strong className="text-sf-text-primary">Зачем бизнесу обзвон из CRM:</strong> меньше потерянных лидов, быстрее реакция, понятная история по каждому клиенту и возможность автоматизировать повторные касания и callback после первого контакта.
            </p>
          </div>
        </div>
      </section>

      {/* Для кого */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Кому подходит</h2>
          <p className="text-sf-text-secondary text-center mb-10 max-w-2xl mx-auto">
            Телефония в CRM для продаж, сервиса и команд, где важны и переписка, и голосовой контакт.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {FOR_WHO.map((item) => (
              <span
                key={item}
                className="px-4 py-2.5 rounded-sfCard border border-sf-border bg-sf-surface text-sf-text-secondary font-medium text-sm shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Как работает */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Как это работает в 2wix</h2>
          <p className="text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            От подключения провайдера до статусов в сделке и пост-обработки.
          </p>
          <ol className="space-y-6 max-w-3xl mx-auto">
            {HOW_STEPS.map((text, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-sf-primaryLight text-sf-accent font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sf-text-secondary leading-relaxed pt-1">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Возможности */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Основные возможности voice-модуля</h2>
          <p className="text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
            Набор функций может развиваться; ниже — то, что заложено в продукт и востребовано в продажах.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
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

      {/* Преимущества */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">Преимущества для бизнеса</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mt-10">
            {BUSINESS_VALUE.map((v) => (
              <div key={v} className="flex items-start gap-3 rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-4">
                <Zap className="w-5 h-5 text-sf-accent shrink-0 mt-0.5" />
                <p className="text-sf-text-secondary">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Честно про Twilio */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-6">
            Twilio внутри 2wix — прозрачная модель
          </h2>
          <div className="space-y-4 text-sf-text-secondary leading-relaxed">
            <p>
              <strong className="text-sf-text-primary">Подключение на уровне компании.</strong> Настройки voice-провайдера и номера изолированы по организации: данные и конфигурации разных клиентов 2wix не смешиваются.
            </p>
            <p>
              <strong className="text-sf-text-primary">Биллинг провайдера.</strong> Оплата услуг телефонии, как правило, идёт в вашем аккаунте у Twilio (или другого выбранного провайдера) — 2wix не выступает посредником платежей за трафик Twilio.
            </p>
            <p>
              <strong className="text-sf-text-primary">Не «официальная интеграция» от имени Twilio.</strong> Мы не заявляем статус официального партнёра Twilio. Это программная возможность подключить телефонию через API-провайдера в CRM, на ваших условиях с провайдером.
            </p>
            <p>
              <strong className="text-sf-text-primary">Развитие voice-архитектуры.</strong> Платформа допускает несколько voice-провайдеров; Twilio — один из поддерживаемых сценариев. Доступность функций зависит от настроек компании и версии продукта.
            </p>
          </div>
        </div>
      </section>

      {/* CTA mid */}
      <section className="py-16 md:py-20 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-sf-text-inverse mb-4">
            Создайте компанию и оцените CRM с телефонией
          </h2>
          <p className="text-white/95 mb-8">
            Подключите интеграции, когда команда будет готова. Начать можно с{' '}
            <Link to="/ceny" className="underline hover:text-white">
              тарифа Start
            </Link>
            .
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
              to="/crm-dlya-prodazh"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-white/95 border-2 border-white/40 hover:border-white/60 transition-all"
            >
              CRM для продаж
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Вопросы о CRM с телефонией и Twilio
          </h2>
          <p className="text-sf-text-secondary text-center mb-14">
            Сжатые ответы для SEO; подробности — в продукте и на консультации.
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
              Полный FAQ по 2wix →
            </Link>
          </div>
        </div>
      </section>

      {/* Финальный CTA */}
      <section className="py-16 md:py-24 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-sf-text-primary mb-4">Готовы продавать в одной системе — звонки, чаты, сделки?</h2>
          <p className="text-sf-text-secondary mb-10">
            Попробуйте 2wix и при необходимости подключите телефонию через Twilio в настройках компании.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
            >
              Попробовать 2wix
            </button>
            <Link
              to="/vozmozhnosti"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder"
            >
              Все возможности CRM
            </Link>
            <Link to="/ceny" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-semibold text-sf-accent border border-sf-border hover:bg-sf-primaryLight/40">
              Цены и консультация
            </Link>
          </div>
        </div>
      </section>

      {/* Перелинковка */}
      <section className="py-16 md:py-24 bg-white border-t border-sf-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sf-text-primary text-center mb-10">Смотрите также</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/vozmozhnosti" className={LINK_BTN_CLASS}>
              Возможности
            </Link>
            <Link to="/crm-dlya-biznesa" className={LINK_BTN_CLASS}>
              CRM для бизнеса
            </Link>
            <Link to="/crm-dlya-prodazh" className={LINK_BTN_CLASS}>
              CRM для продаж
            </Link>
            <Link to="/whatsapp-crm" className={LINK_BTN_CLASS}>
              WhatsApp CRM
            </Link>
            <Link to="/sdelki-i-voronka" className={LINK_BTN_CLASS}>
              Сделки и воронка
            </Link>
            <Link to="/analitika-prodazh" className={LINK_BTN_CLASS}>
              Аналитика продаж
            </Link>
            <Link to="/whatsapp-dlya-otdela-prodazh" className={LINK_BTN_CLASS}>
              WhatsApp для отдела продаж
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
