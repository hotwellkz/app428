# 2wix WhatsApp Android Shell

Минималистичная Android-оболочка над `https://2wix.ru/whatsapp`:

- **WebView** на весь экран (с сохранением cookies/сессии)
- **Back** работает как в браузере (history назад)
- **Offline / error** экран вместо белого WebView
- **Settings** (локальный флаг уведомлений, тестовое уведомление, очистка cookies/cache)
- **Deep-link prep** через `Intent` extras: `targetUrl` / `chatId`

## Firebase / FCM (обязательно для токена и push)

- **applicationId / package name приложения**: `ru.twowix.whatsapp_shell` (совпадает с `namespace` в `app/build.gradle.kts`).
- **Куда положить конфиг**: скачанный из Firebase Console файл **`google-services.json`** →  
  **`android-2wix-whatsapp/app/google-services.json`** (рядом с `app/build.gradle.kts`).
- В репозитории **нет** placeholder-файла: без реального `google-services.json` Gradle **не соберёт** проект (явная ошибка с путём).
- Файл в **`.gitignore`** — не коммитьте ключи в публичный репозиторий.

Шаги в Firebase Console: Project settings → Your apps → Add app → Android → укажите package name `ru.twowix.whatsapp_shell` → Download `google-services.json`.

## Открыть в Android Studio

1. Android Studio → **Open** → выбрать папку `android-2wix-whatsapp/`
2. Положите **`app/google-services.json`** (см. раздел выше), иначе sync Gradle завершится ошибкой
3. Дождаться sync Gradle (Android Studio использует свой JDK)

## Сборка debug APK

В Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Или через терминал (если установлен JDK):

```bash
cd android-2wix-whatsapp
./gradlew :app:assembleDebug
```

APK будет в `app/build/outputs/apk/debug/`.

## Как проверить deep-link/open-chat через Intent

### Открыть конкретный URL

```bash
adb shell am start -n ru.twowix.whatsapp_shell/.MainActivity --es targetUrl "https://2wix.ru/whatsapp"
```

### Открыть чат по chatId (пока используется формула URL)

```bash
adb shell am start -n ru.twowix.whatsapp_shell/.MainActivity --es chatId "123"
```

Логика сборки URL для чата находится в `IntentRouter.buildChatUrl()` — её легко поменять, когда появится точный deep-link.

## Как протестировать FCM (data payload)

1. Запусти приложение на устройстве, открой **Настройки** (иконка шестерёнки) и посмотри **FCM token**.  
   Если токен пустой — нажми **«Обновить token»**.
2. В тех же настройках:
   - укажи **API base URL** (обычно `https://2wix.ru`)
   - укажи **managerId** (в текущей реализации это `companyId`, например `hotwell`)
   - после получения нового токена приложение вызовет `POST /api/mobile/register-device`
2. Firebase Console → Cloud Messaging → отправь сообщение:
   - **важно**: используем **data payload** (основной сценарий)
3. Пример data payload:

```json
{
  "type": "message",
  "chatId": "123",
  "clientName": "Иван",
  "phone": "+77001234567",
  "preview": "Привет! Это тест.",
  "unreadCount": "3",
  "targetUrl": "https://2wix.ru/whatsapp?chatId=123",
  "messageId": "m_456"
}
```

Поведение:
- уведомление показывается **всегда** (foreground/background), если **включены уведомления** и есть permission
- tap по уведомлению открывает `MainActivity` с `targetUrl` (если есть) или `chatId`

## Netlify Functions (backend слой для push)

Эндпоинты (через redirects в `netlify.toml`):

- `POST /api/mobile/register-device` → `/.netlify/functions/mobile-register-device`
- `POST /api/mobile/unregister-device` → `/.netlify/functions/mobile-unregister-device`
- `POST /api/send-chat-push` → `/.netlify/functions/send-chat-push`

### Env vars (Netlify)

Firebase Admin поддерживает 2 варианта (любой один):

- **Вариант A (рекомендуется в Netlify UI)**:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (строка с `\n`, будет преобразована)

- **Вариант B (одной строкой)**:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - или кусками `FIREBASE_SA_1..5` (если упираетесь в лимит 4KB)

### Быстрый ручной тест send-chat-push

```bash
curl -X POST "https://2wix.ru/api/send-chat-push" \\
  -H "Content-Type: application/json" \\
  -d '{
    "managerId":"hotwell",
    "chatId":"<conversationId>",
    "clientName":"Иван",
    "phone":"+77001234567",
    "preview":"Тест push",
    "unreadCount": 1,
    "messageId":"m_test_1",
    "type":"message"
  }'
```

## Структура (основные файлы)

- `MainActivity.kt` — entrypoint, принимает `Intent` и пробрасывает target в UI
- `ui/App.kt` — Compose navigation (Web ↔ Settings)
- `ui/webview/WebViewScreen.kt` — WebView + offline/error + file upload + permission handling + back
- `ui/settings/SettingsScreen.kt` — настройки + тестовое уведомление + очистка сессии
- `util/IntentRouter.kt` — единая маршрутизация `Intent` → URL (`targetUrl`/`chatId`)
- `util/NetworkMonitor.kt` — online/offline мониторинг
- `notifications/NotificationHelper.kt` — локальные уведомления + каналы
- `push/TwowixFirebaseMessagingService.kt` — FCM client: token + приём data payload + уведомление + deep-link extras
- `push/PushPayload.kt` — парсер/контракт payload
- `data/DeviceRegistrationClient.kt` — заготовка регистрации токена на backend (graceful fallback)

## Что ещё осталось до полноценного FCM этапа

- Backend endpoint’ы и триггеры “новое/непрочитанное” (когда и кому слать push)
- Стабильная схема deep-link URL для конкретного чата (если `?chatId=` не подходит)
- Unread count/badge (возможности зависят от launcher/OEM)

