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
3. **Firebase / FCM**: положить `google-services.json` в `android-2wix-whatsapp/app/` (файл не коммитим)

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

