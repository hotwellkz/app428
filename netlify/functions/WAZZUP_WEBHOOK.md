# Webhook Wazzup API

## URL webhook

После деплоя на Netlify:

```
POST https://<ваш-сайт>.netlify.app/api/wazzup/webhook
```

Локально (netlify dev):

```
POST http://localhost:8888/api/wazzup/webhook
```

В настройках Wazzup укажите этот URL как адрес для получения входящих сообщений.

---

## Пример запроса от Wazzup

Тело запроса — JSON с массивом `messages`:

```json
{
  "messages": [
    {
      "messageId": "6a2087e8-e0f4-9999-b968-9d9999933c81",
      "dateTime": "2025-05-06T14:16:00.002Z",
      "channelId": "b96a353b-9999-4cac-8413-ba99999f981",
      "chatType": "whatsapp",
      "chatId": "79991234567",
      "type": "text",
      "status": "inbound",
      "isEcho": false,
      "text": "Здравствуйте, хочу уточнить по заказу",
      "contact": {
        "name": "Иван",
        "avatarUri": "https://store.wazzup24.com/..."
      }
    }
  ]
}
```

Обрабатываются только сообщения с `chatType === "whatsapp"` и входящие (`isEcho === false` или `status === "inbound"`). Номер клиента берётся из `chatId`, имя — из `contact.name`.

---

## Пример сохранения в БД

1. **Клиент** (коллекция `whatsappClients`): ищется по нормализованному номеру (`+79991234567`). Если не найден — создаётся запись:
   - `name`: `"Иван"` (из `contact.name` или сам номер)
   - `phone`: `"+79991234567"`
   - `createdAt`: серверное время

2. **Диалог** (коллекция `whatsappConversations`): ищется активный диалог по `clientId`. Если нет — создаётся:
   - `clientId`: id из `whatsappClients`
   - `status`: `"active"`
   - `createdAt`: серверное время

3. **Сообщение** (коллекция `whatsappMessages`):
   - `conversationId`: id из `whatsappConversations`
   - `text`: `"Здравствуйте, хочу уточнить по заказу"`
   - `direction`: `"incoming"`
   - `channel`: `"whatsapp"`
   - `createdAt`: серверное время

---

## Переменные окружения (Netlify)

В настройках сайта Netlify → Environment variables добавьте:

- **`FIREBASE_SERVICE_ACCOUNT_JSON`** — строка JSON с ключом сервисного аккаунта Firebase (для доступа к Firestore из функции). Получить: Firebase Console → Project settings → Service accounts → Generate new private key.
- **`WAZZUP_WEBHOOK_DEBUG=1`** — (опционально) включить подробный лог входящего payload и обработки сообщений (логи в Netlify Functions → wazzup-webhook).

---

## Логирование

В логах Netlify Function будут строки вида:

- `[wazzup-webhook] Received messages count: 1`
- `[wazzup-webhook] Process incoming: { normalizedPhone, text, authorName }`
- `[wazzup-webhook] Created client: <id> phone= +79991234567`
- `[wazzup-webhook] Found existing client: <id>`
- `[wazzup-webhook] Created conversation: <id> clientId= <clientId>`
- `[wazzup-webhook] Saved message: <id> conversationId= <conversationId>`

Просмотр: Netlify Dashboard → Functions → wazzup-webhook → Logs.
