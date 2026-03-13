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
| `WAZZUP_INSTAGRAM_CHANNEL_ID` | **Обязателен для ответов в Instagram.** UUID канала **Instagram** в Wazzup. Это **не** ID WhatsApp-канала. Без него — ошибка **WRONG_TRANSPORT**. |

## Где взять `WAZZUP_INSTAGRAM_CHANNEL_ID`

В статьях Wazzup ID канала в явном виде не подписан, но он — у **отдельной строки канала Instagram** в кабинете (у каждого мессенджера свой канал и свой UUID).

### 1. Сначала должен быть канал Instagram

По инструкции **[Как подключить Instagram API](https://wazzup24.ru/help/how-to-configurate/podkljuchit-instagram-api/)** (шаг 6): личный кабинет Wazzup → **«Каналы»** → **«Добавить канал»** → **Instagram** → авторизация Facebook/Meta → выбор аккаунта → **«Добавить»**. После этого в списке каналов появляется **отдельная строка Instagram** (директ и при необходимости комментарии) — это и есть тот канал, чей UUID нужен в env.

Статья **[Настройка комментариев из Instagram](https://wazzup24.ru/help/how-to-configurate/nastrojka-kommentariev-iz-instagram/)** про то же место: **«Каналы»** → **шестерёнка** у строки канала → карточка настроек (комментарии, фильтры). Эта строка — ваш Instagram-канал; его UUID и есть `WAZZUP_INSTAGRAM_CHANNEL_ID`.

### 2. Надёжный способ — API Wazzup

С тем же ключом, что и `WAZZUP_API_KEY`, запросите список каналов (в документации Wazzup раздел **«Работа с каналами»**, API v3):

```http
GET https://api.wazzup24.com/v3/channels
Authorization: Bearer <WAZZUP_API_KEY>
```

В ответе найдите объект канала, у которого тип/транспорт **Instagram** (не WhatsApp). Поле **`id`** (UUID вида `b96a353b-…`) скопируйте в Netlify как **`WAZZUP_INSTAGRAM_CHANNEL_ID`**.

Альтернатива: в теле **входящего webhook** от Wazzup у сообщений из Instagram уже есть **`channelId`** — это как раз ID Instagram-канала (можно один раз посмотреть в логах после сообщения из Direct).

### 3. Что не путать

| Переменная | Канал в Wazzup |
|------------|----------------|
| `WAZZUP_CHANNEL_ID` | WhatsApp (или WABA) |
| `WAZZUP_INSTAGRAM_CHANNEL_ID` | **Только** Instagram API (отдельная строка в «Каналы») |

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
