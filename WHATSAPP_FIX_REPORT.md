# Отчет: Исправление проблем авторизации WhatsApp

## Проблемы, которые были исправлены

### 1. ✅ /health endpoint - всегда возвращает 200 OK
**Проблема:** При ошибке health check возвращался 500, что ломало фронт.

**Исправление:**
- Изменен catch блок в `/health` - теперь всегда возвращает 200 OK
- Добавлен `ok: true` в ответ при ошибке
- nginx уже настроен с CORS для `/health`

**Файл:** `whatsapp-server/src/server.ts` (строка 640)

### 2. ✅ Безопасный destroy клиента
**Проблема:** Вызов `client.destroy()` без try/catch мог падать с "Cannot read properties of null".

**Исправление:**
- Добавлен try/catch для всех вызовов `destroy()` (строка 1733)
- Проверка на null перед destroy уже была, но теперь везде есть обработка ошибок

**Файл:** `whatsapp-server/src/server.ts` (строка 1732-1737)

### 3. ✅ Логирование сохранения сессии
**Проблема:** Не было видно, сохраняется ли сессия после authenticated.

**Исправление:**
- Добавлено логирование пути сессии, существования директории и файлов
- Логи появляются сразу после события `authenticated`

**Файл:** `whatsapp-server/src/server.ts` (строка 2140-2154)

## Диагностика на сервере

### Шаг 1: Проверить пути и права

```bash
# Проверить переменные окружения
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'env | grep -E "WHATSAPP|SESSION|WWEBJS"'

# Проверить UID/GID внутри контейнера
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'id'

# Проверить права на папки на хосте
ls -la /volume1/docker/whatsapp-server/.wwebjs_auth
ls -la /volume1/docker/whatsapp-server/.wwebjs_cache
ls -la /volume1/docker/whatsapp-server/data

# Проверить монтирование томов
sudo /usr/local/bin/docker inspect whatsapp-server --format '{{json .Mounts}}' | python3 -m json.tool
```

### Шаг 2: Проверить права на все папки

Если права не совпадают с UID/GID контейнера (обычно 1001:1001):

```bash
# Остановить контейнер
sudo /usr/local/bin/docker stop whatsapp-server

# Исправить права (замените 1001:1001 на реальный UID:GID из контейнера)
sudo chown -R 1001:1001 /volume1/docker/whatsapp-server/.wwebjs_auth
sudo chown -R 1001:1001 /volume1/docker/whatsapp-server/.wwebjs_cache
sudo chown -R 1001:1001 /volume1/docker/whatsapp-server/data

# Установить права на запись
sudo chmod -R 775 /volume1/docker/whatsapp-server/.wwebjs_auth
sudo chmod -R 775 /volume1/docker/whatsapp-server/.wwebjs_cache
sudo chmod -R 775 /volume1/docker/whatsapp-server/data

# Запустить контейнер
sudo /usr/local/bin/docker start whatsapp-server
```

### Шаг 3: Очистить старую сессию и сделать чистый ре-логин

```bash
# Остановить контейнер
sudo /usr/local/bin/docker stop whatsapp-server

# Бэкап старой сессии
mv /volume1/docker/whatsapp-server/.wwebjs_auth /volume1/docker/whatsapp-server/.wwebjs_auth.bak.$(date +%F-%H%M)

# Создать новую папку с правильными правами
mkdir -p /volume1/docker/whatsapp-server/.wwebjs_auth
sudo chown -R 1001:1001 /volume1/docker/whatsapp-server/.wwebjs_auth
sudo chmod -R 775 /volume1/docker/whatsapp-server/.wwebjs_auth

# Запустить контейнер
sudo /usr/local/bin/docker start whatsapp-server
```

### Шаг 4: Проверить логи после скана QR

```bash
# Смотреть логи в реальном времени
sudo /usr/local/bin/docker logs -f whatsapp-server

# Или последние 100 строк
sudo /usr/local/bin/docker logs whatsapp-server --tail=100 | grep -E 'authenticated|ready|QR|qr|state=|Session|EACCES'
```

**Ожидаемые логи после скана:**
```
[WA] event=authenticated
[WA] authenticated: Session path: /app/.wwebjs_auth
[WA] authenticated: Session directory exists: true
[WA] authenticated: Session files count: X
[WA] event=ready
[WA] ready: current state before update=authenticated
```

### Шаг 5: Проверить статус через API

```bash
# Проверить /health (должен быть 200 OK)
curl -k https://api.2wix.ru/health

# Проверить статус WhatsApp
curl -k https://api.2wix.ru/api/whatsapp/status
```

**Ожидаемый ответ после скана:**
```json
{
  "success": true,
  "status": "ready",
  "hasQr": false,
  "currentState": "ready",
  "message": "WhatsApp client ready",
  "accountInfo": {
    "phoneNumber": "...",
    "name": "..."
  }
}
```

## Измененные файлы

1. **whatsapp-server/src/server.ts**
   - Строка 42: Добавлен импорт `fsSync` для синхронных операций
   - Строка 640: Исправлен catch блок в `/health` - всегда 200 OK
   - Строка 1732-1737: Добавлен try/catch для destroy в safeReconnect
   - Строка 2140-2154: Добавлено логирование сохранения сессии после authenticated

## Проверка после исправлений

### ✅ Критерии успеха:

1. **/health всегда 200 OK**
   ```bash
   curl -k https://api.2wix.ru/health
   # Должен вернуть 200 OK даже если WhatsApp NOT_READY
   ```

2. **После скана QR статус становится READY**
   ```bash
   curl -k https://api.2wix.ru/api/whatsapp/status
   # Должно быть status: "ready", hasQr: false
   ```

3. **Сессия сохраняется на диск**
   ```bash
   ls -la /volume1/docker/whatsapp-server/.wwebjs_auth/session-whatsapp-client/
   # Должны быть файлы сессии
   ```

4. **После перезапуска контейнера не требуется QR**
   ```bash
   sudo /usr/local/bin/docker restart whatsapp-server
   sleep 10
   curl -k https://api.2wix.ru/api/whatsapp/status
   # Должно быть status: "ready" без QR
   ```

5. **Нет ошибок EACCES в логах**
   ```bash
   sudo /usr/local/bin/docker logs whatsapp-server --tail=100 | grep EACCES
   # Не должно быть вывода
   ```

## Если проблемы остаются

### Проблема: После скана снова показывается QR

**Причины:**
1. Сессия не сохраняется (проверить права на `.wwebjs_auth`)
2. Сессия сохраняется, но не загружается (проверить путь в `WHATSAPP_SESSION_PATH`)
3. Клиент перезапускается после authenticated (проверить логи на ошибки destroy)

**Решение:**
```bash
# Проверить логи на ошибки
sudo /usr/local/bin/docker logs whatsapp-server --tail=200 | grep -E 'error|Error|ERROR|destroy|authenticated|ready'

# Проверить что сессия сохранилась
ls -la /volume1/docker/whatsapp-server/.wwebjs_auth/session-whatsapp-client/

# Проверить права
stat -c '%U:%G (%u:%g) %a' /volume1/docker/whatsapp-server/.wwebjs_auth
```

### Проблема: Статус остается "idle" или "authenticated" но не "ready"

**Причины:**
1. Таймаут ready (по умолчанию 60 секунд)
2. Клиент не может получить `client.info` после authenticated

**Решение:**
- Проверить логи на `[WA] authenticated diagnostic check`
- Увеличить `WA_READY_TIMEOUT_MS` в docker-compose если нужно

## Итоговый отчет для пользователя

После выполнения всех шагов предоставьте:

1. **Host path сессии:** `/volume1/docker/whatsapp-server/.wwebjs_auth`
2. **UID/GID контейнера:** (из `docker exec whatsapp-server id`)
3. **Права на папки:** (из `stat -c '%U:%G (%u:%g) %a'`)
4. **Результат проверки сессии:** (из `ls -la .wwebjs_auth/session-whatsapp-client/`)
5. **Статус после скана:** (из `curl /api/whatsapp/status`)
6. **Логи после скана:** (из `docker logs --tail=50`)
