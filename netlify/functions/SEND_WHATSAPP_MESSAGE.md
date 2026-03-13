# Отправка WhatsApp сообщений (Wazzup API)

## Endpoint

**POST** `/api/send-whatsapp-message`

После деплоя:
- `https://2wix.ru/api/send-whatsapp-message`
- или `https://papaya-seahorse-f4694d.netlify.app/.netlify/functions/send-whatsapp-message`

## Тело запроса (JSON)

```json
{
  "chatId": "79011112233",
  "text": "Здравствуйте!"
}
```

- **chatId** — номер телефона (с 7 или без, с + или без, будет нормализован).
- **text** — текст сообщения.

## Переменные окружения (Netlify)

- **WAZZUP_API_KEY** — ключ API Wazzup.
- **WAZZUP_API_KEY** — достаточно для отправки. **channelId** берётся из webhook (поле на диалоге `wazzupChannelId`), отдельный env для канала не нужен.
- **FIREBASE_SERVICE_ACCOUNT_JSON** — JSON ключа сервисного аккаунта Firebase (для сохранения в Firestore).

## Поведение

1. По `chatId` ищется/создаётся клиент и диалог в Firestore.
2. Отправляется **POST** на `https://api.wazzup24.com/v3/message` с заголовками `Authorization: Bearer WAZZUP_API_KEY`, `Content-Type: application/json` и телом `{ channelId, chatId, text }`.
3. При успешном ответе Wazzup сообщение сохраняется в коллекцию **whatsappMessages**: `conversationId`, `text`, `direction: "outgoing"`, `channel: "whatsapp"`, `createdAt`.

## Пример curl для теста

```bash
curl -X POST https://2wix.ru/api/send-whatsapp-message \
  -H "Content-Type: application/json" \
  -d '{"chatId":"79011112233","text":"Здравствуйте!"}'
```

Через прямой URL функции:

```bash
curl -X POST https://papaya-seahorse-f4694d.netlify.app/.netlify/functions/send-whatsapp-message \
  -H "Content-Type: application/json" \
  -d '{"chatId":"79011112233","text":"Здравствуйте!"}'
```

Успешный ответ: `{"ok":true,"conversationId":"...","response":{...}}`.

## Если на 2wix.ru приходит 404 на /api/send-whatsapp-message

Редиректы Netlify для кастомного домена иногда не срабатывают. Тогда фронт вызывает прямой URL функции:

1. В **Netlify → Site configuration → Environment variables** добавьте (для сборки):
   - **VITE_WHATSAPP_API_URL** = `https://papaya-seahorse-f4694d.netlify.app`
2. Сделайте **Redeploy**. Фронт будет слать запросы на `https://papaya-seahorse-f4694d.netlify.app/.netlify/functions/send-whatsapp-message` (CORS уже настроен).
