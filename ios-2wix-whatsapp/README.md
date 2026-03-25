# 2wix WhatsApp — iOS shell

Нативная оболочка (SwiftUI + `WKWebView`) над `https://2wix.ru/whatsapp`: те же Netlify-эндпоинты, что и у Android (`register-device`, `unregister-device`, `send-chat-push`), FCM + APNs, экран настроек/диагностики.

## Архитектура (кратко)

| Слой | Назначение |
|------|------------|
| `TwowixWhatsAppApp` | Точка входа, связывает `AppDelegate` с `Preferences` и `AppRouter`. |
| `AppDelegate` | Firebase (`FirebaseApp.configure`), FCM (`MessagingDelegate`), APNs device token, `UNUserNotificationCenterDelegate`, запрос разрешения на уведомления. |
| `ContentView` + `WebView` | `WKWebView` в контроллере с привязкой к **safe area** (не уезжает под notch / home indicator). Внешние ссылки (не `*.2wix.ru`) открываются в Safari. |
| `IntentRouter` / `PushPayload` | Та же логика, что на Android: `targetUrl` или `chatId` → URL чата. |
| `DeviceRegistrationClient` | `POST` с fallback `/.netlify/functions/...` при 404 на `/api/...`. `platform: ios`. |
| `SettingsView` | API base URL, `managerId`, стартовый URL, диагностика push, тесты, очистка cookies/cache. |

## Файлы и папки

```
ios-2wix-whatsapp/
  project.yml              # XcodeGen: схема проекта + SPM Firebase
  README.md
  .gitignore
  TwowixWhatsApp.xcodeproj # генерируется: xcodegen generate
  TwowixWhatsApp/
    TwowixWhatsAppApp.swift
    AppDelegate.swift
    ContentView.swift
    WebView.swift
    SettingsView.swift
    Preferences.swift
    AppRouter.swift
    DeviceRegistrationClient.swift
    IntentRouter.swift
    PushPayload.swift
    AppConfig.swift
    Info.plist
    TwowixWhatsApp.entitlements
    Assets.xcassets/
    GoogleService-Info.plist.example
```

`GoogleService-Info.plist` в репозиторий не кладём (секреты); копируете из Firebase Console (см. ниже).

## Как открыть и собрать

1. **Установите [Xcode](https://developer.apple.com/xcode/)** (полная IDE, не только Command Line Tools).

2. **XcodeGen** (опционально, для пересборки `.xcodeproj` из `project.yml`):

   ```bash
   brew install xcodegen
   cd ios-2wix-whatsapp
   xcodegen generate
   ```

3. **Firebase iOS**

   - В [Firebase Console](https://console.firebase.google.com/) добавьте iOS-приложение с **Bundle ID** `ru.twowix.whatsapp_shell` (или свой, тогда поменяйте в `project.yml` и в Signing).
   - Скачайте `GoogleService-Info.plist` и положите в `TwowixWhatsApp/` (рядом с `Info.plist`).
   - Убедитесь, что файл добавлен в target **TwowixWhatsApp** (в Xcode: Target → Build Phases → Copy Bundle Resources).

4. **Откройте проект**

   ```bash
   open ios-2wix-whatsapp/TwowixWhatsApp.xcodeproj
   ```

5. **Signing & Capabilities**

   - Выберите Team в **Signing & Capabilities**.
   - Включите **Push Notifications** (Xcode добавит capability; `TwowixWhatsApp.entitlements` уже содержит `aps-environment`: для TestFlight/прода смените на `production` или оставьте `development` для отладки).
   - **Background Modes** → *Remote notifications* уже заданы в `Info.plist` (`UIBackgroundModes`).

6. **APNs**

   - В Apple Developer: ключ APNs или сертификаты, загрузка в Firebase → Project settings → Cloud Messaging → Apple app configuration.

7. **Сборка на устройство**

   - Подключите iPhone, выберите схему **TwowixWhatsApp**, Run (⌘R).

## Где подставить значения

| Что | Где |
|-----|-----|
| `GoogleService-Info.plist` | `TwowixWhatsApp/GoogleService-Info.plist` (из Firebase). Шаблон: `GoogleService-Info.plist.example`. |
| Bundle Identifier | По умолчанию `ru.twowix.whatsapp_shell` — `project.yml` → `PRODUCT_BUNDLE_IDENTIFIER`, должен совпадать с Firebase и App ID. |
| Team / Signing | Xcode → Target → Signing & Capabilities. |
| API base URL | В приложении: Настройки (по умолчанию `https://2wix.ru`). |
| `managerId` | Настройки; без него `register-device` не вызывается. |

## Что уже сделано в коде

- Shell с `https://2wix.ru/whatsapp`, safe area, навигация «назад», внешние ссылки в Safari.
- FCM token, регистрация на backend с `platform: ios`, fallback URL как на Android.
- Push: показ баннера, тап → открытие URL чата.
- Настройки: тесты, unregister, очистка WebKit data.

## Что требует учётных данных Apple / Firebase

- Установка на физический iPhone: **Apple Developer Program** (платный аккаунт) или личная команда с ограничениями.
- Доставка push на устройство: **APNs** + корректный **GoogleService-Info.plist** и Firebase Cloud Messaging для этого iOS-приложения.
- **TestFlight / App Store**: профиль распространения, иконка 1024×1024 в `Assets.xcassets` (сейчас заглушка — добавьте реальную иконку).

## Можно ли установить на iPhone «прямо сейчас»

- **В этой среде** полная сборка `xcodebuild` недоступна (нет полного Xcode). На вашем Mac после шагов выше сборка должна проходить.
- Без **вашего** `GoogleService-Info.plist`, **Team** и **APNs в Firebase** push на реальное устройство **не заработает** — приложение как WebView-оболочка при этом может открывать сайт.

## Backend (репозиторий)

Функции Netlify принимают `platform: android | ios`; рассылка `send-chat-push` идёт на активные токены обеих платформ. После деплоя убедитесь, что маршруты `/api/mobile/*` проксируются (как у Android).
