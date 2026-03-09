# Wazzup: отправка медиа и голосовых сообщений

## Диагностика возможностей Wazzup

### Отправка сообщений (POST /v3/message)

- **text** — текст. Обязателен, если не указан `contentUri`.
- **contentUri** — публичная ссылка на файл. Обязателен, если не указан `text`. **С текстом передавать нельзя** (одно из двух).
- Контент по `contentUri` должен быть доступен по GET без редиректов. Wazzup скачивает файл при получении запроса (подходят короткоживущие ссылки).
- Отдельного параметра **type** (image/document/audio) в запросе нет — тип определяет Wazzup по содержимому/расширению.

### Ограничения (из документации Wazzup)

- **Из чата/CRM и по API**: все вложения — **макс. 10 МБ**.
- WhatsApp: изображения (jpeg, jpg, png) — 5 МБ; видео (mp4, 3gpp) — 16 МБ; документы — до 50 МБ; аудио — 16 МБ; голосовые .ogg opus — 16 МБ. При отправке через API действует лимит CRM 10 МБ.
- Telegram: голосовые .mp3/.ogg до 1 МБ уходят как voice; остальное — как файл.

### Поддержка по типам

| Тип | Поддержка | Примечание |
|-----|-----------|------------|
| image | Да | contentUri на картинку (jpeg, png, gif и т.д.) |
| document/file | Да | contentUri на файл (pdf, zip, doc и т.д.) |
| audio | Да | contentUri на аудиофайл |
| voice | Нет отдельного типа в API | Отправка как audio (например .ogg opus). В Telegram до 1 МБ .mp3/.ogg — как голосовое. В UI можно отображать как voice bubble (fallback). |

### Caption

- В одном запросе **нельзя** передать и `text`, и `contentUri`. Подписи к медиа через API не отправляются; при необходимости храним caption только у себя в БД для отображения в CRM.

---

## Реализация в CRM

1. **Загрузка файла**: клиент загружает файл в Supabase Storage по пути `companies/{companyId}/whatsapp/media/{conversationId}/{timestamp}_{filename}` (tenant-safe). Лимит 10 МБ.
2. **Отправка**: запрос к `send-whatsapp-message` с `contentUri`, опционально `text` (caption, только в БД), `attachmentType` (image|file|audio|voice), `fileName`.
3. **Backend**: вызов Wazzup с `contentUri` (без `text` в одном запросе); сохранение в Firestore с `attachments` и caption в `text`.
4. **Голос (fallback)**: Wazzup не имеет отдельного типа "voice" в API. Реализовано: запись в браузере (MediaRecorder → audio/webm) → файл `voice.webm` → загрузка в Storage → отправка как `attachmentType: 'voice'` (в БД сохраняется как `audio`). В CRM голосовые отображаются inline-плеером (AudioMessageBubble), не как файл.

---

## Голосовые сообщения: формат и отображение

### Текущий поток

- **Запись**: MediaRecorder в браузере → `audio/webm` (или `audio/webm;codecs=opus` при поддержке).
- **Файл**: `voice.webm` загружается в Supabase, отправляется в Wazzup по `contentUri`.
- **В CRM**: все вложения с типом `audio` (в т.ч. отправленные как voice) рендерятся через **AudioMessageBubble**: play/pause, duration, progress bar, перемотка по клику; только одно аудио играет одновременно. Отдельное окно/вкладка не открывается.

### Native voice note в WhatsApp

- В WhatsApp нативное голосовое (voice note / PTT) отображается у получателя как «запись», а не как файл, если контент в формате **OGG/Opus** (MIME `audio/ogg; codecs=opus`).
- Сейчас мы отправляем **WebM** → провайдер/WhatsApp может показывать его как обычный аудиофайл или вложение.
- **Чтобы в WhatsApp приходило нативное голосовое**: нужна конвертация webm → ogg/opus (на backend или на клиенте) и отправка по `contentUri` уже в формате .ogg. В API Wazzup отдельного параметра «voice»/«ptt» нет — тип выводится из содержимого/формата.
- Входящие от Wazzup с типом `audio`, `ptt` или `voice` маппятся в `audio` и в CRM отображаются тем же inline-плеером.

---

## Ограничения в коде

- Макс. размер файла: **10 МБ** (лимит CRM/API Wazzup).
- Разрешённые MIME: image/*, audio/*, video/*, application/pdf, application/zip, и типы для .doc/.xls/.ppt и т.д.
- Все пути в Storage и запросы привязаны к `companyId` (multi-tenant).
