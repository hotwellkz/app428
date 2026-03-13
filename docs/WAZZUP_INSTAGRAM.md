# Instagram через Wazzup → CRM (Чаты)

## Что сделано в коде

1. **Webhook** сохраняет на диалоге **`wazzupChannelId`**, **`wazzupTransport`**, **`wazzupChatId`** из каждого сообщения Wazzup (`message.channelId`, `message.transport`, `message.chatId`). Поддерживаются **несколько каналов** без ручных env.
2. **Отправка** (`send-whatsapp-message`) использует **только** сохранённый `channelId` (и тот же `chatId` / транспорт). Отдельные **`WAZZUP_CHANNEL_ID` / `WAZZUP_INSTAGRAM_CHANNEL_ID` не нужны**.
3. Перед первым исходящим в новом чате клиент должен **хотя бы раз написать** (или прийти webhook) — иначе ответ **503 MISSING_WAZZUP_CHANNEL** до привязки канала.

## Переменные окружения (Netlify)

| Переменная | Описание |
|------------|----------|
| `WAZZUP_API_KEY` | API Wazzup (обязательно) |

Для отправки в Wazzup **достаточно** ключа: `channelId` подставляется автоматически из webhook.

## Настройка в кабинете Wazzup

1. Канал Instagram (и при необходимости WhatsApp) — по [инструкции Instagram API](https://wazzup24.ru/help/how-to-configurate/podkljuchit-instagram-api/).
2. Webhook URL: `https://<ваш-домен>/.netlify/functions/wazzup-webhook`
3. События: `message_new`, `message_incoming`, при необходимости `chat_created`, `chat_updated`.

## Логи

- Webhook: **`[wazzup-instagram]`**, **`wazzup_routing`** — обновление channelId на диалоге.
- Отправка: **`Wazzup channelId:`** в консоли функции `send-whatsapp-message`.

## Тест

1. Входящее сообщение из Direct → в Firestore у диалога появляются `wazzupChannelId`, `wazzupTransport`, `wazzupChatId`.
2. Ответ из CRM → тот же `channelId`, без WRONG_TRANSPORT.
