# WhatsApp CRM: статусы сообщений и медиа-вложения

## A. Фактический контракт Wazzup (по документации)

### Webhook: новые сообщения (`body.messages`)

| Поле | Тип | Описание |
|------|-----|----------|
| messageId | string (uuid4) | ID сообщения в Wazzup |
| channelId | string | ID канала |
| chatType | string | `whatsapp`, `telegram`, `instagram`, `whatsgroup`, `viber` |
| chatId | string | Номер/аккаунт контакта |
| dateTime | string | Время в формате ISO |
| type | string | `text`, `image`, `video`, `audio`, `document`, `geo`, `vcard`, `wapi_template`, `unknown`, `missing_call`, `unsupported` |
| status | string | Для входящих: `inbound`. Для исходящих в том же объекте: `sent`, `delivered`, `read`, `error` |
| text | string | Текст (может отсутствовать у медиа) |
| contentUri | string | Ссылка на контент (медиа/файл) |
| isEcho | boolean | `false` — входящее, `true` — исходящее (с телефона/iframe) |
| contact | object | name, phone, avatarUri, username (Telegram) |
| error | object | При status=error: error, description |

### Webhook: обновление статусов исходящих (`body.statuses`)

Один запрос может содержать и `messages`, и `statuses`.

| Поле | Тип | Описание |
|------|-----|----------|
| messageId | string | GUID сообщения Wazzup (тот же, что вернулся при отправке) |
| timestamp | string | Время обновления статуса |
| status | string | `sent`, `delivered`, `read`, `error`, `edited` |
| error | object | При status=error: error, description, [data] |

Поддерживаемые статусы (как в мессенджере):
- **sent** — одна серая галочка (принято сервером)
- **delivered** — две серые галочки
- **read** — две синие галочки
- **error** — ошибка доставки

### Отправка сообщения (POST /v3/message)

Ответ при успехе (200): в теле может быть `messageId` (guid) — по нему потом приходят обновления в `statuses`.

---

## B. Что реализовано

### Полностью

1. **Статусы исходящих в UI**
   - В модели: `status`, `statusUpdatedAt`, `providerMessageId`, `errorMessage`.
   - При отправке сохраняем сообщение с `status: 'sent'` и `providerMessageId` из ответа API.
   - Webhook обрабатывает `body.statuses` и обновляет документ по `providerMessageId`.
   - В пузыре исходящего: иконка (часы / одна галочка / две серые / две синие / восклицание при ошибке).

2. **Медиа-вложения**
   - Входящие: по полям `type` и `contentUri` формируется массив `attachments` (image, video, audio, file).
   - В БД хранятся структурированные вложения, а не строка `[media: url]`.
   - В чате: изображения — превью + «Открыть»; видео/аудио/файл — карточка с ссылкой и «Скачать».

3. **Обратная совместимость**
   - Старые сообщения с текстом вида `[media: https://...]` при чтении парсятся в `attachments`, превью в списке — «[медиа]».

4. **Правки по коду**
   - `createConversation(clientId, phone)` в send-whatsapp-message вызывается с `normalizedPhone`.
   - В webhook входящие сохраняются с `providerMessageId` и `attachments`.

### Частично

- **Встроенное воспроизведение видео**: из-за CORS/политики домена Wazzup пока только карточка «Видео» + ссылки «Открыть» и «Скачать». При появлении подписанных/проксируемых URL можно добавить `<video>`.
- **Истекшие ссылки на медиа**: отдельный слой «Ссылка истекла» не реализован; при ошибке загрузки изображения показывается fallback «Открыть» + «(превью недоступно)».

---

## C. Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `src/types/whatsappDb.ts` | Типы `MessageStatus`, `MessageAttachment`; в `WhatsAppMessage` — status, statusUpdatedAt, providerMessageId, errorMessage, attachments |
| `src/components/whatsapp/whatsappUtils.ts` | `mapProviderStatusToUiStatus(rawStatus)` |
| `src/lib/firebase/whatsappDb.ts` | `docToMessage`: чтение status, providerMessageId, attachments, errorMessage; парсинг legacy `[media: url]` в attachments |
| `src/components/whatsapp/ChatWindow.tsx` | `MessageStatusIcon`, `AttachmentBlock`; рендер вложений и иконки статуса у исходящих |
| `src/components/whatsapp/ConversationList.tsx` | Превью последнего сообщения: «[медиа]» при наличии attachments |
| `netlify/functions/lib/firebaseAdmin.ts` | `SaveMessageOptions`, `saveMessage(..., options)`, `updateMessageStatus(providerMessageId, status, errorMessage?)` |
| `netlify/functions/wazzup-webhook.ts` | Обработка `statuses`; входящие сохраняются с type/contentUri → attachments, providerMessageId |
| `netlify/functions/send-whatsapp-message.ts` | Сохранение исходящего с `status: 'sent'`, `providerMessageId` из ответа; `createConversation(client.id, normalizedPhone)` |

---

## D. Миграция старых сообщений

Отдельный скрипт миграции не добавлялся. Старые сообщения обрабатываются при чтении:

- В `docToMessage` (клиент): если `text` совпадает с шаблоном `[media: https?://...]`, из него извлекается URL и формируется один элемент в `attachments`, текст в пузыре не показывается.
- Документы в Firestore не перезаписываются; при первом сохранении ответа в том же чате новые сообщения уже пишутся с `attachments` и при необходимости с `providerMessageId`.

При желании можно добавить одноразовую миграцию: для документов в `whatsappMessages` с `text` вида `[media: ...]` распарсить URL и записать поле `attachments`, не трогая остальные поля.

---

## E. Ограничения по API Wazzup

- Статусы `delivered` и `read` приходят только если провайдер/мессенджер их отдаёт; мы их только отображаем.
- Ответ отправки может не содержать `messageId` (зависит от версии API) — тогда обновления по статусам для этого сообщения приходить не будут, в UI останется «Отправлено» (одна галочка).
- Медиа по `contentUri` могут быть с ограниченным сроком жизни; при истечении ссылки превью/воспроизведение не сработает, остаётся «Открыть»/«Скачать».

---

## F. Сценарии проверки

1. **Отправить текст** → в пузыре: часы → одна галочка → (при приходе statuses) две серые / две синие.
2. **Ошибка отправки** → в пузыре иконка ошибки и при наличии — `errorMessage`.
3. **Входящее видео** → в чате карточка «Видео» с ссылками «Открыть» и «Скачать», не текст `[media: url]`.
4. **Клик по видео** → открытие ссылки в новой вкладке (или скачивание).
5. **Старое сообщение с `[media: url]`** → отображается как вложение (превью или карточка), в списке чатов — «[медиа]».
6. **Мобильная версия** — статус и медиа не перекрываются плавающими кнопками (сохранены отступы).
7. **Десктоп** — правая панель клиента не перекрывает контент сообщений.
