# Public Design System — публичная часть 2wix.ru

Отдельная дизайн-система **только для маркетинговых и SEO-страниц**. Внутренняя CRM после логина её не использует и не затрагивается.

**Тема:** единый визуальный стиль публичных страниц задаётся из **JSON design tokens** и применяется централизованно.

## Подключение JSON design tokens

- **Файл токенов:** в корне проекта — `salesforce-design-tokens-green.json`.
- **Подключение:** в `tailwind.config.js` тема Tailwind (цвета `sf.*`, скругления, тени, отступы) загружается из этого JSON через `require()`. Один источник правды: меняете JSON — меняется оформление всех публичных страниц.
- **Семантический слой:** `src/public/theme/tokens.ts` — классы Tailwind, сведённые к токенам (например `publicTokens.button.primary`, `publicTokens.bg.page`). Компоненты публичной части используют эти токены или классы вида `text-sf-text-primary`, `bg-sf-primary`, `rounded-sfCard` и т.д., чтобы не хардкодить цвета.
- **Что из JSON попадает в тему:** `tokens.colors` → `theme.extend.colors.sf`, `tokens.borderRadius` → `sfButton`, `sfCard`, `sfBadge`, `tokens.shadows` → `sfSm`, `sfMd`, `sfCard`, `sfCardHover`, `layout.sectionPaddingY` / `containerPadding` → spacing `section`, `container`. Шрифт Source Sans 3 подключён в `index.html` и задан в `theme.extend.fontFamily.sans`.
- **Как менять публичный дизайн централизованно:** правьте `salesforce-design-tokens-green.json` (цвета, тени, радиусы, отступы) и при необходимости `src/public/theme/tokens.ts` (если добавляются новые семантические токены). Внутренняя CRM не использует `sf.*` и не затрагивается.

## Контраст на тёмном фоне (footer / нижний CTA)

Секции с **тёмным фоном** (`bg-sf-primary` — footer, нижний CTA) должны использовать только токены **`onDark`** из `publicTokens.onDark`:

- `onDark.heading` — заголовки
- `onDark.body` — основной текст (подзаголовок)
- `onDark.muted` — второстепенный текст
- `onDark.link` — ссылки и кнопки-ссылки
- `onDark.copyright` — копирайт в footer
- `onDark.border` — разделители

**Не использовать** на тёмном фоне: `text-sf-text-muted`, `text-sf-text-secondary`, `text-sf-text-primary` — они рассчитаны на светлый фон и дают плохой контраст (зелёный на зелёном).

В `tailwind.config.js` для footer и тёмного CTA добавлен **safelist** классов (`bg-sf-primary`, `text-white`, `text-white/95`, …), чтобы они гарантированно попадали в сборку и не вырезались при purge (динамические классы из переменных иногда не подхватываются).

## Какие компоненты используют theme

- **Layout:** PublicHeader, PublicFooter, PublicLayout, PublicContainer, PublicSection — классы из `publicTokens` и `sf.*`.
- **Компоненты:** PublicButton, PublicCard, PublicCTASection, PublicSectionTitle, PublicNavLink — стили из `tokens.ts` и Tailwind `sf.*`.
- **Секции лендинга:** HeroSection, ForWhoSection, FeaturesSection, Why2wixSection, UseCasesSection, ScreenshotsSection, FAQSection, CTASection, PublicCTA — только классы `sf.*` и при необходимости `publicTokens`.
- **Страницы:** главная, /vozmozhnosti, /crm-dlya-biznesa, /crm-dlya-prodazh, /whatsapp-crm, /crm-dlya-malogo-biznesa, /upravlenie-klientami, /analitika-prodazh, /kontrol-menedzherov, /upravlenie-zayavkami, /ceny, /faq — оформлены через theme (никаких `slate-*`, `emerald-*` в публичной части).

## Структура

| Путь | Назначение |
|------|------------|
| `theme/tokens.ts` | Семантические токены (классы) для кнопок, карточек, секций, типографики |
| `layout/` | PublicLayout, PublicHeader, PublicFooter, PublicContainer, PublicSection |
| `components/` | PublicButton, PublicSectionTitle, PublicCard, PublicCTASection |

## Где что менять

- **Цвета, кнопки, карточки, отступы секций** — `src/public/theme/tokens.ts`
- **Шапка и подвал сайта** — `src/public/layout/PublicHeader.tsx`, `PublicFooter.tsx`
- **Обёртка страницы** — `src/public/layout/PublicLayout.tsx`
- **Контейнер и секции** — `src/public/layout/PublicContainer.tsx`, `PublicSection.tsx`

## Как собирать новую публичную страницу

1. Использовать **SEOPageLayout** (он уже подключает PublicLayout + SEO):
   ```tsx
   <SEOPageLayout title="..." description="..." path="/my-page">
     <PublicSection variant="default">
       <PublicContainer>
         <PublicSectionTitle title="..." subtitle="..." />
         ...
       </PublicContainer>
     </PublicSection>
   </SEOPageLayout>
   ```

2. Кнопки — **PublicButton** с вариантом `primary` / `secondary` / `ctaDark` и т.д.

3. Карточки — **PublicCard** с вариантом `base` / `feature` / `muted`.

4. CTA-блок внизу — **PublicCTASection** с пропсами title, subtitle, primaryLabel, secondaryTo.

5. Контейнеры и секции — **PublicContainer** (size: base | narrow | wide), **PublicSection** (variant: default | subtle | dark | large).

## Изоляция от CRM

- Публичные компоненты и layout используются только в маршрутах до логина (главная, /vozmozhnosti, /ceny, /faq и т.д.).
- У корневых элементов публичной части стоит атрибут `data-public-site` — при необходимости можно подключать стили только для `[data-public-site]`.
- В `index.css` и глобальных стилях CRM нет классов, завязанных на public design system; общие утилиты Tailwind по-прежнему общие.

## Что не трогать

- Внутренние страницы CRM (transactions, feed, whatsapp, analytics, employees и т.д.)
- App layout, Sidebar, Header приложения
- Стили и компоненты внутри `src/pages/` (кроме `src/pages/landing/`)
- Роутинг и AuthGuard

Изменения в `src/public/` влияют только на публичный сайт.
