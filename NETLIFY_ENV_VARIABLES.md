# 🔧 Переменные окружения для Netlify

## ✅ Обязательные переменные

### 1. **API Backend URL** (WhatsApp Server на Synology)
```
VITE_BACKEND_URL=https://api.2wix.ru
```
или
```
VITE_API_URL=https://api.2wix.ru
```

**Описание:** URL вашего WhatsApp сервера, который работает на Synology и проксируется через `api.2wix.ru`.

---

### 2. **Supabase Configuration** (обязательно)
```
VITE_SUPABASE_URL=https://bhlzwqteygmxpxznezyg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobHp3cXRleWdteHB4em5lenlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4ODM2NTcsImV4cCI6MjA1MjQ1OTY1N30.3xAtMLN1Ke_1vrfsCU0LJHF-4G5naIc8dMSH9RG-tjs
```

**Описание:** 
- `VITE_SUPABASE_URL` — URL вашего Supabase проекта
- `VITE_SUPABASE_ANON_KEY` — публичный (anon) ключ Supabase

---

## 🔥 Firebase (обязательно для работы приложения)

**Без этих переменных приложение не запустится** — в консоли будет ошибка «Missing required Firebase environment variables». Добавьте в Netlify **все** перечисленные переменные:

```
VITE_FIREBASE_API_KEY=ваш_api_key
```
или (предпочтительно, если ключ в base64):
```
VITE_FIREBASE_API_KEY_BASE64=ваш_base64_ключ
```

```
VITE_FIREBASE_AUTH_DOMAIN=ваш_auth_domain
VITE_FIREBASE_PROJECT_ID=ваш_project_id
VITE_FIREBASE_STORAGE_BUCKET=ваш_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=ваш_sender_id
VITE_FIREBASE_APP_ID=ваш_app_id
```

**Важно:** После добавления переменных выполните **Clear cache and deploy site** в Netlify, чтобы сборка подхватила значения.

---

## 📋 Итоговый список для Netlify

### Минимальный набор (обязательно):

| Переменная | Значение | Описание |
|-----------|----------|----------|
| `VITE_BACKEND_URL` | `https://api.2wix.ru` | URL WhatsApp API сервера |
| `VITE_SUPABASE_URL` | `https://bhlzwqteygmxpxznezyg.supabase.co` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Anon Key |

### Альтернатива (если используется VITE_API_URL):

| Переменная | Значение | Описание |
|-----------|----------|----------|
| `VITE_API_URL` | `https://api.2wix.ru` | URL WhatsApp API сервера (альтернатива VITE_BACKEND_URL) |
| `VITE_SUPABASE_URL` | `https://bhlzwqteygmxpxznezyg.supabase.co` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase Anon Key |

---

## 🚀 Как добавить в Netlify

### Через Netlify UI:

1. Откройте ваш проект в Netlify Dashboard
2. Перейдите в **Site settings** → **Environment variables**
3. Нажмите **Add a variable**
4. Добавьте каждую переменную:
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** `https://api.2wix.ru`
   - **Scopes:** Выберите **Production** (или **All scopes**)
5. Повторите для всех переменных
6. **Важно:** После добавления переменных нужно **пересобрать сайт** (Trigger deploy → Clear cache and deploy site)

### Через Netlify CLI:

```bash
# Установите Netlify CLI (если еще не установлен)
npm install -g netlify-cli

# Войдите в Netlify
netlify login

# Добавьте переменные
netlify env:set VITE_BACKEND_URL "https://api.2wix.ru" --context production
netlify env:set VITE_SUPABASE_URL "https://bhlzwqteygmxpxznezyg.supabase.co" --context production
netlify env:set VITE_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobHp3cXRleWdteHB4em5lenlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4ODM2NTcsImV4cCI6MjA1MjQ1OTY1N30.3xAtMLN1Ke_1vrfsCU0LJHF-4G5naIc8dMSH9RG-tjs" --context production
```

---

## ✅ Проверка после настройки

### 1. Проверьте в консоли браузера (на https://2wix.ru):

Откройте DevTools (F12) → Console, должны увидеть:

```
🔗 Backend URL: https://api.2wix.ru
🔌 Socket URL: https://api.2wix.ru
```

### 2. Проверьте подключение к API:

В консоли браузера выполните:

```javascript
fetch('https://api.2wix.ru/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

Должен вернуться JSON с `status: 'ok'` или подобным.

### 3. Проверьте Supabase:

В консоли браузера:

```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
```

---

## 🔍 Troubleshooting

### Проблема: Переменные не применяются

**Решение:**
1. Убедитесь, что переменные начинаются с `VITE_` (Vite требует этот префикс)
2. После добавления переменных **обязательно пересоберите сайт** (Clear cache and deploy)
3. Проверьте, что переменные добавлены для правильного **context** (Production/Branch deploy)

### Проблема: CORS ошибки

**Решение:**
Убедитесь, что на Synology в `.env.production` для `whatsapp-server` установлено:

```env
FRONTEND_URL=https://2wix.ru
ALLOWED_ORIGINS=https://2wix.ru,https://www.2wix.ru,https://api.2wix.ru
```

### Проблема: Socket.IO не подключается

**Решение:**
1. Проверьте, что `VITE_BACKEND_URL` указывает на `https://api.2wix.ru` (не `http://`)
2. Убедитесь, что на VPS настроен Nginx для проксирования WebSocket соединений
3. Проверьте логи на Synology: `sudo docker logs whatsapp-server`

---

## 📝 Резюме

**Минимальный набор переменных для Netlify:**

```
VITE_BACKEND_URL=https://api.2wix.ru
VITE_SUPABASE_URL=https://bhlzwqteygmxpxznezyg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobHp3cXRleWdteHB4em5lenlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4ODM2NTcsImV4cCI6MjA1MjQ1OTY1N30.3xAtMLN1Ke_1vrfsCU0LJHF-4G5naIc8dMSH9RG-tjs
```

**После добавления:**
1. ✅ Пересоберите сайт (Clear cache and deploy)
2. ✅ Проверьте консоль браузера на https://2wix.ru
3. ✅ Проверьте подключение к API через DevTools

---

**Готово!** 🎉
