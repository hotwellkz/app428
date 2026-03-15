# SEO-система публичных страниц 2wix

Единый слой для title, description, canonical, robots, Open Graph и Twitter Card на всех публичных страницах.

## Где что менять

| Задача | Файл |
|--------|------|
| Базовый URL, название сайта, дефолты (og:image, robots и т.д.) | `seoConfig.ts` |
| Логика canonical, формат title | `seoHelpers.ts` |
| Рендер мета-тегов и JSON-LD | `PublicPageSEO.tsx` |

## Как задать SEO на новой публичной странице

1. Используйте **SEOPageLayout** (если страница с общим header/footer):

```tsx
import { SEOPageLayout } from './SEOPageLayout';

export const MyNewPage = () => (
  <SEOPageLayout
    title="Заголовок страницы"
    description="Краткое описание для поисковиков и соцсетей."
    path="/my-page"
  >
    {/* контент */}
  </SEOPageLayout>
);
```

2. Или только **PublicPageSEO** (если свой layout, как на главной):

```tsx
import { PublicPageSEO } from '../../seo';

<PublicPageSEO
  title="Заголовок"
  description="Описание"
  path="/my-page"
/>
```

Опционально: `ogImage`, `breadcrumbs`, `structuredData`, переопределения для Twitter/OG.

## Дефолты

- **robots:** `index, follow`
- **og:image / twitter:image:** из `seoConfig.defaultOgImage`
- **og:type:** `website`
- **twitter:card:** `summary_large_image`
- Если не передан `title` или `description` — подставляются значения из `seoConfig`; в dev в консоль выводится предупреждение.

## noindex для внутренних страниц CRM

Внутренние страницы после логина не используют PublicPageSEO. Для них в **AuthGuard** при монтировании рендерится компонент **CrmNoIndex** (`src/components/seo/CrmNoIndex.tsx`), который выставляет `meta name="robots" content="noindex, nofollow"`.

## Canonical

Всегда строится от `seoConfig.baseUrl`, без localhost и без query-string. Путь можно передать явно (`path="/ceny"`) или он берётся из `useLocation().pathname`.

## Structured Data (JSON-LD)

- **Breadcrumbs:** передайте `breadcrumbs={[{ name: 'Главная', item: 'https://2wix.ru/' }, ...]}` — добавится BreadcrumbList.
- **Произвольная разметка:** передайте `structuredData={[schema1, schema2]}` (массив объектов для `application/ld+json`).

## Dev-предупреждения

В режиме разработки в консоль выводится предупреждение, если у публичной страницы не заданы `title` или `description`, или если canonical URL содержит localhost/preview.
