# Контентная матрица SEO-страниц 2wix.ru

Рабочий blueprint для создания новых публичных страниц на базе **public design system**.  
2wix — универсальная CRM для бизнеса, продаж, WhatsApp-коммуникаций, аналитики и процессов. Строительство — одна из вертикалей, не единственный фокус.

Документ отвечает на вопросы: какие страницы создавать, в каком порядке, какой intent закрывать, какие секции использовать, как строить перелинковку и не допускать дублирования.

---

## 1. Кластеры и типы страниц

### Кластеры (для привязки intent)

| Код | Кластер | Примеры запросов |
|-----|---------|-------------------|
| A | Универсальная CRM / малый бизнес | crm для бизнеса, crm для малого бизнеса, crm для компании |
| B | CRM для продаж | crm для отдела продаж, crm для лидов, crm для заявок |
| C | WhatsApp / коммуникации | whatsapp crm, crm с whatsapp, единая переписка с клиентами |
| D | Сделки / воронка / лиды | управление сделками, воронка продаж, учет сделок |
| E | Аналитика / контроль | аналитика продаж crm, crm для руководителя, контроль менеджеров |
| F | Команда / роли | crm для команды, crm для менеджеров, права доступа |
| G | Отраслевые | crm для строительной компании, crm для производства, crm для услуг |
| H | Коммерческие | цена crm, тарифы crm, внедрение crm |
| I | Информационные | что такое crm, зачем нужна crm, как выбрать crm |
| J | Сравнительные | crm или excel, альтернатива amocrm, альтернатива bitrix24 |

### Типы страниц

| Тип | Описание | Примеры URL |
|-----|----------|-------------|
| **Коммерческая широкая** | Широкий коммерческий intent, посадочная под кластер | /crm-dlya-malogo-biznesa, /crm-dlya-komandy |
| **Страница функции** | Одна функция/возможность продукта | /upravlenie-klientami, /analitika-prodazh |
| **WhatsApp / коммуникации** | Фокус на переписке, чатах, WhatsApp | /crm-s-whatsapp, /whatsapp-dlya-otdela-prodazh |
| **Отраслевая** | Ниша: стройка, производство, услуги | /crm-dlya-stroitelnoi-kompanii, /crm-dlya-proizvodstva |
| **Информационная** | Статья, объяснение, как сделать | /chto-takoe-crm, /kak-vybrat-crm |
| **Сравнительная** | Сравнение с инструментами/конкурентами | /crm-ili-excel, /alternativa-amocrm |

---

## 2. Шаблоны страниц (привязка к public design system)

Каждая новая страница собирается из **готовых секций**. Ниже — типовые шаблоны и какие блоки использовать.

### Секции (источники)

- **PublicSection** + **PublicContainer** — обёртка и ширина контента (variant: default | subtle | dark | large).
- **PublicSectionTitle** — заголовок и подзаголовок секции.
- **PublicCard** / **PublicFeatureCard** — карточки (base | feature | muted | accent).
- **PublicButton** — кнопки (primary | secondary | ctaDark и др.).
- **PublicCTASection** — тёмный CTA-блок внизу страницы.

Готовые контентные секции (из `src/pages/landing/` или их обобщённые версии):

- **HeroSection** — hero с заголовком, подзаголовком, CTA (вариант с пропсами для произвольного контента).
- **ProblemsSection** — блок «какие проблемы решает» (карточки болей).
- **BenefitsSection** — блок преимуществ (аналог Why2wixSection с пропсами).
- **FeaturesGridSection** — сетка возможностей (аналог FeaturesSection с пропсами).
- **UseCasesSection** — сценарии использования (с пропсами).
- **ScreenshotsSection** — превью интерфейса (с пропсами или статичный набор).
- **FAQSection** — вопросы-ответы (контент через пропсы).
- **CTASection** — финальный CTA (или PublicCTASection).
- **ComparisonSection** — сравнение (таблица или карточки «было / стало» или «X vs 2wix»).
- **IndustriesSection** — для кого подходит (чипы/карточки ниш, аналог ForWhoSection с пропсами).
- **TimelineSection** — как это работает, пошаговый flow.
- **PricingLinkSection** — блок со ссылкой на /ceny и призывом выбрать тариф.

### Шаблон 1 — Коммерческая landing page

Цель: конверсия в регистрацию/демо, закрытие широкого коммерческого запроса.

| Порядок | Секция | Компонент / примечание |
|---------|--------|-------------------------|
| 1 | Hero | HeroSection (title, subtitle, 2 CTA, опционально preview) |
| 2 | Проблемы | ProblemsSection (карточки болей аудитории) |
| 3 | Решение / преимущества | BenefitsSection или блок с PublicCard |
| 4 | Возможности | FeaturesGridSection или сетка PublicCard |
| 5 | Как это работает | TimelineSection (шаги) |
| 6 | Превью продукта | ScreenshotsSection |
| 7 | FAQ | FAQSection (5–8 вопросов) |
| 8 | CTA | PublicCTASection или CTASection |

**Примеры страниц:** /crm-dlya-biznesa, /crm-dlya-prodazh, /whatsapp-crm, /crm-dlya-malogo-biznesa.

---

### Шаблон 2 — Страница функции (feature page)

Цель: объяснить одну возможность, подвести к продукту и смежным страницам.

| Порядок | Секция | Компонент / примечание |
|---------|--------|-------------------------|
| 1 | Hero | HeroSection (название функции, короткое описание, CTA) |
| 2 | Описание функции | PublicSection + PublicContainer + PublicSectionTitle + текст/карточки |
| 3 | Use cases | UseCasesSection или карточки сценариев |
| 4 | Превью | ScreenshotsSection (релевантные экраны) |
| 5 | Связанные возможности | 2–3 карточки со ссылками на другие фичевые/коммерческие |
| 6 | FAQ | FAQSection (3–5 вопросов по функции) |
| 7 | CTA | PublicCTASection (основной CTA: «Попробовать» / «Возможности») |

**Примеры страниц:** /analitika-prodazh, /upravlenie-sdelkami, /kontrol-menedzherov, /roli-i-prava.

---

### Шаблон 3 — Отраслевая страница

Цель: закрыть запрос по нише, показать релевантность 2wix для отрасли.

| Порядок | Секция | Компонент / примечание |
|---------|--------|-------------------------|
| 1 | Hero | HeroSection под нишу (например «CRM для строительной компании») |
| 2 | Боли ниши | ProblemsSection (специфичные для отрасли) |
| 3 | Как помогает 2wix | BenefitsSection с отраслевым углом |
| 4 | Ключевые функции | FeaturesGridSection (подбор под отрасль: сделки, склад, чаты и т.д.) |
| 5 | Кейсы / сценарии | UseCasesSection или короткий блок с примерами |
| 6 | FAQ | FAQSection (ниша + общие вопросы) |
| 7 | CTA | PublicCTASection + опционально PricingLinkSection |

**Примеры страниц:** /crm-dlya-stroitelnoi-kompanii, /crm-dlya-proizvodstva, /crm-dlya-uslug.

---

### Шаблон 4 — Информационная статья

Цель: трафик по информационному запросу, подвод к коммерческим страницам.

| Порядок | Секция | Компонент / примечание |
|---------|--------|-------------------------|
| 1 | Intro / Hero | Короткий hero или PublicSection + заголовок + лид |
| 2 | Основной текст | PublicSection + PublicContainer, структура H2/H3, абзацы |
| 3 | Примеры / списки | PublicCard или нумерованные блоки |
| 4 | CTA к продукту | PublicCTASection или блок со ссылками на /crm-dlya-biznesa, /vozmozhnosti, /ceny |

**Примеры страниц:** /chto-takoe-crm, /zachem-nuzhna-crm, /kak-vybrat-crm, /kak-vnedrit-crm.

---

### Шаблон 5 — Сравнительная страница

Цель: захватить запросы «X vs Y», «альтернатива X», подвести к 2wix.

| Порядок | Секция | Компонент / примечание |
|---------|--------|-------------------------|
| 1 | Intro | PublicSection + заголовок (например «CRM вместо Excel») |
| 2 | Сравнение | ComparisonSection (таблица или карточки: Excel vs 2wix, Amo vs 2wix) |
| 3 | Преимущества 2wix | BenefitsSection или короткий блок с буллетами |
| 4 | FAQ | FAQSection (2–4 вопроса по сравнению) |
| 5 | CTA | PublicCTASection (Попробовать, Цены, Демо) |

**Примеры страниц:** /crm-ili-excel, /whatsapp-crm-vs-obychnyy-whatsapp, /alternativa-amocrm, /alternativa-bitrix24.

---

## 3. Матрица будущих страниц

Для каждой страницы зафиксированы: URL, тип, приоритет, intent, запросы, CTA, секции, перелинковка.

### Уже существующие (для справки)

| URL | Тип | Кластер | Основной CTA |
|-----|-----|---------|---------------|
| `/` | Главная | A | Попробовать / Войти |
| `/crm-dlya-biznesa` | Коммерческая широкая | A | Попробовать / Возможности |
| `/crm-dlya-prodazh` | Коммерческая широкая | B, D | Попробовать / Возможности |
| `/whatsapp-crm` | Коммерческая широкая | C | Попробовать / Возможности |
| `/crm-dlya-malogo-biznesa` | Коммерческая широкая | A | Попробовать / Возможности |
| `/vozmozhnosti` | Hub | A–F | Попробовать / Фичевые страницы |
| `/ceny` | Коммерческая | H | Создать компанию / Демо |
| `/faq` | Доверие | I | Попробовать / Цены |
| `/klienty`, `/whatsapp-i-chaty`, `/sdelki-i-voronka`, и др. | Фичевые | — | Подробнее / Возможности |

---

### PRIORITY 1 — Высокий коммерческий intent

#### 1.1 /analitika-prodazh

| Поле | Значение |
|------|----------|
| **URL** | `/analitika-prodazh` |
| **Тип** | Страница функции (коммерческий уклон) |
| **Приоритет** | P1 |
| **Кластер** | E |
| **Intent** | Информационно-коммерческий: «хочу отчёты и контроль по продажам» |
| **Главный запрос** | аналитика продаж crm, отчёты по продажам crm |
| **Доп. запросы** | crm для руководителя, отчёты в crm, контроль продаж в crm |
| **Цель страницы** | Закрыть запросы руководителей и аналитики, вести на /ceny, /vozmozhnosti |
| **Основной CTA** | Попробовать / Посмотреть возможности |
| **Шаблон** | 2 (feature page) |
| **Секции** | HeroSection → описание функции (PublicSection + PublicContainer + PublicSectionTitle) → UseCasesSection → ScreenshotsSection → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /crm-dlya-prodazh, /vozmozhnosti, /ceny, /faq |
| **Ссылки на страницу** | /crm-dlya-prodazh, /vozmozhnosti, /crm-dlya-biznesa, главная (при добавлении блока «Решения») |
| **Комментарий** | Сильный запрос, слабо закрыт текущим контентом. После /crm-dlya-malogo-biznesa — следующая логичная страница P1. |

---

#### 1.2 /upravlenie-sdelkami

| Поле | Значение |
|------|----------|
| **URL** | `/upravlenie-sdelkami` |
| **Тип** | Страница функции |
| **Приоритет** | P1 |
| **Кластер** | D |
| **Intent** | Коммерческий: учёт сделок, воронка, этапы |
| **Главный запрос** | управление сделками crm, учет сделок |
| **Доп. запросы** | воронка сделок crm, этапы сделок, crm для сделок |
| **Цель страницы** | Отдельный коммерческий фокус «сделки», усиление /crm-dlya-prodazh |
| **Основной CTA** | Попробовать / Посмотреть возможности |
| **Шаблон** | 2 (feature page) |
| **Секции** | HeroSection → описание (PublicSection + карточки) → UseCasesSection → ScreenshotsSection → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /crm-dlya-prodazh, /vozmozhnosti, /ceny, /analitika-prodazh |
| **Ссылки на страницу** | /crm-dlya-prodazh, /vozmozhnosti, /crm-dlya-biznesa |
| **Комментарий** | Можно усилить существующую /sdelki-i-voronka контентом и перелинковкой или сделать отдельную коммерческую посадочную. |

---

#### 1.3 /chto-takoe-crm

| Поле | Значение |
|------|----------|
| **URL** | `/chto-takoe-crm` |
| **Тип** | Информационная статья |
| **Приоритет** | P1 |
| **Кластер** | I |
| **Intent** | Информационный: что такое CRM, зачем нужна |
| **Главный запрос** | что такое crm, зачем нужна crm |
| **Доп. запросы** | что такое crm система, для чего нужна crm |
| **Цель страницы** | Трафик + подвод к коммерческим страницам |
| **Основной CTA** | Посмотреть возможности / Перейти к 2wix |
| **Шаблон** | 4 (информационная статья) |
| **Секции** | Intro (PublicSection + заголовок) → основной текст (H2/H3, PublicContainer) → блок со ссылками на /crm-dlya-biznesa, /vozmozhnosti → PublicCTASection |
| **Ссылки с страницы** | /crm-dlya-biznesa, /vozmozhnosti, /ceny, /faq |
| **Ссылки на страницу** | /crm-dlya-biznesa, /vozmozhnosti, /faq, главная |
| **Комментарий** | Высокий объём информационного трафика, важно вести на коммерческие и /ceny. |

---

### PRIORITY 2 — Кластерные и отраслевые

#### 2.1 /crm-dlya-komandy

| Поле | Значение |
|------|----------|
| **URL** | `/crm-dlya-komandy` |
| **Тип** | Коммерческая широкая |
| **Приоритет** | P2 |
| **Кластер** | F |
| **Intent** | crm для команды, crm для нескольких менеджеров |
| **Главный запрос** | crm для команды, crm для менеджеров |
| **Доп. запросы** | crm для нескольких сотрудников, распределение клиентов между менеджерами |
| **Цель страницы** | Закрыть кластер «команда/менеджеры», конверсия в регистрацию |
| **Основной CTA** | Попробовать / Возможности |
| **Шаблон** | 1 (коммерческая landing) |
| **Секции** | HeroSection → ProblemsSection → BenefitsSection → FeaturesGridSection → TimelineSection → ScreenshotsSection → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /roli-i-prava, /crm-dlya-prodazh, /vozmozhnosti, /ceny |
| **Ссылки на страницу** | /vozmozhnosti, /crm-dlya-biznesa, /faq |
| **Комментарий** | Логичное расширение после P1. |

---

#### 2.2 /kontrol-menedzherov

| Поле | Значение |
|------|----------|
| **URL** | `/kontrol-menedzherov` |
| **Тип** | Страница функции |
| **Приоритет** | P2 |
| **Кластер** | E, F |
| **Intent** | контроль менеджеров, контроль отдела продаж |
| **Главный запрос** | контроль менеджеров crm, контроль отдела продаж |
| **Доп. запросы** | как контролировать менеджеров по продажам, отчёты по менеджерам |
| **Цель страницы** | Узкий intent «контроль», перелинковка на /analitika-prodazh, /crm-dlya-prodazh |
| **Основной CTA** | Попробовать / Аналитика продаж |
| **Шаблон** | 2 (feature page) |
| **Секции** | HeroSection → описание + UseCasesSection → ScreenshotsSection → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /analitika-prodazh, /crm-dlya-prodazh, /roli-i-prava, /vozmozhnosti |
| **Ссылки на страницу** | /crm-dlya-prodazh, /vozmozhnosti, /crm-dlya-biznesa |
| **Комментарий** | Дополняет /analitika-prodazh и /crm-dlya-komandy. |

---

#### 2.3 /crm-dlya-stroitelnoi-kompanii

| Поле | Значение |
|------|----------|
| **URL** | `/crm-dlya-stroitelnoi-kompanii` |
| **Тип** | Отраслевая |
| **Приоритет** | P2 |
| **Кластер** | G |
| **Intent** | crm для строительной компании, crm для стройки |
| **Главный запрос** | crm для строительной компании |
| **Доп. запросы** | crm для стройки, crm для подрядчиков, учет в строительной компании |
| **Цель страницы** | Один из сильных отраслевых кластеров без перекоса всего сайта |
| **Основной CTA** | Попробовать / Цены |
| **Шаблон** | 3 (отраслевая) |
| **Секции** | HeroSection → ProblemsSection (стройка) → BenefitsSection → FeaturesGridSection (сделки, склад, клиенты) → UseCasesSection → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /crm-dlya-biznesa, /vozmozhnosti, /ceny, /sklad-i-materialy, /sdelki-i-voronka |
| **Ссылки на страницу** | /vozmozhnosti, /crm-dlya-biznesa, главная (блок «Для кого») |
| **Комментарий** | Первая отраслевая страница; не плодить много ниш сразу. |

---

#### 2.4 /crm-dlya-proizvodstva

| Поле | Значение |
|------|----------|
| **URL** | `/crm-dlya-proizvodstva` |
| **Тип** | Отраслевая |
| **Приоритет** | P2 |
| **Кластер** | G |
| **Intent** | crm для производства |
| **Главный запрос** | crm для производства |
| **Доп. запросы** | crm для производственной компании, учет в производстве |
| **Цель страницы** | Вторая отрасль после стройки |
| **Основной CTA** | Попробовать / Возможности |
| **Шаблон** | 3 (отраслевая) |
| **Секции** | HeroSection → ProblemsSection → BenefitsSection → FeaturesGridSection → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /crm-dlya-biznesa, /vozmozhnosti, /ceny, /sklad-i-materialy |
| **Ссылки на страницу** | /vozmozhnosti, /crm-dlya-biznesa |
| **Комментарий** | По мере ресурсов и спроса. |

---

#### 2.5 /kak-vybrat-crm

| Поле | Значение |
|------|----------|
| **URL** | `/kak-vybrat-crm` |
| **Тип** | Информационная статья |
| **Приоритет** | P2 |
| **Кластер** | I |
| **Intent** | как выбрать crm, какую crm выбрать |
| **Главный запрос** | как выбрать crm |
| **Доп. запросы** | какую crm выбрать для бизнеса, критерии выбора crm |
| **Цель страницы** | Преконверсия, подвод к /vozmozhnosti, /ceny, /crm-dlya-biznesa |
| **Основной CTA** | Посмотреть возможности / Цены |
| **Шаблон** | 4 (информационная статья) |
| **Секции** | Intro → основной текст (критерии, чек-лист) → блок ссылок на /vozmozhnosti, /ceny, /crm-dlya-biznesa → PublicCTASection |
| **Ссылки с страницы** | /vozmozhnosti, /ceny, /crm-dlya-biznesa, /faq |
| **Ссылки на страницу** | /chto-takoe-crm, /crm-dlya-biznesa, /faq |
| **Комментарий** | Логично после /chto-takoe-crm. |

---

### PRIORITY 3 — Информационные, сравнительные, дополнительные

#### 3.1 /crm-ili-excel

| Поле | Значение |
|------|----------|
| **URL** | `/crm-ili-excel` |
| **Тип** | Сравнительная |
| **Приоритет** | P3 |
| **Кластер** | J |
| **Intent** | crm или excel, crm или таблицы |
| **Главный запрос** | crm или excel |
| **Доп. запросы** | crm или таблицы, чем crm лучше excel |
| **Цель страницы** | Сравнение, подвод к преимуществам CRM и /ceny |
| **Основной CTA** | Попробовать 2wix / Цены |
| **Шаблон** | 5 (сравнительная) |
| **Секции** | Intro → ComparisonSection (таблица Excel vs 2wix) → преимущества 2wix → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /ceny, /vozmozhnosti, /crm-dlya-biznesa |
| **Ссылки на страницу** | /chto-takoe-crm, /kak-vybrat-crm, /faq |
| **Комментарий** | Сильный информационно-коммерческий запрос. |

---

#### 3.2 /whatsapp-crm-vs-obychnyy-whatsapp

| Поле | Значение |
|------|----------|
| **URL** | `/whatsapp-crm-vs-obychnyy-whatsapp` |
| **Тип** | Сравнительная |
| **Приоритет** | P3 |
| **Кластер** | J, C |
| **Intent** | whatsapp crm vs обычный whatsapp |
| **Главный запрос** | whatsapp crm vs обычный whatsapp |
| **Доп. запросы** | зачем whatsapp в crm, преимущества whatsapp crm |
| **Цель страницы** | Усилить /whatsapp-crm, захватить сравнение |
| **Основной CTA** | Попробовать WhatsApp CRM / Возможности |
| **Шаблон** | 5 (сравнительная) |
| **Секции** | Intro → ComparisonSection (обычный WhatsApp vs 2wix) → преимущества → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /whatsapp-crm, /vozmozhnosti, /ceny |
| **Ссылки на страницу** | /whatsapp-crm, /crm-dlya-prodazh, /faq |
| **Комментарий** | Можно усилить блоком на /whatsapp-crm вместо отдельной страницы — по ресурсам. |

---

#### 3.3 /alternativa-amocrm

| Поле | Значение |
|------|----------|
| **URL** | `/alternativa-amocrm` |
| **Тип** | Сравнительная |
| **Приоритет** | P3 |
| **Кластер** | J |
| **Intent** | amocrm альтернатива, замена amocrm |
| **Главный запрос** | amocrm альтернатива |
| **Доп. запросы** | замена amocrm, crm как amocrm |
| **Цель страницы** | Захват запросов на смену CRM, перелинковка на /ceny, /vozmozhnosti |
| **Основной CTA** | Попробовать / Запросить демо |
| **Шаблон** | 5 (сравнительная) |
| **Секции** | Intro → ComparisonSection (Amo vs 2wix, корректно и без оскорблений) → преимущества 2wix → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /ceny, /vozmozhnosti, /crm-dlya-biznesa |
| **Ссылки на страницу** | /kak-vybrat-crm, /faq |
| **Комментарий** | Одна из двух «альтернатив» для старта (Amo или Bitrix). |

---

#### 3.4 /alternativa-bitrix24

| Поле | Значение |
|------|----------|
| **URL** | `/alternativa-bitrix24` |
| **Тип** | Сравнительная |
| **Приоритет** | P3 |
| **Кластер** | J |
| **Intent** | bitrix24 альтернатива, проще чем битрикс |
| **Главный запрос** | bitrix24 альтернатива |
| **Доп. запросы** | альтернатива битрикс24, crm проще битрикс |
| **Цель страницы** | Аналогично /alternativa-amocrm |
| **Основной CTA** | Попробовать / Запросить демо |
| **Шаблон** | 5 (сравнительная) |
| **Секции** | Intro → ComparisonSection → преимущества 2wix → FAQSection → PublicCTASection |
| **Ссылки с страницы** | /ceny, /vozmozhnosti, /crm-dlya-biznesa |
| **Ссылки на страницу** | /kak-vybrat-crm, /faq |
| **Комментарий** | Вторая сравнительная по конкурентам. |

---

#### 3.5 /kak-vnedrit-crm

| Поле | Значение |
|------|----------|
| **URL** | `/kak-vnedrit-crm` |
| **Тип** | Информационная статья |
| **Приоритет** | P3 |
| **Кластер** | I, H |
| **Intent** | как внедрить crm, внедрение crm |
| **Главный запрос** | как внедрить crm |
| **Доп. запросы** | внедрение crm в компанию, этапы внедрения crm |
| **Цель страницы** | Информ + подвод к /ceny, демо |
| **Основной CTA** | Запросить демо / Цены |
| **Шаблон** | 4 (информационная статья) |
| **Секции** | Intro → этапы/чек-лист → CTA на /ceny, демо |
| **Ссылки с страницы** | /ceny, /vozmozhnosti, /crm-dlya-biznesa |
| **Ссылки на страницу** | /kak-vybrat-crm, /chto-takoe-crm, /faq |
| **Комментарий** | По мере ресурсов. |

---

#### 3.6 Дополнительные страницы (по мере ресурсов)

Кратко — без полной расписки; при создании использовать ту же структуру матрицы.

| URL | Тип | Приоритет | Кластер | Главный запрос | Шаблон |
|-----|-----|-----------|--------|----------------|--------|
| `/crm-s-whatsapp` | WhatsApp | P3 | C | crm с whatsapp | 2 или усилить /whatsapp-crm |
| `/crm-dlya-zayavok` | Коммерческая | P3 | B | crm для заявок | 1 |
| `/crm-dlya-uslug` | Отраслевая | P3 | G | crm для услуг | 3 |
| `/crm-dlya-servisnogo-biznesa` | Отраслевая | P3 | G | crm для сервисной компании | 3 |
| `/zachem-nuzhna-crm` | Информационная | P3 | I | зачем нужна crm | 4 |
| `/upravlenie-klientami` | Страница функции | P3 | A, D | управление клиентами crm | 2 |
| `/bystrye-otvety` | Страница функции | P3 | C | быстрые ответы в crm | 2 (если ещё не сделана как фичевая) |

---

## 4. Логика перелинковки (сводка)

- **Главная (/)** → все коммерческие: /crm-dlya-biznesa, /crm-dlya-prodazh, /whatsapp-crm, /crm-dlya-malogo-biznesa, /vozmozhnosti, /ceny, /faq; при появлении — /analitika-prodazh, /chto-takoe-crm.
- **Коммерческие широкие** (/crm-dlya-biznesa, /crm-dlya-prodazh, /whatsapp-crm, /crm-dlya-malogo-biznesa, /crm-dlya-komandy) → /vozmozhnosti, /ceny, /faq, смежные фичевые и коммерческие.
- **Фичевые** (/analitika-prodazh, /upravlenie-sdelkami, /kontrol-menedzherov) → /crm-dlya-prodazh, /vozmozhnosti, /ceny, /faq.
- **Отраслевые** → /crm-dlya-biznesa, /vozmozhnosti, /ceny, релевантные фичевые (склад, сделки).
- **Информационные** (/chto-takoe-crm, /kak-vybrat-crm, /kak-vnedrit-crm) → /crm-dlya-biznesa, /vozmozhnosti, /ceny, /faq.
- **Сравнительные** → /ceny, /vozmozhnosti, /crm-dlya-biznesa.
- **/vozmozhnosti** → все фичевые и коммерческие.
- **/ceny**, **/faq** → коммерческие посадочные и /vozmozhnosti.

На каждой странице — явный основной CTA (Попробовать, Создать компанию, Возможности, Цены, Демо).

---

## 5. Как не допускать дублирования и каннибализации

1. **Один основной intent на одну страницу** — не создавать вторую страницу под тот же главный запрос.
2. **При сомнении — усиливать существующую** — например, блок «Сравнение с обычным WhatsApp» на /whatsapp-crm вместо дублирования контента на отдельной странице.
3. **Отраслевые страницы** — начинать с 1–2 ниш (стройка, производство), добавлять по данным и запросам.
4. **Сравнительные** — формулировки «альтернатива X», «сравнение с Y» — нейтральные, без оскорблений конкурентов.
5. **Каждая новая страница** — встроена в перелинковку: минимум 2–3 входящие ссылки с других публичных страниц и 3–5 исходящих на коммерческие/фичевые/цены/FAQ.

---

## 6. Связь с public design system

- Все новые страницы собираются в **SEOPageLayout** (PublicLayout + SEO).
- Разметка: **PublicSection** + **PublicContainer** для обёрток; **PublicSectionTitle** для заголовков секций; **PublicCard** для карточек; **PublicButton** для кнопок; **PublicCTASection** для финального CTA.
- Контентные блоки: использовать готовые секции из `src/pages/landing/` (HeroSection, FeaturesSection, Why2wixSection, UseCasesSection, ScreenshotsSection, FAQSection, CTASection) или их обобщённые версии с пропсами (title, items, links).
- Стили и отступы — из **publicTokens** (`src/public/theme/tokens.ts`), без дублирования классов в каждой странице.
- Документ по дизайн-системе: `src/public/README.md`.

---

## 7. Рекомендуемый порядок создания после этого этапа

По матрице логично делать дальше в таком порядке:

1. **/analitika-prodazh** (P1) — закрыть кластер «аналитика/руководитель», шаблон 2.
2. **/upravlenie-sdelkami** (P1) — коммерческий фокус «сделки», шаблон 2.
3. **/chto-takoe-crm** (P1) — информационный трафик и подвод к коммерческим, шаблон 4.
4. **/crm-dlya-komandy** (P2) — кластер «команда/менеджеры», шаблон 1.
5. **/kak-vybrat-crm** (P2) — преконверсия, шаблон 4.

Далее по приоритетам P2–P3 и по ресурсам: /kontrol-menedzherov, /crm-dlya-stroitelnoi-kompanii, /crm-ili-excel, /alternativa-amocrm или /alternativa-bitrix24.

---

Документ можно обновлять по мере появления новых страниц, данных Search Console и сдвига приоритетов.
