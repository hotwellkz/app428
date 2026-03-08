# Финальное исправление проблемы "authenticated but not ready"

## Проблема

После сканирования QR код:
- ✅ `event=authenticated` приходит
- ❌ `event=ready` НЕ приходит
- ❌ `client.info` остаётся `undefined`
- ⚠️ `requestfailed` с `net::ERR_ABORTED` на media CDN URLs
- ⚠️ Официальный `web.whatsapp.com` работает нормально

## Причина

**Основная причина:** Агрессивные флаги Chromium (`--single-process`, `--no-zygote`, и др.) + отсутствие чистого профиля Chrome + возможные блокировки запросов (AdBlock/антивирус) мешали WhatsApp Web полностью загрузиться и перейти в состояние `READY`.

## Решение

### 1. Чистый профиль Chrome (`userDataDir`)

**Что сделано:**
- Добавлен уникальный `userDataDir` в `whatsapp-server/.wa_profile`
- ENV переменная `WA_FRESH_PROFILE=1` для удаления старого профиля перед запуском
- Отключены расширения: `--disable-extensions`, `--disable-component-extensions-with-background-pages`

**Зачем:**
- Избегаем конфликтов с расширениями/кэшем из других Chrome инстансов
- Гарантируем чистую среду для WhatsApp Web

### 2. Безопасные флаги Chromium

**Удалено:**
- `--single-process` (может ломать загрузку страницы)
- `--no-zygote` (может вызывать проблемы с памятью)
- Все экспериментальные/агрессивные флаги

**Оставлено только SAFE:**
- `--no-sandbox`
- `--disable-setuid-sandbox`
- `--disable-dev-shm-usage`
- `--disable-gpu`
- `--no-first-run`
- `--no-default-browser-check`
- `--disable-extensions`
- `--disable-component-extensions-with-background-pages`

### 3. Улучшенная диагностика `requestfailed`

**Что добавлено:**
- Полное логирование: `method`, `resourceType`, `url`, `errorText`
- Проверка на `ERR_BLOCKED_BY_CLIENT` и `ERR_ABORTED`
- Определение WhatsApp доменов (`*.whatsapp.com`, `*.whatsapp.net`, `*.cdn.whatsapp.net`)
- Критическое предупреждение если WhatsApp домен заблокирован

**Логи:**
```
[WA_PAGE][requestfailed] GET media https://media-*.cdn.whatsapp.net/...
[WA_PAGE][requestfailed] errorText=net::ERR_ABORTED, isBlocked=true, isWhatsAppDomain=true
[WA_PAGE][requestfailed] ⚠️ CRITICAL: WhatsApp domain request blocked!
```

### 4. Зафиксированная webVersion

**Что сделано:**
- Используется стабильная HTML версия: `2.2412.54.html` от `wppconnect-team/wa-version`
- Логирование при создании клиента:
  ```
  [WA] createWhatsAppClient: webVersionCache config: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    source: 'wppconnect-team/wa-version (stable)',
  }
  ```

### 5. Улучшенный watchdog с дампами

**Что добавлено:**
- Timeout увеличен до 60 секунд (настраивается через `WA_READY_TIMEOUT_MS`)
- При timeout **сначала** снимаются артефакты:
  - `whatsapp-server/debug/wa_stuck_*.png` - скриншот страницы
  - `whatsapp-server/debug/wa_stuck_*.html` - HTML содержимое
  - `whatsapp-server/debug/wa_stuck_*.storage.json` - URL, readyState, title, userAgent, localStorage, sessionStorage
- **Только потом** выполняется ОДИН controlled reset (не бесконечный цикл)

### 6. ENV переключатели

**Доступные переменные:**
- `WA_HEADLESS=true|false` (default: `true`)
- `WA_DEBUG=true|false` (default: `false`)
  - При `true`: `headless=false`, `slowMo=50`, `devtools=true`
- `WA_FRESH_PROFILE=1` (default: не установлено)
  - При установке: удаляет `.wa_profile` перед запуском
- `WA_READY_TIMEOUT_MS=60000` (default: `60000` мс)

## Изменённые файлы

1. **whatsapp-server/src/server.ts** - все исправления

## Команды запуска (PowerShell)

### Обычный запуск (рекомендуется)

```powershell
cd whatsapp-server
npm run dev
```

### С чистым профилем (если проблемы остаются)

```powershell
cd whatsapp-server
$env:WA_FRESH_PROFILE="1"
npm run dev
```

### С отладкой браузера (для диагностики)

```powershell
cd whatsapp-server
$env:WA_DEBUG="true"
$env:WA_HEADLESS="false"
npm run dev
```

**Frontend:**
```powershell
cd ..
npm run dev
```

## Ожидаемые логи после исправлений

### Успешное подключение:

```
[WA] createWhatsAppClient: using profileDir: C:\...\whatsapp-server\.wa_profile
[WA] Puppeteer (createWhatsAppClient) config: { headless: true, userDataDir: '...', ... }
[WA] createWhatsAppClient: webVersionCache config: { type: 'remote', ... }
[WA] event=qr
[WA] event=loading_screen percent=100
[WA] event=authenticated
[WA] authenticated: client.info exists? false
[WA_PAGE] diagnostics attached
[WA] watchdog started: waiting for ready (60000ms timeout)
[WA] event=ready
[WA] ready: client.info exists? true
[WA] ready: client.info.wid? true
[WA] state=authenticated -> ready
[WA] watchdog stopped
```

### Если есть блокировки запросов:

```
[WA_PAGE][requestfailed] GET media https://media-*.cdn.whatsapp.net/...
[WA_PAGE][requestfailed] errorText=net::ERR_ABORTED, isBlocked=true, isWhatsAppDomain=true
[WA_PAGE][requestfailed] ⚠️ CRITICAL: WhatsApp domain request blocked!
[WA_PAGE][requestfailed] ⚠️ This may prevent READY state. Check AdBlock/antivirus web shield.
```

### Если READY не приходит (watchdog):

```
[WA] watchdog timeout triggered
[WA] watchdog: capturing stuck page diagnostics to .../debug/wa_stuck_2026-01-06T...
[WA] watchdog: storage dump saved: { url: 'https://web.whatsapp.com/', readyState: 'complete', ... }
[WA] READY timeout after authenticated, doing controlled reset (single attempt per session)
```

## Диагностика проблем

### Если `requestfailed` показывает `ERR_BLOCKED_BY_CLIENT`:

**Причина:** AdBlock или антивирусный web shield блокирует запросы WhatsApp.

**Решение:**
1. Отключите AdBlock для `*.whatsapp.com` и `*.whatsapp.net`
2. Отключите антивирусный web shield для Chrome
3. Или используйте `WA_FRESH_PROFILE=1` для чистого профиля без расширений

### Если `requestfailed` показывает `ERR_ABORTED` на media CDN:

**Причина:** Запросы к медиа CDN прерываются (может быть нормально для некоторых ресурсов).

**Важно:** Если это происходит на критических доменах (`*.whatsapp.com`, `*.whatsapp.net`), это может мешать `READY`.

**Решение:**
- Проверьте логи на наличие `ERR_BLOCKED_BY_CLIENT`
- Используйте `WA_FRESH_PROFILE=1` для чистого профиля
- Проверьте файрволл/прокси

### Если `client.info` остаётся `undefined`:

**Причина:** WhatsApp Web не может получить информацию о сессии.

**Диагностика:**
1. Проверьте логи на `[WA_PAGE][pageerror]` - ошибки JavaScript на странице
2. Проверьте логи на `[WA_PAGE][requestfailed]` - заблокированные запросы
3. Проверьте `debug/wa_stuck_*.storage.json` - что показывает `readyState` и `url`

**Решение:**
- Используйте `WA_FRESH_PROFILE=1`
- Проверьте, не блокируются ли запросы
- Попробуйте `WA_DEBUG=true` для визуальной диагностики

## Проверка готовности

### Критерии успеха:

1. ✅ После скана QR: `event=authenticated` → `event=ready` в течение 60 секунд
2. ✅ `client.info` заполнен (`wid`, `pushname`, и т.д.)
3. ✅ Фронт закрывает модалку QR и открывает чаты
4. ✅ Нет бесконечных reset циклов

### Если проблемы остаются:

1. **Проверьте логи на `[WA_PAGE][requestfailed]`:**
   - Есть ли `ERR_BLOCKED_BY_CLIENT`?
   - Какие домены блокируются?
   - Есть ли критическое предупреждение?

2. **Проверьте `debug/wa_stuck_*.storage.json`:**
   - Что показывает `url`?
   - Что показывает `readyState`?
   - Есть ли ошибки в `localStorage`?

3. **Попробуйте `WA_FRESH_PROFILE=1`:**
   ```powershell
   $env:WA_FRESH_PROFILE="1"
   npm run dev
   ```

4. **Попробуйте `WA_DEBUG=true` для визуальной диагностики:**
   ```powershell
   $env:WA_DEBUG="true"
   $env:WA_HEADLESS="false"
   npm run dev
   ```
   Откроется окно Chrome - проверьте, что происходит на странице.

## Резюме изменений

### Что было исправлено:

1. ✅ Убраны агрессивные флаги Chromium (`--single-process`, `--no-zygote`)
2. ✅ Добавлен чистый профиль Chrome (`userDataDir`)
3. ✅ Улучшена диагностика `requestfailed` с проверкой блокировок
4. ✅ Зафиксирована webVersion (`2.2412.54.html`)
5. ✅ Улучшен watchdog с дампами страницы перед reset
6. ✅ Добавлены ENV переключатели (`WA_DEBUG`, `WA_FRESH_PROFILE`)

### Что должно работать теперь:

- ✅ Стабильный переход `QR → authenticated → READY`
- ✅ `client.info` заполняется после `READY`
- ✅ Фронт закрывает модалку и открывает чаты
- ✅ Нет бесконечных reset циклов
- ✅ Подробная диагностика при проблемах

### Если READY всё ещё не приходит:

Пришлите:
1. Логи с `[WA_PAGE][requestfailed]` (особенно с `ERR_BLOCKED_BY_CLIENT`)
2. Содержимое `debug/wa_stuck_*.storage.json`
3. Логи с `[WA_PAGE][pageerror]` если есть

Это поможет точно определить причину.







