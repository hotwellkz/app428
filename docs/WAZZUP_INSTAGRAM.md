# Instagram через Wazzup → CRM (Чаты)

## Что сделано в коде

1. **Webhook** `POST /.netlify/functions/wazzup-webhook` (или ваш прокси `POST /api/wazzup/webhook`) принимает JSON от Wazzup.
2. Сообщения с `chatType`: `instagram` / `instagram_direct` / `ig` обрабатываются в **`handleInstagramMessage()`**:
   - CRM-клиент (`clients`) по ключу `instagram:<chatId>`
   - сделка при первом контакте
   - контакт чата (`whatsappClients`), диалог (`whatsappConversations`, `channel: instagram`)
   - сообщение в `whatsappMessages`, непрочитанные — как у WhatsApp
3. **Ответы из CRM**: функция `send-whatsapp-message` принимает `chatType: "instagram"` и **сырой `chatId`** Wazzup (тот же, что в webhook). UI в разделе Чаты подставляет это автоматически, если у клиента `phone` вида `instagram:<chatId>`.

## Переменные окружения (Netlify)

| Переменная | Описание |
|------------|----------|
| `WAZZUP_API_KEY` | API Wazzup |
| `WAZZUP_CHANNEL_ID` | Channel ID канала **WhatsApp** |
| `WAZZUP_INSTAGRAM_CHANNEL_ID` | *(рекомендуется)* Channel ID канала **Instagram** в Wazzup. Если не задан — используется `WAZZUP_CHANNEL_ID` (подойдёт только если у вас один канал или тот же id). |

## Настройка в кабинете Wazzup (вручную)

1. Канал **hotwell.kz** (Instagram): статус **active**, при необходимости включить **CRM / интеграцию** по документации Wazzup.
2. Webhook URL: `https://<ваш-домен>/.netlify/functions/wazzup-webhook` (или ваш API route).
3. События: `message_new`, `message_incoming`, при необходимости `chat_created`, `chat_updated` (тело с `event` без `messages` — ответ 200, ack).

## Логи

На Netlify логи функции смотрите в **Functions → wazzup-webhook**; префикс Instagram: **`[wazzup-instagram]`**.

Локальный/постоянный файл **`/logs/wazzup-instagram.log`** на serverless не создаётся; при необходимости подключите внешний логгер или Netlify Log Drains.

## Тест

1. Задеплоить, прописать webhook и env.
2. Написать в Direct Instagram на подключённый аккаунт.
3. В CRM: **Чаты** — новый диалог с бейджем **IG**, клиент и сделка при первом сообщении.
