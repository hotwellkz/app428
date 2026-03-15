# Пререндер SEO-страниц (2wix.ru)

## Задача

SPA отдаёт почти пустой HTML (`<div id="root"></div>`). Поисковики и соцсети видят только то, что в исходном HTML. Чтобы в выдаче и превью были корректные title, description, H1 и контент, нужен пререндер основных публичных страниц.

## Что сделано

1. **Статический index.html**  
   В `index.html` добавлены meta по умолчанию для главной: `description`, `canonical`, `robots`, Open Graph и Twitter Card. Это улучшает главную страницу даже без пререндера.

2. **Скрипт пререндера**  
   `scripts/prerender-seo.cjs` после сборки поднимает локальный сервер с `dist/`, открывает в Puppeteer указанные маршруты, ждёт отрисовки React и Helmet и сохраняет итоговый HTML в `dist/` (для `/` — в `dist/index.html`, для остальных — в `dist/<path>/index.html`).

3. **Маршруты для пререндера**  
   В скрипте заданы маршруты:
   - `/`
   - `/crm-dlya-biznesa`
   - `/crm-dlya-malogo-biznesa`
   - `/crm-dlya-prodazh`
   - `/whatsapp-crm`
   - `/vozmozhnosti`
   - `/ceny`
   - `/faq`

4. **OG/Twitter на всех SEO-страницах**  
   Компонент `PublicPageSEO` (react-helmet-async) на каждой публичной странице выставляет `title`, `description`, `canonical`, `og:*`, `twitter:*`. В пререндеренном HTML эти теги уже попадают в исходник.

## Как запускать

**Обычная сборка (без пререндера):**
```bash
npm run build
```

**Сборка с пререндером (HTML с контентом и meta):**
```bash
npm run build:prerender
```

Для `build:prerender` нужен Chromium/Chrome (через Puppeteer). Если браузер не установлен:
- установите: `npm i -D puppeteer` (без `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` — тогда подтянется Chromium);
- или задайте путь к Chrome: `PUPPETEER_EXECUTABLE_PATH=/path/to/chrome node scripts/prerender-seo.cjs`.

## Деплой (Netlify и др.)

Чтобы в проде отдавался пререндеренный HTML:

1. В настройках сборки замените команду на:
   ```bash
   npm run build:prerender
   ```
2. Убедитесь, что в среде сборки доступен Chromium (образ с Chrome или установка Puppeteer с загрузкой Chromium). При необходимости задайте `PUPPETEER_EXECUTABLE_PATH`.
3. Публикация — как обычно, каталог `dist` (в нём уже будут `index.html` и вложенные каталоги с `index.html` для каждого маршрута).

Сервер должен отдавать по пути `/path` файл `dist/path/index.html`, если он есть (поведение Netlify и большинства статических хостингов).

## Проверка

После `npm run build:prerender`:

- Откройте `dist/index.html` в браузере или посмотрите исходный код — в `<head>` должны быть актуальные title, description, og:*, twitter:*.
- Для маршрута, например, `/crm-dlya-biznesa` откройте `dist/crm-dlya-biznesa/index.html` — в исходнике должны быть те же meta и контент внутри `#root`.

## Расширение списка маршрутов

Список маршрутов задаётся массивом `PRERENDER_ROUTES` в `scripts/prerender-seo.cjs`. Чтобы пререндерить новую страницу, добавьте в этот массив путь (например, `'/chto-takoe-crm'`).
