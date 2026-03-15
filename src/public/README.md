# Public Design System — публичная часть 2wix.ru

Отдельная дизайн-система **только для маркетинговых и SEO-страниц**. Внутренняя CRM после логина её не использует и не затрагивается.

## Структура

| Путь | Назначение |
|------|------------|
| `theme/tokens.ts` | Цвета, типографика, отступы, кнопки, карточки, контейнеры — единый источник правды |
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
