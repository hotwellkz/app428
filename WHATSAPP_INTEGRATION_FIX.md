# Исправление интеграции WhatsApp (whatsapp-web.js) + Socket.IO + Frontend

## Список изменённых файлов

1. **whatsapp-server/src/server.ts** - Backend исправления
2. **src/components/WhatsAppContent.tsx** - Frontend исправления

## Краткое описание изменений

### Backend (whatsapp-server/src/server.ts)

1. **Улучшено логирование в `safeRemoveDir`**:
   - Изменён формат логов на: `[WA] remove auth attempt N failed EBUSY -> retry in Xms`
   - Соответствует требованиям для отладки Windows EBUSY/EPERM ошибок

2. **Увеличена задержка после `destroy` в `resetFlow`**:
   - Задержка увеличена с 1500ms до 2000ms (в диапазоне 1500-2500ms)
   - Применяется как при успешном destroy, так и при ошибке
   - Также исправлена задержка в обработчике `disconnected` для обычного переподключения

3. **Улучшены логи в Socket.IO state replay**:
   - Изменён формат на: `[SOCKET] replay sent state=... hasQr=... reason=...`
   - Более компактный и читаемый формат

4. **Существующая функциональность (уже была реализована)**:
   - ✅ `waState` и `lastQr` управление состоянием
   - ✅ State replay при подключении Socket.IO клиента
   - ✅ Автоматический reset после LOGOUT/DISCONNECTED_LOGOUT
   - ✅ `safeRemoveDir` с ретраями для Windows EBUSY/EPERM/ENOTEMPTY
   - ✅ Guard `isReinitializing` для предотвращения двойной инициализации

### Frontend (src/components/WhatsAppContent.tsx)

1. **Улучшена логика закрытия модалки**:
   - Модалка закрывается ТОЛЬКО когда `whatsappStatus === 'ready'`
   - Крестик не рвёт Socket.IO соединение (нет `socket.disconnect()`)
   - Модалка автоматически возвращается через `useEffect` если статус не `ready`

2. **Существующая функциональность (уже была реализована)**:
   - ✅ Обработка `wa:state` события
   - ✅ Обработка `wa:qr` события
   - ✅ Показ QR кода при state="qr"
   - ✅ Показ "Подключаем..." при state="authenticated"
   - ✅ Закрытие модалки при state="ready"

## Команды запуска в PowerShell

### 1. Запуск Backend

```powershell
# Перейти в папку backend
cd whatsapp-server

# Установить зависимости (если нужно)
npm install

# Запустить в режиме разработки
npm run dev

# ИЛИ запустить в production режиме
npm start
```

Backend будет доступен на `http://localhost:3000` (или порт из .env)

### 2. Запуск Frontend (в отдельном терминале)

```powershell
# Вернуться в корневую папку проекта
cd ..

# Установить зависимости (если нужно)
npm install

# Запустить dev server
npm run dev
```

Frontend будет доступен на `http://localhost:5173` (или другой порт, указанный Vite)

## Ожидаемые логи при каждом сценарии

### S1: Запуск -> QR -> Scan -> Ready -> Модалка закрылась

**Backend логи:**
```
[WA] state=idle -> qr (QR available)
[WA] QR code received
[WA] QR Code generated
[SOCKET] client connected: <socket-id>
[SOCKET] replay sent state=qr hasQr=true reason=none
[SOCKET] replay sent QR code
[WA] state=qr -> authenticated
[WA] state=authenticated -> ready
[WA] WhatsApp client is ready!
```

**Frontend логи:**
```
[WA] State received: qr
[WA] QR code received, length: <length>
[WA] State received: authenticated
[WA] State received: ready
[WA] WhatsApp ready
```

**Поведение:**
- QR код показывается сразу после подключения (state replay)
- После сканирования QR показывается "Подключение..." (authenticated)
- Модалка закрывается ТОЛЬКО когда статус становится "ready"

---

### S2: Refresh при QR -> QR сразу показан

**Backend логи:**
```
[SOCKET] client connected: <socket-id>
[SOCKET] replay sent state=qr hasQr=true reason=none
[SOCKET] replay sent QR code
```

**Frontend логи:**
```
[WA] State received: qr
[WA] QR code received, length: <length>
```

**Поведение:**
- При refresh страницы фронт получает state replay с текущим состоянием
- Если был QR код, он сразу отправляется через `wa:qr` событие
- QR код показывается мгновенно без ожидания нового генерации

---

### S3: Logout на телефоне -> Reset -> Новый QR

**Backend логи:**
```
[WA] disconnected reason=LOGOUT isLogout=true
[WA] reset started reason=LOGOUT
[WA] destroy complete
[WA] Clearing WhatsApp authentication files...
[WA] remove auth attempt 1 failed EBUSY -> retry in 250ms
[WA] remove auth attempt 2 failed EBUSY -> retry in 400ms
[WA] removed dir: <path>/.wwebjs_auth (attempt 3)
[WA] removed dir: <path>/.wwebjs_cache (attempt 1)
[WA] new client instance created
[WA] re-init initialize called
[WA] state=disconnected -> qr (QR available)
[WA] QR code received
[WA] QR Code generated
[SOCKET] replay sent state=qr hasQr=true reason=none
[SOCKET] replay sent QR code
```

**Frontend логи:**
```
[WA] State received: disconnected reason=LOGOUT
[WA] WhatsApp disconnected (LOGOUT)
[WA] State received: qr
[WA] QR code received, length: <length>
```

**Поведение:**
- При logout на телефоне сервер определяет `LOGOUT` в reason
- Автоматически запускается `resetFlow`
- Удаляются папки `.wwebjs_auth` и `.wwebjs_cache` с ретраями
- Создаётся новый клиент и генерируется новый QR
- Фронт получает новый QR через state replay

---

### S4: EBUSY не валит процесс, а лечится ретраями

**Backend логи (при EBUSY ошибках):**
```
[WA] remove auth attempt 1 failed EBUSY -> retry in 250ms
[WA] remove auth attempt 2 failed EBUSY -> retry in 400ms
[WA] remove auth attempt 3 failed EBUSY -> retry in 650ms
[WA] remove auth attempt 4 failed EBUSY -> retry in 1000ms
[WA] remove auth attempt 5 failed EBUSY -> retry in 1500ms
[WA] removed dir: <path>/.wwebjs_auth (attempt 6)
```

**ИЛИ если не удалось удалить после всех попыток:**
```
[WA] remove auth attempt 12 failed EBUSY -> retry in 4000ms
[WA] failed to remove <path>/.wwebjs_auth after 12 attempts (EBUSY)
[WA] Failed to remove .wwebjs_auth folder (will continue anyway)
```

**Поведение:**
- Процесс НЕ падает при EBUSY/EPERM/ENOTEMPTY ошибках
- Выполняются ретраи с exponential/linear backoff (250ms -> 4000ms)
- Максимум 12 попыток
- Если не удалось удалить - warning лог, но процесс продолжает работу
- Новый клиент создаётся даже если папки не удалились полностью

---

## Дополнительные проверки

### Проверка Socket.IO соединения

При закрытии модалки крестиком:
- ✅ Socket.IO соединение НЕ разрывается
- ✅ Модалка может вернуться автоматически через `useEffect`
- ✅ События продолжают приходить

### Проверка state replay

При каждом новом подключении:
- ✅ Сразу отправляется `wa:state` с текущим состоянием
- ✅ Если state="qr" и есть `lastQr`, отправляется `wa:qr`
- ✅ Фронт получает актуальное состояние без задержек

### Проверка автоматического reset

При DISCONNECTED_LOGOUT:
- ✅ Guard `isReinitializing` предотвращает двойной reset
- ✅ Задержка 2000ms после `destroy` для освобождения lock
- ✅ `safeRemoveDir` с ретраями для Windows
- ✅ Новый клиент создаётся через `createWhatsAppClient()`
- ✅ События подписываются через `setupEnhancedClientEventHandlers()`

---

## Технические детали

### State Management

```typescript
type WhatsAppState = "idle" | "qr" | "authenticated" | "ready" | "disconnected";
let waState: WhatsAppState = "idle";
let lastQr: string | null = null;
let lastDisconnectReason: string | null = null;
```

### Socket.IO Events

**Backend → Frontend:**
- `wa:state` - текущее состояние WhatsApp
- `wa:qr` - QR код (только когда state="qr")

**Frontend обработка:**
- `wa:state` → обновление `whatsappStatus` и UI
- `wa:qr` → установка QR кода в state

### Retry Strategy для safeRemoveDir

- Максимум 12 попыток
- Backoff delays: [250, 400, 650, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4000, 4000] ms
- Retryable errors: EBUSY, EPERM, ENOTEMPTY, EACCES
- Non-retryable errors: остальные (процесс продолжается)

---

## Известные ограничения

1. На Windows при очень активном использовании Chrome/Puppeteer может потребоваться больше ретраев для удаления `.wwebjs_auth`
2. Если папки не удалились после 12 попыток, процесс продолжает работу, но старые данные могут остаться
3. Модалка может временно закрыться при клике на крестик, но вернётся автоматически если статус не `ready`

---

## Резюме

Все требования выполнены:
- ✅ QR всегда показывается на фронте (state replay)
- ✅ Модалка закрывается только на READY
- ✅ Автоматический reset после LOGOUT
- ✅ Windows EBUSY/EPERM обрабатываются с ретраями
- ✅ Закрытие модалки не рвёт Socket.IO соединение












