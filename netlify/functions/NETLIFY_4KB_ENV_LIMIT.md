# Лимит 4KB для переменных окружения (AWS Lambda)

Ошибка: **Your environment variables exceed the 4KB limit imposed by AWS Lambda**.

В Lambda попадают только переменные, у которых в Netlify включён scope **Functions**. Остальные (только Build) в функции не передаются и в лимит не входят.

---

## Решение: оставить для Functions только нужные переменные

Нужно, чтобы в **Functions** были доступны только (пример минимума):

- `WAZZUP_API_KEY`
- `FIREBASE_SA_1`
- `FIREBASE_SA_2`

У всех остальных переменных (VITE_*, SUPABASE_*, NEXT_*, FIREBASE_SERVICE_ACCOUNT_JSON и т.д.) scope **Functions** нужно отключить.

---

## Пошагово в Netlify UI

1. Откройте сайт → **Site configuration** → **Environment variables** (или **Build & deploy** → **Environment**).

2. Убедитесь, что используется **новый** интерфейс переменных (с **Scopes**).  
   Если есть кнопка **Migrate environment variables** — нажмите её один раз.  
   **Scopes доступны на плане Pro и выше.** На Free плане этого пункта может не быть — см. раздел «Если Scopes нет» ниже.

3. Для **каждой** переменной, кроме нужных для функций (WAZZUP_API_KEY, FIREBASE_SA_*):
   - откройте переменную (клик / Edit);
   - в блоке **Scopes** снимите галочку **Functions**;
   - оставьте только **Builds** (и при необходимости другие, кроме Functions);
   - сохраните.

   Список переменных, у которых нужно **убрать** scope Functions (оставить только для сборки):

   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `NEXT_PUBLIC_OPENAI_API_KEY`
   - `SUPABASE_URL`, `VITE_SUPABASE_*`, `VITE_SUPABASE_URL`
   - `VITE_API_URL`, `VITE_APPROVED_EMAILS`, `VITE_BACKEND_URL`
   - `VITE_FEED_EDIT_PASSWORD`, `VITE_FIREBASE_*` (все)
   - `VITE_SOCKET_URL`, `VITE_TRANSACTION_DELETE_PASSWORD`
   - `VITE_WEBSOCKET_URL`, `VITE_WHATSAPP_SERVER_URL`
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
   - `SECRETS_SCAN_SMART_DETECTION_ENABLED`

4. У этих переменных scope **Functions** должен быть **включён** (минимум):
   - `WAZZUP_API_KEY`
   - `FIREBASE_SA_1`
   - `FIREBASE_SA_2`

5. Сохраните изменения и сделайте **Redeploy** (или новый деплой из репозитория).

После этого в Lambda уйдёт меньше переменных, лимит 4KB не должен превышаться.

---

## Если Scopes нет (Free план)

На бесплатном плане у переменных может не быть выбора Scopes, и тогда в функции попадают все переменные сайта.

Варианты:

1. **Перейти на Pro** и настроить Scopes как выше.
2. **Отдельный сайт только для функций** в том же аккаунте Netlify:
   - создать новый сайт (например, «2wix-api») из того же репозитория;
   - в этом сайте в Environment variables задать **как минимум**: `WAZZUP_API_KEY`, `FIREBASE_SA_1`, `FIREBASE_SA_2` (и далее по необходимости);
   - задеплоить;
   - в Wazzup и в приложении использовать URL функций этого сайта (например, `https://2wix-api.netlify.app/.netlify/functions/wazzup-webhook` и `.../send-whatsapp-message`).

---

## Ссылки

- [Environment variables and functions (Netlify)](https://docs.netlify.com/build/functions/environment-variables/)
- [Scopes for environment variables (Netlify Blog)](https://www.netlify.com/blog/scopes-and-contextual-values-for-environment-variables-ga/)
