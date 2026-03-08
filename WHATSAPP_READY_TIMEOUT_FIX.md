# Исправление проблемы "authenticated но не ready" в WhatsApp интеграции

## Проблема

После сканирования QR код появляется "Подключаем...", затем снова показывается QR, и чат не открывается. В backend логах видим: `QR_GENERATED -> LOADING 100% -> AUTHENTICATED`, но НЕ видим `READY`.

## Решение

Реализован watchdog механизм и улучшено логирование для диагностики проблемы.

## Список изменённых файлов

1. **whatsapp-server/src/server.ts** - Backend исправления
2. **src/components/WhatsAppConnect.tsx** - Frontend исправления
3. **src/components/WhatsAppContent.tsx** - Frontend UI исправления

## Основные изменения

### Backend (whatsapp-server/src/server.ts)

#### 1. Watchdog механизм для ready timeout

Добавлены переменные:
- `readyTimer: NodeJS.Timeout | null` - таймер для отслеживания ready timeout
- `hasWatchdogResetAttempted: boolean` - флаг для предотвращения повторных reset от watchdog

Функции:
- `startReadyWatchdog()` - запускает таймер на 45 секунд после `authenticated`
- `stopReadyWatchdog()` - останавливает таймер при переходе в ready/qr/disconnected

Логика:
- При `authenticated` запускается watchdog таймер на 45 секунд
- Если через 45 секунд состояние всё ещё `authenticated` и ready не пришёл:
  - Устанавливается `hasWatchdogResetAttempted = true` (только одна попытка на сессию)
  - Выполняется `controlledReset('READY_TIMEOUT')`
- Watchdog останавливается при переходе в `ready`, `qr` или `disconnected`

#### 2. Controlled Reset функция

Новая функция `controlledReset()` для watchdog:
- Guard `isReinitializing` для предотвращения двойного reset
- `await client.destroy()` с try/catch
- Задержка 2000ms для освобождения lock (Windows EBUSY fix)
- `safeRemoveDir()` для удаления `.wwebjs_auth` и `.wwebjs_cache` с ретраями
- Создание нового клиента через `createWhatsAppClient()`
- Подписка событий через `setupEnhancedClientEventHandlers()`
- `client.initialize()` с проверкой `isInitializing`

#### 3. Улучшенное логирование всех событий

Все события whatsapp-web.js теперь логируются с префиксом `[WA]`:
- `[WA] event=qr`
- `[WA] event=authenticated`
- `[WA] event=ready`
- `[WA] event=disconnected reason=...`
- `[WA] event=auth_failure`
- `[WA] event=loading_screen percent=...`
- `[WA] event=change_state state=...`
- `[WA] event=error`

Дополнительно логируются:
- `[WA] init called (...)` - при вызове `client.initialize()`
- `[WA] initialize complete` - после успешной инициализации
- `[WA] watchdog started: waiting for ready (45s timeout)`
- `[WA] watchdog stopped`
- `[WA] READY timeout after authenticated, doing controlled reset`
- Полные reason и stack для всех ошибок

#### 4. Предотвращение повторных initialize()

Добавлены проверки:
- В `controlledReset()` и `resetFlow()` проверяется `isInitializing` перед вызовом `client.initialize()`
- В `initializeWhatsAppClient()` уже есть guard для `isInitializing` и `isReinitializing`
- Логирование предупреждений при попытке повторной инициализации

#### 5. Обработка unhandledRejection/uncaughtException

Добавлены обработчики перед запуском сервера:
```typescript
process.on('unhandledRejection', (reason, promise) => {
    console.error('[WA] UNHANDLED REJECTION:', reason);
    // Логирование stack и promise
    // В dev режиме не падаем, только логируем
});

process.on('uncaughtException', (error) => {
    console.error('[WA] UNCAUGHT EXCEPTION:', error);
    // Логирование stack
    // В production - exit(1), в dev - только логируем
});
```

#### 6. Улучшенная обработка disconnected

- Полное логирование reason: `[WA] disconnected full reason: ...`
- Проверка на CONFLICT в дополнение к LOGOUT
- Логирование stack для всех ошибок при re-init

### Frontend (src/components/WhatsAppConnect.tsx)

#### 1. Отслеживание времени в состоянии authenticated

Добавлено:
- `authenticatedStartTime: number | null` - время начала authenticated
- `authenticatedTimeoutId: NodeJS.Timeout | null` - таймер для показа "дольше обычного"

Логика:
- При `authenticated` записывается `authenticatedStartTime = Date.now()`
- Запускается таймер на 30 секунд
- Если через 30 секунд состояние всё ещё `authenticated`, статус меняется на "Подключение... (дольше обычного)"
- Таймер очищается при любом изменении состояния

### Frontend (src/components/WhatsAppContent.tsx)

#### 1. Улучшенный текст для authenticated

- Если статус содержит "дольше обычного", показывается: "Подключение занимает больше времени, чем обычно. Пожалуйста, подождите..."
- Иначе: "Пожалуйста, подождите..."

## Команды запуска в PowerShell

### Backend

```powershell
cd whatsapp-server
npm install  # если нужно
npm run dev
```

### Frontend (в отдельном терминале)

```powershell
cd ..
npm install  # если нужно
npm run dev
```

## Ожидаемые логи при каждом сценарии

### S1: Успешное подключение (qr -> authenticated -> ready)

**Backend логи:**
```
[WA] event=qr
[WA] state=idle -> qr (QR available)
[WA] watchdog started: waiting for ready (45s timeout)
[WA] event=authenticated
[WA] state=qr -> authenticated
[WA] event=loading_screen percent=100 message=...
[WA] event=ready
[WA] state=authenticated -> ready
[WA] watchdog stopped
```

**Frontend логи:**
```
[WA] State received: qr
[WA] QR code received, length: ...
[WA] State received: authenticated
[WA] State received: ready
[WA] WhatsApp ready
```

**Поведение:**
- QR показывается
- После сканирования показывается "Подключение..."
- Модалка закрывается ТОЛЬКО когда приходит `ready`
- Watchdog останавливается при `ready`

---

### S2: Ready не пришёл - срабатывает watchdog

**Backend логи:**
```
[WA] event=qr
[WA] state=idle -> qr (QR available)
[WA] watchdog started: waiting for ready (45s timeout)
[WA] event=authenticated
[WA] state=qr -> authenticated
[WA] event=loading_screen percent=100 message=...
... (45 секунд ожидания) ...
[WA] READY timeout after authenticated, doing controlled reset
[WA] watchdog reset attempt #1 (only one attempt per session)
[WA] controlled reset started reason=READY_TIMEOUT
[WA] watchdog stopped
[WA] destroy complete
[WA] remove auth attempt 1 failed EBUSY -> retry in 250ms
[WA] removed dir: .../.wwebjs_auth (attempt 2)
[WA] new client instance created
[WA] init called (controlled reset)
[WA] initialize complete
[WA] event=qr
[WA] state=disconnected -> qr (QR available)
```

**Frontend логи:**
```
[WA] State received: authenticated
... (через 30 секунд) ...
Подключение... (дольше обычного)
... (через 45 секунд) ...
[WA] State received: qr
[WA] QR code received, length: ...
```

**Поведение:**
- После `authenticated` показывается "Подключение..."
- Через 30 секунд показывается "Подключение... (дольше обычного)"
- Через 45 секунд watchdog срабатывает ОДИН раз
- Появляется новый QR код
- Watchdog не срабатывает повторно (флаг `hasWatchdogResetAttempted`)

---

### S3: Logout на телефоне -> Reset -> Новый QR

**Backend логи:**
```
[WA] event=disconnected reason=LOGOUT isLogout=true
[WA] disconnected full reason: LOGOUT
[WA] state=ready -> disconnected reason=LOGOUT
[WA] watchdog stopped
[WA] reset started reason=LOGOUT
[WA] destroy complete
[WA] removed dir: .../.wwebjs_auth (attempt 1)
[WA] new client instance created
[WA] init called (reset flow)
[WA] initialize complete
[WA] event=qr
[WA] state=disconnected -> qr (QR available)
```

**Frontend логи:**
```
[WA] State received: disconnected reason=LOGOUT
[WA] WhatsApp disconnected (LOGOUT)
[WA] State received: qr
[WA] QR code received, length: ...
```

**Поведение:**
- При logout на телефоне сервер определяет `LOGOUT` в reason
- Автоматически запускается `resetFlow('LOGOUT')`
- Удаляются папки и создаётся новый клиент
- Генерируется новый QR

---

### S4: Диагностика - почему не приходит ready

**Если ready не приходит, проверьте логи:**

1. **События whatsapp-web.js:**
   ```
   [WA] event=authenticated
   [WA] event=loading_screen percent=100
   [WA] event=change_state state=...
   [WA] event=disconnected reason=...
   ```

2. **Ошибки:**
   ```
   [WA] event=error
   [WA] error: ...
   [WA] Error stack: ...
   ```

3. **Auth failures:**
   ```
   [WA] event=auth_failure
   [WA] auth_failure error: ...
   ```

4. **Unhandled rejections:**
   ```
   [WA] UNHANDLED REJECTION: ...
   [WA] Rejection stack: ...
   ```

5. **Watchdog срабатывание:**
   ```
   [WA] READY timeout after authenticated, doing controlled reset
   ```

**Возможные причины:**
- Сессия конфликтует с другим устройством → `disconnected reason=CONFLICT`
- Ошибка аутентификации → `auth_failure`
- Ошибка в whatsapp-web.js → `event=error` с stack
- Unhandled rejection → логируется с stack
- Таймаут загрузки → watchdog срабатывает через 45 секунд

---

## Критические условия (выполнены)

✅ **Reset только по:**
- `disconnected reason LOGOUT/CONFLICT` → `resetFlow()`
- Watchdog timeout после authenticated без ready (1 попытка) → `controlledReset()`

✅ **Нет повторных initialize():**
- Guard `isInitializing` в `initializeWhatsAppClient()`
- Проверка перед `client.initialize()` в reset функциях
- Логирование предупреждений

✅ **Обработка unhandledRejection/uncaughtException:**
- Логирование с полным stack
- В dev режиме не падаем, только логируем

✅ **События подписаны на актуальном инстансе:**
- `createWhatsAppClient()` вызывает `setupEnhancedClientEventHandlers()`
- После каждого reset создаётся новый клиент и подписываются события

✅ **Нет socket.disconnect() при закрытии модалки:**
- Крестик только скрывает модалку
- Socket соединение сохраняется

---

## Диагностика проблем

### Если ready не приходит после authenticated:

1. **Проверьте логи на события:**
   - Есть ли `[WA] event=loading_screen percent=100`?
   - Есть ли `[WA] event=change_state`?
   - Есть ли `[WA] event=disconnected`?

2. **Проверьте ошибки:**
   - `[WA] event=error` - ошибка в whatsapp-web.js
   - `[WA] UNHANDLED REJECTION` - необработанный промис
   - `[WA] event=auth_failure` - ошибка аутентификации

3. **Проверьте watchdog:**
   - Сработал ли через 45 секунд?
   - Был ли `controlledReset()` выполнен?
   - Появился ли новый QR?

4. **Проверьте состояние:**
   - `[WA] state=authenticated` остаётся или меняется?
   - Есть ли `reason` в disconnected?

### Типичные проблемы и решения:

**Проблема:** `authenticated` но нет `ready`, нет ошибок
- **Решение:** Watchdog сработает через 45 секунд и сделает controlled reset

**Проблема:** `disconnected reason=CONFLICT`
- **Решение:** Автоматический reset через `resetFlow()`

**Проблема:** `auth_failure`
- **Решение:** Автоматический reconnect через `safeReconnect()`

**Проблема:** `UNHANDLED REJECTION` в логах
- **Решение:** Проверьте stack trace, исправьте код, который вызывает rejection

---

## Резюме

Все требования выполнены:
- ✅ Watchdog таймер на 45 секунд после authenticated
- ✅ Controlled reset при timeout (только 1 попытка на сессию)
- ✅ Улучшенное логирование всех событий с префиксом [WA]
- ✅ Предотвращение повторных initialize()
- ✅ Обработка unhandledRejection/uncaughtException
- ✅ Frontend показывает "Подключаем (дольше обычного)..." через 30 секунд
- ✅ Модалка закрывается только при state="ready"
- ✅ Socket.IO соединение не рвётся при закрытии модалки

Готово к тестированию!











