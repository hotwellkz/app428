# Отчет: Исправление проблемы с правами доступа WhatsApp на Synology

## 🔍 Диагностика

### Проблема
- **Ошибка**: `EACCES: permission denied, mkdir '/app/data/.wwebjs_auth/session-whatsapp-client-...'`
- **Симптом**: WhatsApp клиент не может создать сессию, QR-код не появляется
- **Статус**: Backend всегда возвращает "WhatsApp NOT_READY" и 503

### Корневая причина

1. **Конфликт путей сессии**:
   - В `docker-compose.synology.yml`: `WHATSAPP_SESSION_PATH=/app/data/.wwebjs_auth`
   - Volume mount: `./.wwebjs_auth:/app/.wwebjs_auth:rw`
   - Код пытался создать `/app/data/.wwebjs_auth`, но volume монтирует в `/app/.wwebjs_auth`

2. **Небезопасный destroy клиента**:
   - При ошибке инициализации код вызывал `client.destroy()` без проверки
   - Ошибка: `TypeError: Cannot read properties of null (reading 'close')`

3. **Права доступа**:
   - Папка `.wwebjs_auth` существует, но контейнер не может создавать поддиректории
   - Владелец: `adminv:users`, права: `777` (достаточно, но путь был неправильный)

## ✅ Исправления

### 1. Исправлен путь сессии в docker-compose.synology.yml

**Файл**: `whatsapp-server/docker-compose.synology.yml`

**Изменение** (строка 17):
```yaml
# Было:
- WHATSAPP_SESSION_PATH=/app/data/.wwebjs_auth

# Стало:
- WHATSAPP_SESSION_PATH=/app/.wwebjs_auth
```

**Причина**: Volume mount монтирует `.wwebjs_auth` в `/app/.wwebjs_auth`, а не в `/app/data/.wwebjs_auth`.

### 2. Исправлен путь по умолчанию в server.ts

**Файл**: `whatsapp-server/src/server.ts`

**Изменения** (2 места):

1. **`createWhatsAppClient()`** (строка ~3077):
```typescript
// Было:
: (process.env.WHATSAPP_SESSION_PATH || '/app/data/.wwebjs_auth');

// Стало:
: (process.env.WHATSAPP_SESSION_PATH || '/app/.wwebjs_auth');
```

2. **`initializeWhatsAppClient()`** (строка ~3407):
```typescript
// Было:
: (process.env.WHATSAPP_SESSION_PATH || '/app/data/.wwebjs_auth');

// Стало:
: (process.env.WHATSAPP_SESSION_PATH || '/app/.wwebjs_auth');
```

### 3. Исправлен безопасный destroy клиента

**Файл**: `whatsapp-server/src/server.ts`

**Изменение** (строка ~3577):
```typescript
// Было:
try {
    if (client) {
        console.log('🗑️  Destroying failed client instance...');
        await client.destroy();
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
} catch (destroyError) {
    console.log('⚠️  Warning: Error destroying failed client:', destroyError);
}

// Стало:
try {
    if (client && typeof client.destroy === 'function') {
        console.log('🗑️  Destroying failed client instance...');
        try {
            await client.destroy();
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (destroyErr: any) {
            // Игнорируем ошибки destroy (client может быть уже уничтожен)
            console.log('⚠️  Warning: Error destroying failed client (non-critical):', destroyErr?.message || destroyErr);
        }
    } else {
        console.log('⚠️  Warning: Client is null or destroy method unavailable, skipping destroy');
    }
} catch (destroyError: any) {
    console.log('⚠️  Warning: Error destroying failed client (non-critical):', destroyError?.message || destroyError);
}
```

## 📋 Команды для применения

### Шаг 1: Исправить права на хосте (опционально, но рекомендуется)

```bash
# На Synology:
cd /volume1/docker/whatsapp-server
sudo ./fix-permissions.sh
```

Или вручную:
```bash
sudo mkdir -p .wwebjs_auth
sudo chown -R adminv:users .wwebjs_auth
sudo chmod -R 775 .wwebjs_auth
```

### Шаг 2: Пересобрать контейнер

```bash
# На Synology:
cd /volume1/docker/whatsapp-server
sudo ./deploy.sh
```

Или вручную:
```bash
sudo /usr/local/bin/docker compose -f docker-compose.synology.yml down
sudo /usr/local/bin/docker compose -f docker-compose.synology.yml up -d --build
```

### Шаг 3: Проверить логи

```bash
sudo /usr/local/bin/docker logs whatsapp-server --tail=50 -f
```

**Ожидаемый результат**:
- ✅ Нет ошибок `EACCES: permission denied`
- ✅ Нет ошибок `Cannot read properties of null (reading 'close')`
- ✅ Появляется `[WA] event=qr` и QR-код генерируется
- ✅ `[WA] state=idle -> qr` - состояние обновлено

### Шаг 4: Проверить что сессия создается

```bash
# Проверить что директория создалась
ls -la /volume1/docker/whatsapp-server/.wwebjs_auth/

# Должна быть директория session-whatsapp-client или похожая
```

## ✅ Проверка результата

### 1. Проверить эндпоинты

```bash
# Health check (должен вернуть 200)
curl -k -i https://api.2wix.ru/health

# WhatsApp status (должен вернуть 200 с hasQr: true если QR доступен)
curl -k -i https://api.2wix.ru/api/whatsapp/status | jq .

# Ожидаемый ответ:
# {
#   "success": true,
#   "status": "qr",
#   "isReady": false,
#   "hasQr": true,
#   "qrCode": "data:image/png;base64,...",
#   "currentState": "qr",
#   "message": "QR code available, waiting for scan"
# }
```

### 2. Проверить UI

1. Открыть `https://2wix.ru/whatsapp`
2. Нажать "Подключить"
3. В модалке должен появиться QR-код в течение 1-5 секунд

### 3. Проверить логи контейнера

```bash
sudo /usr/local/bin/docker logs whatsapp-server --tail=100 | grep -E "qr|QR|EACCES|permission|destroy|state="
```

**Ожидаемый результат**:
- ✅ `[WA] event=qr` - QR сгенерирован
- ✅ `[WA] state=idle -> qr` - состояние обновлено
- ✅ `[SOCKET] replay sent QR code` - QR отправлен через Socket.IO
- ✅ Нет `EACCES: permission denied`
- ✅ Нет `Cannot read properties of null`

## 📝 Измененные файлы

1. **`whatsapp-server/docker-compose.synology.yml`**
   - Изменен `WHATSAPP_SESSION_PATH` с `/app/data/.wwebjs_auth` на `/app/.wwebjs_auth`

2. **`whatsapp-server/src/server.ts`**
   - Исправлен путь по умолчанию в `createWhatsAppClient()` (строка ~3077)
   - Исправлен путь по умолчанию в `initializeWhatsAppClient()` (строка ~3407)
   - Добавлен безопасный destroy в `initializeWhatsAppClient()` (строка ~3577)

3. **`fix-permissions.sh`** (новый)
   - Скрипт для исправления прав на хосте

## 🔍 Диагностика (если проблема сохраняется)

### Проверить volume mounts

```bash
sudo /usr/local/bin/docker inspect whatsapp-server --format '{{json .Mounts}}' | python3 -m json.tool
```

Должно быть:
```json
{
  "Type": "bind",
  "Source": "/volume1/docker/whatsapp-server/.wwebjs_auth",
  "Destination": "/app/.wwebjs_auth",
  "Mode": "rw"
}
```

### Создать тестовую директорию внутри контейнера

```bash
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'mkdir -p /app/.wwebjs_auth/test && echo ok > /app/.wwebjs_auth/test/a.txt && ls -la /app/.wwebjs_auth/test'
```

Если команда выполняется успешно, права настроены правильно.

### Проверить права на хосте

```bash
ls -la /volume1/docker/whatsapp-server/.wwebjs_auth
stat -c '%U:%G %a' /volume1/docker/whatsapp-server/.wwebjs_auth
```

Должно быть: `adminv:users 775` или `adminv:users 777`

## ⚠️ Важные замечания

- После исправления пути сессия будет создаваться в `/app/.wwebjs_auth` (volume mount)
- Старая сессия в `/app/data/.wwebjs_auth` (если была) не будет использоваться
- Для полного сброса можно удалить `.wwebjs_auth` на хосте и перезапустить контейнер:
  ```bash
  sudo rm -rf /volume1/docker/whatsapp-server/.wwebjs_auth
  sudo ./deploy.sh
  ```

## 🎯 Итоговая проверка

1. ✅ Нет ошибок `EACCES: permission denied` в логах
2. ✅ Нет ошибок `Cannot read properties of null` в логах
3. ✅ `/api/whatsapp/status` возвращает 200 (не 503)
4. ✅ QR-код появляется в UI в течение 1-5 секунд
5. ✅ Сессия создается в `/app/.wwebjs_auth` (видно в логах и на хосте)
