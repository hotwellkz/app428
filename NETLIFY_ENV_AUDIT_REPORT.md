# Отчёт аудита переменных окружения Netlify

**Проект:** papaya-seahorse-f4694d (2wix.ru)  
**Дата:** 2025-03-06

---

## 1. Переменные в Netlify (production)

| Ключ | Scope | Примечание |
|------|--------|------------|
| NEXT_PUBLIC_OPENAI_API_KEY | All | Не для Vite: префикс Next.js. Во frontend не используется (нет в коде). Для функций/бэкенда — ок. |
| SUPABASE_URL | All | Без префикса VITE_; во frontend не используется (код использует VITE_SUPABASE_URL). Дубликат для серверных функций. |
| **VITE_API_URL** | All | **ИСПРАВЛЕНО:** было `http://localhost:3000/` → выставлено `https://api.2wix.ru` в production. Ломало production, если бы использовался fallback. |
| VITE_APPROVED_EMAILS | All | OK |
| VITE_BACKEND_URL | All | OK (`https://api.2wix.ru`) |
| VITE_FEED_EDIT_PASSWORD | All | OK |
| VITE_FIREBASE_* | All | Все 6 переменных + BASE64 есть, OK |
| VITE_SOCKET_URL | All | OK (`wss://api.2wix.ru`) |
| **VITE_WEBSOCKET_URL** | All | **ИСПРАВЛЕНО:** было ngrok URL → выставлено `wss://api.2wix.ru`. В коде не найдено использование, но для единообразия задано production-значение. |
| VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY | All | OK |
| VITE_TRANSACTION_DELETE_PASSWORD | All | OK |
| VITE_WHATSAPP_SERVER_URL | All | OK |
| WHATSAPP_* | All | Для серверных функций, не для Vite build — OK |
| SECRETS_SCAN_SMART_DETECTION_ENABLED | Builds | OK |

---

## 2. Локальные ENV

- **.env.local** (есть): только `VITE_FEED_EDIT_PASSWORD`, `VITE_TRANSACTION_DELETE_PASSWORD`, `VITE_APPROVED_EMAILS`.
- **.env / .env.production / .env.development** в репозитории не найдены (скорее всего в .gitignore или не созданы).
- Локально Firebase/Supabase подхватываются из хардкода fallback в `src/lib/firebase/config.ts` и `src/lib/supabase/config.ts`, если переменные не заданы.

---

## 3. Использование в коде (Vite)

Все переменные, которые нужны в браузере, имеют префикс **VITE_** и используются через `import.meta.env.*`:

| Переменная | Файлы |
|------------|--------|
| VITE_APPROVED_EMAILS | Feed.tsx, Sidebar.tsx, lib/firebase/transactions.ts |
| VITE_FEED_EDIT_PASSWORD | Feed.tsx |
| VITE_TRANSACTION_DELETE_PASSWORD | lib/firebase/transactions.ts |
| VITE_BACKEND_URL, VITE_API_URL | config/api.ts |
| VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY | lib/supabase*.ts, utils/supabaseClient.ts |
| VITE_FIREBASE_* | lib/firebase/config.ts |
| import.meta.env.DEV | config/api.ts (локально = localhost, в prod = VITE_BACKEND_URL \|\| VITE_API_URL) |

**process.env** используется только для `NODE_ENV === 'development'` в ErrorBoundary — это штатное поведение Vite.

---

## 4. Найденные проблемы и исправления

### Исправлено автоматически

1. **VITE_API_URL**  
   - Было: `http://localhost:3000/` в production.  
   - Стало: `https://api.2wix.ru` в production.  
   - Риск: в production сборка могла обращаться к localhost вместо API.

2. **VITE_WEBSOCKET_URL**  
   - Было: временный ngrok URL.  
   - Стало: `wss://api.2wix.ru` (в т.ч. production).  
   - В коде переменная не найдена, но значение задано для консистентности.

### Рекомендации (не меняли)

- **NEXT_PUBLIC_OPENAI_API_KEY** — во frontend не используется; оставлена для возможных Netlify Functions. При использовании в Vite-коде нужен префикс VITE_.
- **SUPABASE_URL** (без VITE_) — во frontend не используется; можно оставить для серверного контекста или удалить, если не нужна.

---

## 5. Build и деплой

- **netlify.toml**: только `SECRETS_SCAN_SMART_DETECTION_ENABLED = "false"` и SPA redirect.  
- Build: стандартный `npm run build` (из настроек сайта / GitHub).  
- **vite.config.ts**: `envPrefix: 'VITE_'` — корректно, подхватываются только VITE_*.

---

## 6. Итог

- **Отличались:** VITE_API_URL (localhost в prod), VITE_WEBSOCKET_URL (ngrok).  
- **Отсутствующих** обязательных для frontend переменных не найдено.  
- **Лишние для Vite build:** NEXT_PUBLIC_OPENAI_API_KEY, SUPABASE_URL (без VITE_) — на сборку не влияют.  
- **Production env после правок** совпадает с ожидаемым: API и WebSocket указывают на `https://api.2wix.ru` / `wss://api.2wix.ru`.

Чтобы применить изменения на сайте, нужно **перезапустить деплой** (новый deploy из GitHub или `netlify deploy --prod` после `netlify build`).
