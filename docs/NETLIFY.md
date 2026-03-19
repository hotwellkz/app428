# Настройка Netlify (2wix.ru / CRM)

Чтобы **API работали** (`/api/templates-delete`, `/api/chats-search`, отправка WhatsApp, webhook и т.д.), запросы должны попадать **на Netlify**, а не на статический хостинг. Редиректы из `netlify.toml` срабатывают **только** если сайт открыт с **домена, привязанного к этому же сайту Netlify**.

---

## 1. Сайт на Netlify

1. [Netlify](https://app.netlify.com) → **Add new site** → Import from Git (репозиторий с этим проектом).
2. Настройки сборки (обычно подхватываются из репо):

| Параметр        | Значение        |
|----------------|-----------------|
| Build command  | `npm run build` |
| Publish directory | `dist`      |

3. **Deploy** — после деплоя в корне сайта уже действуют правила из **`netlify.toml`** (редиректы `/api/...` → Functions).

---

## 2. Сборка: полнотекстовый поиск чатов (опционально)

По умолчанию поиск в WhatsApp идёт **только по уже загруженным чатам** (без запроса к API — нет лишних 404 в консоли).

Чтобы включить **серверный** поиск (`POST /api/chats-search` → Function `chats-search`):

1. В Netlify: **Site configuration → Environment variables → Build** добавьте:
   - **`VITE_CHATS_SEARCH_API`** = `true`
2. Пересоберите сайт (**Deploy**).

Файл **`public/_redirects`** дублирует маршруты API **выше** правила `/* → index.html`, иначе SPA перехватывает `/api/chats-search` и возможен **404**.

Пока домен не отдаётся с Netlify (где есть Functions + `_redirects`), серверный поиск недоступен.

---

## 3. Переменные окружения (обязательно для Functions)

**Site settings → Environment variables** (или **Project configuration → Environment variables**).

| Переменная | Назначение |
|------------|------------|
| **`FIREBASE_SERVICE_ACCOUNT_JSON`** | JSON сервисного аккаунта Firebase (одной строкой). Нужен почти всем функциям с Firestore Admin. Альтернатива: разбить на `FIREBASE_SA_1` … `FIREBASE_SA_5` (см. `netlify/functions/lib/firebaseAdmin.ts`). |
| **`WAZZUP_API_KEY`** | Отправка сообщений WhatsApp (`send-whatsapp-message`). |
| **`OPENAI_API_KEY`** | AI: ответы, анализ клиента, транскрипция (если используете). |

Опционально:

| Переменная | Назначение |
|------------|------------|
| `WAZZUP_WEBHOOK_DEBUG` | `1` — подробные логи webhook. |

После изменения env — **Redeploy** (Trigger deploy), иначе функции не подхватят новые значения.

---

## 4. Домен 2wix.ru (главное для API)

### Вариант A — сайт целиком на Netlify (рекомендуется)

1. **Domain settings** → **Add custom domain** → `2wix.ru` (и при необходимости `www`).
2. В DNS у регистратора записи как подскажет Netlify (часто **A** / **CNAME** на Netlify).
3. Включить **HTTPS** (Let’s Encrypt в Netlify).

Тогда любой запрос к `https://2wix.ru/api/chats-search` обрабатывается **Netlify** → срабатывают редиректы из `netlify.toml` → **404 исчезают**, если функция задеплоена.

### Вариант B — перед сайтом стоит свой nginx/хостинг

Если **HTML** отдаётся с вашего сервера, а Netlify используется только «где-то сбоку», то `https://2wix.ru/api/...` **никогда не попадёт** в Netlify → будут **404** и **HTML вместо JSON**.

Нужно либо:

- перевести **весь** трафик домена на Netlify (вариант A), либо  
- в nginx проксировать **каждый** нужный путь на URL Netlify, например:

```nginx
# Пример: замените YOUR-SITE на имя сайта в Netlify
set $netlify https://YOUR-SITE.netlify.app;

location = /api/chats-search {
  proxy_pass $netlify/.netlify/functions/chats-search;
  proxy_ssl_server_name on;
  proxy_set_header Host YOUR-SITE.netlify.app;
  proxy_pass_request_headers on;
  proxy_set_header Authorization $http_authorization;
  client_max_body_size 25m;
}

location = /api/templates-delete {
  proxy_pass $netlify/.netlify/functions/delete-quick-reply-template;
  proxy_ssl_server_name on;
  proxy_set_header Host YOUR-SITE.netlify.app;
  proxy_pass_request_headers on;
  proxy_set_header Authorization $http_authorization;
}

# Аналогично для остальных API из netlify.toml:
# /api/send-whatsapp-message, /api/wazzup/webhook, /api/ai/*, …
```

Проще и надёжнее — **вариант A**: один хост (Netlify), один `netlify.toml`.

---

## 5. Какие URL уже настроены в `netlify.toml`

| URL | Function |
|-----|----------|
| `POST/GET …/api/wazzup/webhook` | `wazzup-webhook` |
| `POST …/api/send-whatsapp-message` | `send-whatsapp-message` |
| `POST …/api/ai/analyze-client` | `ai-analyze-client` |
| `POST …/api/ai/generate-reply` | `ai-generate-reply` |
| `POST …/api/ai/transcribe-voice` | `ai-transcribe-voice` |
| `DELETE …/api/templates/*` | `delete-quick-reply-template` |
| `POST …/api/templates-delete` | `delete-quick-reply-template` |
| `GET …/api/chats/search` | `chats-search` |
| `POST …/api/chats-search` | `chats-search` |
| `POST …/api/crm-ai-bot-test` | `crm-ai-bot-test` (тест-чат автоворонок; фронт по умолчанию бьёт в `/.netlify/functions/crm-ai-bot-test`) |

Правило `/* → /index.html` идёт **последним** — важно, чтобы блоки `/api/*` были **выше** (в репозитории уже так).

---

## 6. Firestore (отдельно от Netlify)

Индексы для WhatsApp (в т.ч. поиск чатов): после изменений в `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

Правила Firestore — при необходимости:

```bash
npm run deploy:firestore-rules
```

---

## 7. Проверка после деплоя

1. Открыть сайт **с того домена, где реально крутится Netlify** (или прокси настроен верно).
2. В DevTools → Network:  
   `POST https://ВАШ-ДОМЕН/api/chats-search`  
   с телом `{"q":"тест"}` и заголовком `Authorization: Bearer <token>` — ответ должен быть **JSON** (`chats`, `total`), не HTML.
3. Логи функций: Netlify → **Functions** → выбрать `chats-search` → **Logs**.

---

## 8. Локально (как у Netlify)

```bash
npm run dev:full
```

Поднимается Vite + Netlify Dev (порт **8888**); прокси в `vite.config.ts` шлёт `/api` на 8888 — поведение близко к продакшену.

---

**Итог:** на Netlify нужно задать **сборку**, **переменные окружения** и убедиться, что **2wix.ru указывает на этот сайт Netlify** (или nginx проксирует `/api/*` на Netlify). Тогда редиректы из `netlify.toml` начнут отдавать Functions, а не 404.
