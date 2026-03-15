import React, { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { SEO_BASE_URL } from '../../config/seo';
import { ArrowRight, ChevronDown } from 'lucide-react';

const TITLE = 'Вопросы и ответы о 2wix — FAQ по CRM для бизнеса и продаж';
const DESCRIPTION =
  'Ответы на частые вопросы о 2wix: возможности, для кого подходит, WhatsApp, сделки, аналитика, роли, финансы, запуск и тарифы. CRM для бизнеса, отдела продаж и коммуникаций.';

interface FaqItem {
  q: string;
  a: React.ReactNode;
  /** Текст ответа для JSON-LD FAQ schema (если a — ReactNode) */
  aPlain?: string;
}

interface FaqCategory {
  id: string;
  title: string;
  items: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'obshchie',
    title: 'Общие вопросы',
    items: [
      {
        q: 'Что такое 2wix?',
        a: '2wix — это CRM-система для бизнеса: клиенты, заявки, сделки, WhatsApp-переписка, аналитика, сотрудники, финансы и склад в одном окне. Подходит для отдела продаж, малого и среднего бизнеса и команд, которые хотят не терять заявки и вести всё по полочкам.',
      },
      {
        q: 'Для чего нужен 2wix?',
        a: 'Чтобы собрать в одном месте клиентов, переписку, сделки и отчётность. Руководитель видит полную картину, менеджеры работают из единого интерфейса, заявки не теряются в личных чатах и почте. Удобно для продаж, поддержки и операционного контроля.',
      },
      {
        q: 'Чем 2wix отличается от обычной CRM?',
        a: 'В 2wix сразу заложены WhatsApp-чаты, быстрые ответы и связь переписки с клиентом и сделкой. Плюс финансы, склад и роли — не только «карточка клиента и воронка», а рабочая система для ежедневных задач команды.',
      },
      {
        q: 'Подходит ли 2wix только для строительных компаний?',
        a: 'Нет. 2wix — универсальная CRM для бизнеса. Строительство — один из сценариев (объекты, склад, сметы). Так же хорошо подходит для продаж, услуг, производства и любых компаний с заявками и клиентами.',
      },
      {
        q: 'Можно ли использовать 2wix в другом бизнесе?',
        a: 'Да. Система рассчитана на разные отрасли: отделы продаж, сервисные компании, производство, ритейл, услуги. Настраиваются этапы сделок, роли и модули под ваши процессы.',
      },
    ],
  },
  {
    id: 'dlya-kogo',
    title: 'Для кого подходит 2wix',
    items: [
      {
        q: 'Подходит ли 2wix для малого бизнеса?',
        a: 'Да. Запуск без сложного внедрения: создали компанию, пригласили сотрудников — можно вести клиентов и заявки. Тариф Start позволяет начать с малой командой бесплатно.',
      },
      {
        q: 'Подходит ли 2wix для команды из нескольких менеджеров?',
        aPlain: 'Да. Есть роли, назначение ответственных, общая база клиентов и чатов. Несколько менеджеров могут работать в одном аккаунте без путаницы. Подробнее на странице CRM для продаж.',
        a: (
          <>
            Да. Есть роли, назначение ответственных, общая база клиентов и чатов. Несколько менеджеров могут работать в одном аккаунте без путаницы.{' '}
            <Link to="/crm-dlya-prodazh" className="text-sf-accent hover:text-sf-primary font-medium">
              Подробнее — CRM для продаж
            </Link>
            .
          </>
        ),
      },
      {
        q: 'Можно ли использовать 2wix для отдела продаж?',
        a: 'Да. Воронка сделок, этапы, отчётность по менеджерам и конверсии, контроль касаний и заявок — всё то, что нужно отделу продаж. Можно подключить WhatsApp и вести переписку из CRM.',
      },
      {
        q: 'Можно ли использовать 2wix для компании с большим количеством заявок?',
        a: 'Да. Чаты и заявки собираются в одном интерфейсе, есть фильтры, назначение ответственных и быстрые ответы. Система рассчитана на поток обращений и масштабируется с ростом команды.',
      },
    ],
  },
  {
    id: 'vozmozhnosti',
    title: 'Функции и возможности',
    items: [
      {
        q: 'Можно ли вести клиентов в 2wix?',
        aPlain: 'Да. Единая база клиентов с контактами, комментариями и историей. К каждому клиенту привязываются переписка, сделки и файлы. Подробнее в разделе возможностей.',
        a: (
          <>
            Да. Единая база клиентов с контактами, комментариями и историей. К каждому клиенту привязываются переписка, сделки и файлы.{' '}
            <Link to="/vozmozhnosti" className="text-sf-accent hover:text-sf-primary font-medium">
              Подробнее о возможностях
            </Link>
            .
          </>
        ),
      },
      {
        q: 'Есть ли воронка и сделки?',
        a: 'Да. Сделки ведутся по этапам, можно переносить между этапами, назначать ответственного и смотреть отчётность по воронке и конверсии.',
      },
      {
        q: 'Есть ли аналитика?',
        a: 'Да. Дашборды и отчёты по сделкам, заявкам, активности менеджеров. Видно, сколько обращений пришло, на каком этапе клиенты и как работает команда.',
      },
      {
        q: 'Есть ли роли и права доступа?',
        a: 'Да. Владелец, администратор, менеджер, сотрудник — с разным доступом к разделам. Дополнительно можно выдать право, например, одобрять транзакции.',
      },
      {
        q: 'Можно ли вести сотрудников?',
        a: 'Да. Сотрудники приглашаются в компанию, им задаются роли и доступ к разделам меню. Владелец и администратор управляют составом и правами.',
      },
      {
        q: 'Можно ли хранить файлы по клиентам?',
        a: 'Да. К клиентам и сделкам можно прикреплять файлы, чтобы вся информация по проекту была в одном месте.',
      },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp и коммуникации',
    items: [
      {
        q: 'Есть ли интеграция с WhatsApp?',
        aPlain: 'Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном интерфейсе, без переключения в мессенджер. Заявки из чатов попадают в воронку. Подробнее на странице WhatsApp CRM.',
        a: (
          <>
            Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном интерфейсе, без переключения в мессенджер. Заявки из чатов попадают в воронку.{' '}
            <Link to="/whatsapp-crm" className="text-sf-accent hover:text-sf-primary font-medium">
              Подробнее — WhatsApp CRM
            </Link>
            .
          </>
        ),
      },
      {
        q: 'Можно ли отвечать нескольким менеджерам в одном интерфейсе?',
        a: 'Да. Все чаты в общей ленте, можно назначать ответственного, фильтровать по непрочитанным и ожидающим. Несколько менеджеров работают из одного аккаунта 2wix.',
      },
      {
        q: 'Есть ли быстрые ответы и шаблоны?',
        a: 'Да. Можно создавать шаблоны текстовых и медиа-ответов и вставлять их в чат одним кликом. Ускоряет работу с типовыми запросами.',
      },
      {
        q: 'Можно ли привязывать переписку к клиенту и сделке?',
        a: 'Да. Чат автоматически связан с карточкой клиента и при необходимости с сделкой. Вся история общения видна в одном месте.',
      },
      {
        q: 'Есть ли фильтры по непрочитанным и ожидающим чатам?',
        a: 'Да. Можно отфильтровать чаты по непрочитанным, по ожидающим ответа и по другим критериям, чтобы не пропускать обращения.',
      },
    ],
  },
  {
    id: 'sdelki',
    title: 'Сделки и продажи',
    items: [
      {
        q: 'Можно ли вести сделки по этапам?',
        a: 'Да. Воронка с настраиваемыми этапами: от первой заявки до закрытия. Сделки переносятся между этапами, ведётся история и отчётность по конверсии.',
      },
      {
        q: 'Можно ли назначать ответственного менеджера?',
        a: 'Да. У каждой сделки и клиента можно указать ответственного. Так видно, кто за кем закреплён и кто что ведёт.',
      },
      {
        q: 'Можно ли отслеживать статус клиента?',
        a: 'Да. По карточке клиента видно все сделки, этапы, переписку и контакты. Статус и следующий шаг контролируются из одного окна.',
      },
      {
        q: 'Можно ли контролировать воронку продаж?',
        a: 'Да. Руководитель видит, сколько сделок на каждом этапе, где «застревают» клиенты и какова конверсия. Аналитика по воронке и по менеджерам встроена в систему.',
      },
    ],
  },
  {
    id: 'sotrudniki',
    title: 'Сотрудники и роли',
    items: [
      {
        q: 'Как пригласить сотрудников в 2wix?',
        a: 'Владелец или администратор приглашает по email. Сотрудник получает доступ в компанию с выбранной ролью и набором прав. Регистрация компании и приглашение занимают минуты.',
      },
      {
        q: 'Какие роли есть в системе?',
        a: 'Владелец (полный доступ), администратор (управление настройками и сотрудниками), менеджер (работа с клиентами и сделками), сотрудник (ограниченный доступ по настройке). Дополнительно можно выдавать право одобрять транзакции.',
      },
      {
        q: 'Можно ли ограничить доступ сотрудника к разделам?',
        a: 'Да. Настраивается доступ к разделам меню: кто видит клиентов, сделки, чаты, финансы, склад и т.д. Гибкая настройка под структуру компании.',
      },
    ],
  },
  {
    id: 'finansy',
    title: 'Финансы, транзакции и склад',
    items: [
      {
        q: 'Есть ли учёт транзакций?',
        a: 'Да. Ведётся учёт доходов и расходов по объектам/категориям. Транзакции могут требовать одобрения — право настраивается для владельца и выбранных сотрудников.',
      },
      {
        q: 'Можно ли вести расходы по объектам / категориям?',
        a: 'Да. Создаются объекты (проекты, категории), по ним фиксируются приходы и расходы. Балансы и движение видны в одном месте.',
      },
      {
        q: 'Есть ли склад / материалы?',
        a: 'Да. Модуль склада: остатки, приходы и расходы материалов с привязкой к объектам. Удобно для производства и строительства, но можно использовать и в других сценариях.',
      },
      {
        q: 'Можно ли распределять права на финансовые операции?',
        a: 'Да. Владелец может создавать утверждённые операции сразу. Отдельным сотрудникам можно выдать право одобрять транзакции. Остальные только создают заявки на одобрение.',
      },
    ],
  },
  {
    id: 'zapusk',
    title: 'Запуск, доступ и подключение',
    items: [
      {
        q: 'Как начать работать в 2wix?',
        a: 'Зарегистрируйтесь и создайте компанию — вы станете владельцем. Далее пригласите сотрудников при необходимости и начните вести клиентов, заявки и сделки. Установка не нужна, всё в браузере.',
      },
      {
        q: 'Нужно ли что-то устанавливать?',
        a: 'Нет. 2wix работает в браузере. Достаточно зайти на сайт, создать компанию и войти. Никаких установочных файлов и сложной настройки.',
      },
      {
        q: 'Можно ли зайти с телефона?',
        a: 'Да. Интерфейс адаптирован под мобильные устройства. Можно работать с клиентами, чатами и сделками с телефона или планшета.',
      },
      {
        q: 'Есть ли мобильная версия?',
        a: 'Да. Сайт корректно отображается и удобен на смартфонах и планшетах. Отдельное приложение пока не требуется — всё доступно через браузер.',
      },
      {
        q: 'Можно ли зарегистрировать новую компанию?',
        a: 'Да. Любой пользователь может создать новую компанию и стать её владельцем. Один аккаунт может быть связан с разными компаниями (например, по ролям).',
      },
    ],
  },
  {
    id: 'tarify',
    title: 'Тарифы и демо',
    items: [
      {
        q: 'Есть ли демо?',
        aPlain: 'Да. Можем показать продукт онлайн, подсказать подходящий тариф и ответить на вопросы. Запросите демо через кнопку на сайте или напишите нам. Подробнее на странице Цены и тарифы.',
        a: (
          <>
            Да. Можем показать продукт онлайн, подсказать подходящий тариф и ответить на вопросы. Запросите демо через кнопку на сайте или напишите нам.{' '}
            <Link to="/ceny" className="text-sf-accent hover:text-sf-primary font-medium">
              Подробнее — Цены и тарифы
            </Link>
            .
          </>
        ),
      },
      {
        q: 'Можно ли попробовать перед подключением?',
        a: 'Да. Тариф Start даёт возможность начать бесплатно: клиенты, чаты, сделки, шаблоны. Так вы оцените систему и при необходимости перейдёте на Business или Enterprise.',
      },
      {
        q: 'Есть ли тарифы для маленькой команды?',
        a: 'Да. Start рассчитан на малую команду (до 3 пользователей) и бесплатный старт. Для растущего отдела продаж — Business, для индивидуальных требований — Enterprise.',
      },
      {
        q: 'Можно ли обсудить индивидуальный формат?',
        a: 'Да. Для тарифов Business и Enterprise условия и стоимость подбираются под компанию. Напишите нам или запросите демо — обсудим формат и внедрение.',
      },
    ],
  },
];

const NAV_ANCHORS = FAQ_CATEGORIES.map((c) => ({ id: c.id, title: c.title }));

function getFaqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap((c) =>
      c.items.map((item) => {
        const text = item.aPlain ?? (typeof item.a === 'string' ? item.a : '');
        return {
          '@type': 'Question' as const,
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text,
          },
        };
      })
    ).filter((q) => q.acceptedAnswer.text),
  };
}

export const FaqPage: React.FC = () => {
  const navigate = useNavigate();
  const faqSchema = useMemo(() => getFaqSchema(), []);
  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <SEOPageLayout
      title={TITLE}
      description={DESCRIPTION}
      path="/faq"
      breadcrumbs={[
        { name: 'Главная', item: SEO_BASE_URL + '/' },
        { name: 'Вопросы и ответы', item: SEO_BASE_URL + '/faq' },
      ]}
      structuredData={[faqSchema]}
    >
      {/* Hero */}
      <section className="relative pt-28 pb-12 md:pt-36 md:pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[350px] h-[350px] bg-sf-primaryLight/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-sf-text-primary tracking-tight leading-tight">
            Ответы на частые вопросы о CRM 2wix
          </h1>
          <p className="mt-6 text-xl text-sf-text-secondary max-w-2xl mx-auto">
            Всё, что нужно знать о возможностях, запуске, работе с командой, WhatsApp, сделках и аналитике в 2wix.
          </p>
          <p className="mt-3 text-sf-text-muted text-sm max-w-xl mx-auto">
            Если не нашли ответ — запросите демо или свяжитесь с нами.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
            >
              Создать компанию
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-medium text-sf-text-secondary bg-sf-surface border-2 border-sf-border hover:border-sf-cardBorder hover:bg-sf-primaryLight/50 transition-all"
            >
              Попробовать
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Sticky nav — desktop */}
          <nav
            aria-label="Категории FAQ"
            className="lg:w-56 flex-shrink-0 lg:sticky lg:top-28 lg:self-start order-2 lg:order-1"
          >
            <h2 className="text-sm font-semibold text-sf-text-muted uppercase tracking-wider mb-4 hidden lg:block">
              Разделы
            </h2>
            <ul className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 lg:overflow-x-visible">
              {NAV_ANCHORS.map(({ id, title }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className="text-left px-3 py-2 rounded-lg text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-borderLight w-full transition-colors whitespace-nowrap lg:whitespace-normal"
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-sf-border hidden lg:block">
              <Link
                to="/vozmozhnosti"
                className="text-sm font-medium text-sf-accent hover:text-sf-primary"
              >
                Возможности →
              </Link>
              <br />
              <Link to="/ceny" className="text-sm font-medium text-sf-accent hover:text-sf-primary mt-1 inline-block">
                Цены →
              </Link>
            </div>
          </nav>

          {/* FAQ content */}
          <div className="flex-1 min-w-0 order-1 lg:order-2">
            {FAQ_CATEGORIES.map((category, categoryIndex) => (
              <React.Fragment key={category.id}>
                <section
                  id={category.id}
                  className="scroll-mt-32 mb-14 last:mb-0"
                  aria-labelledby={`faq-heading-${category.id}`}
                >
                  <h2
                    id={`faq-heading-${category.id}`}
                    className="text-2xl font-bold text-sf-text-primary mb-6 pb-2 border-b border-sf-border"
                  >
                    {category.title}
                  </h2>
                  <ul className="space-y-3" role="list">
                    {category.items.map((item, i) => (
                      <li key={i}>
                        <details className="group rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden hover:border-sf-cardBorder transition-colors">
                          <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-medium text-sf-text-primary hover:bg-sf-backgroundSection/50 transition-colors">
                            <span>{item.q}</span>
                            <ChevronDown className="w-5 h-5 text-sf-text-muted flex-shrink-0 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="px-5 pb-4 pt-0 text-sf-text-secondary text-sm leading-relaxed border-t border-sf-borderLight">
                            <div className="pt-3">{item.a}</div>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>

                  {/* Мягкие CTA после части секций */}
                  {[1, 2, 4, 8].includes(categoryIndex) && (
                    <div className="mt-8 p-5 rounded-sfCard bg-sf-backgroundSection border border-sf-border">
                      <p className="text-sm text-sf-text-secondary mb-3">
                        {categoryIndex === 1 && 'Уже понятно, что 2wix подходит? Начните с бесплатного старта.'}
                        {categoryIndex === 2 && 'Хотите увидеть все функции в одном месте? Посмотрите обзор возможностей.'}
                        {categoryIndex === 4 && 'Нужна CRM с WhatsApp и сделками? Попробуйте 2wix.'}
                        {categoryIndex === 8 && 'Остались вопросы по тарифам? Запросите демо или посмотрите цены.'}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {categoryIndex === 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate('/register-company')}
                              className="text-sm font-semibold text-sf-accent hover:text-sf-primary"
                            >
                              Создать компанию →
                            </button>
                          </>
                        )}
                        {categoryIndex === 2 && (
                          <Link to="/vozmozhnosti" className="text-sm font-semibold text-sf-accent hover:text-sf-primary">
                            Посмотреть возможности →
                          </Link>
                        )}
                        {categoryIndex === 4 && (
                          <button
                            type="button"
                            onClick={() => navigate('/register-company')}
                            className="text-sm font-semibold text-sf-accent hover:text-sf-primary"
                          >
                            Попробовать 2wix →
                          </button>
                        )}
                        {categoryIndex === 8 && (
                          <>
                            <Link to="/ceny" className="text-sm font-semibold text-sf-accent hover:text-sf-primary">
                              Цены
                            </Link>
                            <a
                              href="mailto:info@2wix.ru?subject=Запрос демо 2wix"
                              className="text-sm font-semibold text-sf-accent hover:text-sf-primary"
                            >
                              Запросить демо
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Финальный CTA — только onDark-токены для контраста на тёмном фоне */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-inverse mb-4">
            Готовы попробовать 2wix?
          </h2>
          <p className="text-lg text-white/95 mb-10 max-w-xl mx-auto">
            Создайте компанию за минуту и начните вести клиентов, сделки и коммуникации в одном месте.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
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
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-medium text-white/90 hover:text-white border border-white/40 hover:border-white/60 transition-all"
            >
              Войти
            </button>
            <a
              href="mailto:info@2wix.ru?subject=Запрос демо 2wix"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfCard font-medium text-white/90 hover:text-white transition-colors"
            >
              Запросить демо
            </a>
          </div>
          <div className="mt-12 pt-12 border-t border-white/25">
            <p className="text-white/90 text-sm mb-4">Полезные разделы</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <Link to="/" className="text-white/90 hover:text-white text-sm transition-colors">
                Главная
              </Link>
              <Link to="/vozmozhnosti" className="text-white/90 hover:text-white text-sm transition-colors">
                Возможности
              </Link>
              <Link to="/whatsapp-crm" className="text-white/90 hover:text-white text-sm transition-colors">
                WhatsApp CRM
              </Link>
              <Link to="/crm-dlya-prodazh" className="text-white/90 hover:text-white text-sm transition-colors">
                CRM для продаж
              </Link>
              <Link to="/crm-dlya-biznesa" className="text-white/90 hover:text-white text-sm transition-colors">
                CRM для бизнеса
              </Link>
              <Link to="/ceny" className="text-white/90 hover:text-white text-sm transition-colors">
                Цены
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SEOPageLayout>
  );
};
