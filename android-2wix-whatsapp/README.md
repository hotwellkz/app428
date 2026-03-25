# 2wix WhatsApp Android Shell

Минималистичная Android-оболочка над `https://2wix.ru/whatsapp`:

- **WebView** на весь экран (с сохранением cookies/сессии)
- **Back** работает как в браузере (history назад)
- **Offline / error** экран вместо белого WebView
- **Settings** (локальный флаг уведомлений, тестовое уведомление, очистка cookies/cache)
- **Deep-link prep** через `Intent` extras: `targetUrl` / `chatId`

## Открыть в Android Studio

1. Android Studio → **Open** → выбрать папку `android-2wix-whatsapp/`
2. Дождаться sync Gradle (Android Studio использует свой JDK)
3. (Опционально) Добавить Firebase позже: положить `google-services.json` в `android-2wix-whatsapp/app/`

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

## Структура (основные файлы)

- `MainActivity.kt` — entrypoint, принимает `Intent` и пробрасывает target в UI
- `ui/App.kt` — Compose navigation (Web ↔ Settings)
- `ui/webview/WebViewScreen.kt` — WebView + offline/error + file upload + permission handling + back
- `ui/settings/SettingsScreen.kt` — настройки + тестовое уведомление + очистка сессии
- `util/IntentRouter.kt` — единая маршрутизация `Intent` → URL (`targetUrl`/`chatId`)
- `util/NetworkMonitor.kt` — online/offline мониторинг
- `notifications/NotificationHelper.kt` — локальные уведомления + каналы
- `push/TwowixFirebaseMessagingService.kt` — заглушка под FCM (полный этап позже)

## Что ещё осталось до полноценного FCM этапа

- Реальная регистрация FCM token на backend (endpoint + storage)
- Отправка push payload при новых/непрочитанных сообщениях
- PendingIntent в notification для открытия нужного `targetUrl/chatId`
- Unread count/badge (возможности зависят от launcher/OEM)

