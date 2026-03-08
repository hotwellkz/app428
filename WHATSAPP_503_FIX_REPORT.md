# Исправление проблемы 503 для WhatsApp QR-кода

## 🔍 Корневая причина

**Основная проблема**: Эндпоинты `/health` и `/whatsapp/status` возвращали HTTP 503 когда WhatsApp клиент не был готов, что ломало фронтенд и блокировало отображение QR-кода.

**Дополнительные проблемы**:
1. `/health` возвращал 503 если WhatsApp не готов → фронт получал CORS ошибку на 503
2. `/whatsapp/status` не возвращал сам QR-код, только флаг `hasQr: boolean`
3. Отсутствовал `/api/whatsapp/status` endpoint для единообразия
4. Nginx не добавлял CORS заголовки для `/health`

## ✅ Исправления

### 1. `/health` endpoint (`whatsapp-server/src/server.ts`, строка 596)

**Изменения**:
- ✅ Всегда возвращает HTTP 200 (вместо 503)
- ✅ Статус WhatsApp указывается в JSON (`status: 'ok' | 'degraded'`)
- ✅ Фронт может безопасно проверять `/health` без CORS ошибок

**Код**:
```typescript
// ВСЕГДА возвращаем 200, чтобы фронт не ломался
// Статус WhatsApp указываем в JSON, но не в HTTP коде
res.status(200).json({
    ...healthData,
    status: overallHealthy ? 'ok' : 'degraded',
    message: overallHealthy ? 'All services operational' : 'Some services are not available (check whatsapp.ready)'
});
```

### 2. `/whatsapp/status` endpoint (`whatsapp-server/src/server.ts`, строка 2646)

**Изменения**:
- ✅ Всегда возвращает HTTP 200 (вместо 500 при ошибках)
- ✅ Включает QR-код в ответе (`qrCode: string | null`)
- ✅ Возвращает детальный статус (`status: 'ready' | 'qr' | 'authenticated' | 'idle' | 'disconnected' | 'blocked'`)
- ✅ Использует `lastQr` (синхронизирован через `updateWaState`) или `qrCode` как fallback

**Новый формат ответа**:
```json
{
  "success": true,
  "status": "qr",
  "isReady": false,
  "hasQr": true,
  "qrCode": "data:image/png;base64,...",
  "currentState": "qr",
  "message": "QR code available, waiting for scan",
  "accountInfo": null
}
```

### 3. `/api/whatsapp/status` endpoint (новый)

**Изменения**:
- ✅ Добавлен новый endpoint `/api/whatsapp/status` для единообразия
- ✅ Идентичен `/whatsapp/status` по функциональности
- ✅ Всегда возвращает 200

### 4. Nginx конфигурация (`api-2wix-whatsapp.conf`)

**Изменения**:
- ✅ Добавлены CORS заголовки для `/health` endpoint
- ✅ Добавлена обработка OPTIONS запросов для `/health`

**Код**:
```nginx
location = /health {
    # ... proxy settings ...
    
    # CORS headers for health endpoint
    add_header Access-Control-Allow-Origin "https://2wix.ru" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    add_header Access-Control-Allow-Credentials true always;
    
    # Handle preflight requests
    if ($request_method = OPTIONS) {
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }
}
```

## 📋 Измененные файлы

1. **`whatsapp-server/src/server.ts`**
   - Исправлен `/health` endpoint (всегда 200)
   - Исправлен `/whatsapp/status` endpoint (всегда 200, включает QR)
   - Добавлен `/api/whatsapp/status` endpoint

2. **`api-2wix-whatsapp.conf`**
   - Добавлены CORS заголовки для `/health`

## 🧪 Команды для проверки

### 1. Проверка эндпоинтов (на VPS или локально)

```bash
# Health check (должен вернуть 200)
curl -k -i https://api.2wix.ru/health

# WhatsApp status (должен вернуть 200 с JSON)
curl -k -i https://api.2wix.ru/whatsapp/status

# API WhatsApp status (должен вернуть 200 с JSON)
curl -k -i https://api.2wix.ru/api/whatsapp/status

# Start WhatsApp (должен вернуть 200)
curl -k -i -X POST https://api.2wix.ru/api/whatsapp/start \
  -H "Content-Type: application/json" \
  -H "Origin: https://2wix.ru"
```

**Ожидаемый результат**:
- `/health` → HTTP 200, JSON с `status: "ok" | "degraded"`
- `/whatsapp/status` → HTTP 200, JSON с `status: "qr" | "ready" | ...`, `hasQr: true/false`, `qrCode: "data:image/..." | null`
- `/api/whatsapp/status` → HTTP 200, тот же формат что и `/whatsapp/status`
- `/api/whatsapp/start` → HTTP 200, JSON с `success: true`

### 2. Проверка после старта WhatsApp

```bash
# 1. Запустить WhatsApp
curl -k -X POST https://api.2wix.ru/api/whatsapp/start

# 2. Подождать 2-5 секунд

# 3. Проверить статус (должен вернуть hasQr: true и qrCode)
curl -k https://api.2wix.ru/api/whatsapp/status | jq .
```

**Ожидаемый результат**:
```json
{
  "success": true,
  "status": "qr",
  "isReady": false,
  "hasQr": true,
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "currentState": "qr",
  "message": "QR code available, waiting for scan"
}
```

### 3. Обновление Nginx на VPS

```bash
# 1. Скопировать новый конфиг
sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf
# (вставить содержимое из api-2wix-whatsapp.conf)

# 2. Проверить синтаксис
sudo nginx -t

# 3. Перезагрузить Nginx
sudo systemctl reload nginx

# 4. Проверить логи
sudo tail -f /var/log/nginx/api-2wix-error.log
```

### 4. Перезапуск WhatsApp сервера (на Synology)

```bash
# Проверить статус контейнера
sudo docker ps | grep whatsapp-server

# Перезапустить контейнер
sudo docker restart whatsapp-server

# Проверить логи
sudo docker logs whatsapp-server --tail=50 -f
```

## 🔍 Диагностика проблем

### Если все еще 503:

1. **Проверить логи backend** (на Synology):
   ```bash
   sudo docker logs whatsapp-server --tail=100
   ```
   Искать ошибки:
   - `Error initializing WhatsApp client`
   - `Chromium not found`
   - `Permission denied`
   - `Session locked`

2. **Проверить Nginx логи** (на VPS):
   ```bash
   sudo tail -f /var/log/nginx/api-2wix-error.log
   ```
   Искать:
   - `upstream timed out`
   - `connection refused`
   - `502 Bad Gateway`

3. **Проверить доступность backend** (с VPS):
   ```bash
   curl -i http://10.8.0.1:3002/health
   curl -i http://10.8.0.1:3002/whatsapp/status
   ```

### Если QR не появляется:

1. **Проверить что клиент инициализируется**:
   ```bash
   sudo docker logs whatsapp-server | grep -i "qr\|initializing\|event=qr"
   ```
   Должны быть логи:
   - `[WA] Creating and initializing new WhatsApp client...`
   - `[WA] event=qr`
   - `[WA] state=idle -> qr`

2. **Проверить что QR сохраняется**:
   - В коде: `lastQr` должен быть установлен через `updateWaState('qr', qrCode)`
   - Проверить: `curl -k https://api.2wix.ru/api/whatsapp/status | jq .hasQr`

3. **Проверить Socket.IO события**:
   - В браузере DevTools → Network → WS
   - Должно быть событие `wa:qr` с данными QR

### Если WhatsApp заблокировал сессию:

1. **Сбросить сессию** (на Synology):
   ```bash
   # Остановить контейнер
   sudo docker stop whatsapp-server
   
   # Удалить папку сессии
   sudo rm -rf /volume1/docker/whatsapp-server/.wwebjs_auth
   
   # Запустить контейнер
   sudo docker start whatsapp-server
   ```

2. **Или через API** (если есть endpoint):
   ```bash
   curl -k -X POST https://api.2wix.ru/api/whatsapp/reset
   ```

## ✅ Ожидаемый результат

После исправлений:
- ✅ `/health` всегда возвращает 200 (нет CORS ошибок)
- ✅ `/whatsapp/status` и `/api/whatsapp/status` всегда возвращают 200
- ✅ Статус endpoints включают QR-код в ответе (`qrCode`)
- ✅ Фронт может безопасно проверять статус без 503 ошибок
- ✅ QR-код появляется в UI в течение 1-5 секунд после старта

## 📝 Команды для деплоя

### На Synology (WhatsApp сервер):

```bash
# 1. Остановить контейнер
sudo docker stop whatsapp-server

# 2. Обновить код (если нужно)
cd /volume1/docker/whatsapp-server
# (скопировать обновленный server.ts)

# 3. Пересобрать и запустить
sudo docker-compose -f docker-compose.synology.yml up -d --build

# 4. Проверить логи
sudo docker logs whatsapp-server --tail=50 -f
```

### На VPS (Nginx):

```bash
# 1. Обновить конфиг
sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf

# 2. Проверить синтаксис
sudo nginx -t

# 3. Перезагрузить
sudo systemctl reload nginx

# 4. Проверить
curl -k -i https://api.2wix.ru/health
```

## 🎯 Итоговая проверка

1. ✅ `/health` возвращает 200 (не 503)
2. ✅ `/whatsapp/status` возвращает 200 с QR кодом если есть
3. ✅ `/api/whatsapp/status` работает идентично `/whatsapp/status`
4. ✅ Нет CORS ошибок на `/health`
5. ✅ QR-код появляется в UI после старта
6. ✅ Socket.IO события `wa:qr` приходят на фронт
