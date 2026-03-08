# Исправление проблемы с правами доступа WhatsApp на Synology

## 🔍 Диагностика проблемы

**Симптомы**:
- `EACCES: permission denied, mkdir '/app/data/.wwebjs_auth/session-whatsapp-client-...'`
- WhatsApp клиент не может создать сессию
- QR-код не появляется

**Корневая причина**:
1. Конфликт путей: код пытался использовать `/app/data/.wwebjs_auth`, но volume mount указывает на `/app/.wwebjs_auth`
2. Небезопасный destroy клиента при ошибках инициализации

## ✅ Исправления

### 1. Исправлен путь сессии в docker-compose.synology.yml

**Изменение**:
```yaml
# Было:
- WHATSAPP_SESSION_PATH=/app/data/.wwebjs_auth

# Стало:
- WHATSAPP_SESSION_PATH=/app/.wwebjs_auth
```

**Причина**: Volume mount монтирует `.wwebjs_auth` в `/app/.wwebjs_auth`, а не в `/app/data/.wwebjs_auth`.

### 2. Исправлен путь по умолчанию в server.ts

**Изменения** (2 места):
- `createWhatsAppClient()`: изменен fallback путь с `/app/data/.wwebjs_auth` на `/app/.wwebjs_auth`
- `initializeWhatsAppClient()`: изменен fallback путь с `/app/data/.wwebjs_auth` на `/app/.wwebjs_auth`

### 3. Исправлен безопасный destroy клиента

**Проблема**: При ошибке инициализации код пытался вызвать `client.destroy()`, но client мог быть `null` или уже уничтожен, что вызывало ошибку:
```
TypeError: Cannot read properties of null (reading 'close')
```

**Исправление**: Добавлена проверка на существование client и метода destroy:
```typescript
if (client && typeof client.destroy === 'function') {
    try {
        await client.destroy();
    } catch (destroyErr: any) {
        // Игнорируем ошибки destroy (non-critical)
        console.log('⚠️  Warning: Error destroying failed client (non-critical):', destroyErr?.message || destroyErr);
    }
} else {
    console.log('⚠️  Warning: Client is null or destroy method unavailable, skipping destroy');
}
```

## 📋 Команды для применения на Synology

### Шаг 1: Исправить права на хосте (если нужно)

```bash
# Подключиться к Synology
ssh admin@192.168.100.222

# Перейти в директорию проекта
cd /volume1/docker/whatsapp-server

# Создать директорию если не существует
sudo mkdir -p .wwebjs_auth

# Выдать права (adminv:users - владелец, 777 - полные права)
sudo chown -R adminv:users .wwebjs_auth
sudo chmod -R 775 .wwebjs_auth

# Проверить права
ls -la .wwebjs_auth
```

### Шаг 2: Загрузить обновленные файлы

```bash
# На Windows (PowerShell):
Get-Content whatsapp-server/docker-compose.synology.yml | ssh shortsai "cat > /volume1/docker/whatsapp-server/docker-compose.synology.yml"
Get-Content whatsapp-server/src/server.ts | ssh shortsai "cat > /volume1/docker/whatsapp-server/src/server.ts"
```

### Шаг 3: Пересобрать и перезапустить контейнер

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

### Шаг 4: Проверить логи

```bash
sudo /usr/local/bin/docker logs whatsapp-server --tail=50 -f
```

**Ожидаемый результат**:
- Нет ошибок `EACCES: permission denied`
- Нет ошибок `Cannot read properties of null (reading 'close')`
- Появляется `[WA] event=qr` и QR-код генерируется

### Шаг 5: Проверить что сессия создается

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
curl -k -i https://api.2wix.ru/api/whatsapp/status

# Должен вернуть JSON вида:
# {
#   "success": true,
#   "status": "qr",
#   "hasQr": true,
#   "qrCode": "data:image/png;base64,...",
#   ...
# }
```

### 2. Проверить UI

- Открыть `https://2wix.ru/whatsapp`
- Нажать "Подключить"
- В модалке должен появиться QR-код в течение 1-5 секунд

### 3. Проверить логи контейнера

```bash
sudo /usr/local/bin/docker logs whatsapp-server --tail=100 | grep -E "qr|QR|EACCES|permission|destroy"
```

**Ожидаемый результат**:
- ✅ `[WA] event=qr` - QR сгенерирован
- ✅ `[WA] state=idle -> qr` - состояние обновлено
- ✅ Нет `EACCES: permission denied`
- ✅ Нет `Cannot read properties of null`

## 📝 Измененные файлы

1. **`whatsapp-server/docker-compose.synology.yml`**
   - Изменен `WHATSAPP_SESSION_PATH` с `/app/data/.wwebjs_auth` на `/app/.wwebjs_auth`

2. **`whatsapp-server/src/server.ts`**
   - Исправлен путь по умолчанию в `createWhatsAppClient()` (строка ~3077)
   - Исправлен путь по умолчанию в `initializeWhatsAppClient()` (строка ~3407)
   - Добавлен безопасный destroy в `initializeWhatsAppClient()` (строка ~3577)

## 🔍 Диагностика (если проблема сохраняется)

### Проверить UID/GID контейнера

```bash
# На Synology (требует sudo):
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'id && whoami'
```

### Проверить права на хосте

```bash
# На Synology:
ls -la /volume1/docker/whatsapp-server/.wwebjs_auth
stat -c '%U:%G %a' /volume1/docker/whatsapp-server/.wwebjs_auth
```

### Проверить volume mounts

```bash
sudo /usr/local/bin/docker inspect whatsapp-server --format '{{json .Mounts}}' | python3 -m json.tool
```

### Создать тестовую директорию внутри контейнера

```bash
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'mkdir -p /app/.wwebjs_auth/test && echo ok > /app/.wwebjs_auth/test/a.txt && ls -la /app/.wwebjs_auth/test'
```

Если команда выполняется успешно, права настроены правильно.

## ⚠️ Важные замечания

- После исправления пути сессия будет создаваться в `/app/.wwebjs_auth` (volume mount)
- Старая сессия в `/app/data/.wwebjs_auth` (если была) не будет использоваться
- Для полного сброса можно удалить `.wwebjs_auth` на хосте и перезапустить контейнер
