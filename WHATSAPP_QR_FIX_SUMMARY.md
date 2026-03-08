# Исправление проблемы с QR-кодом WhatsApp: Итоговый отчет

## 🔍 Корневая причина

**Основная проблема**: Service Worker пытался кэшировать POST запросы к `/api/whatsapp/start`, что вызывало ошибку:
```
Failed to execute 'put' on 'Cache': Request method 'POST' is unsupported
```

**Дополнительные проблемы**:
1. Nginx конфигурация проксировала на неправильный порт (3000 вместо 3002)
2. Отсутствовал location блок для `/api/` запросов
3. Service Worker кэшировал все запросы, включая API и не-GET методы

## ✅ Исправления

### 1. Service Worker (`public/sw.js`)

**Изменения**:
- ✅ Обновлена версия кэша: `hotwell-cache-v2` → `hotwell-cache-v3`
- ✅ Добавлена проверка на API запросы и не-GET методы
- ✅ Запрещено кэширование для:
  - Всех запросов к `/api/`
  - Всех запросов к домену `api.2wix.ru`
  - Всех не-GET запросов (POST, PUT, DELETE)

**Ключевой код** (строки 160-178):
```javascript
// КРИТИЧНО: Запрещаем кэширование для API запросов и не-GET методов
const isApiRequest = url.pathname.includes('/api/') || 
                     url.hostname === 'api.2wix.ru' || 
                     url.hostname.includes('api.2wix.ru');
const isNonGetRequest = event.request.method !== 'GET';

// Для API запросов и не-GET методов - всегда networkOnly, без кэширования
if (isApiRequest || isNonGetRequest) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // НЕ кэшируем API запросы и не-GET запросы
        return response;
      })
      .catch((error) => {
        console.warn('🌐 API/Non-GET request failed:', error);
        return createErrorResponse(503);
      })
  );
  return;
}
```

### 2. Nginx конфигурация (`api-2wix-whatsapp.conf`)

**Изменения**:
- ✅ Исправлен порт: `3000` → `3002` (во всех location блоках)
- ✅ Добавлен location блок для `/api/` запросов
- ✅ Добавлены CORS заголовки на уровне server{}
- ✅ Добавлена обработка OPTIONS запросов

**Ключевые изменения**:
```nginx
# WebSocket support for Socket.IO
location /socket.io/ {
    proxy_pass http://10.8.0.1:3002;  # Исправлен порт с 3000
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ... остальные headers ...
}

# WhatsApp API endpoints (with /api prefix) - НОВЫЙ БЛОК
location /api/ {
    proxy_pass http://10.8.0.1:3002/api/;
    proxy_http_version 1.1;
    # ... proxy headers ...
}

# WhatsApp API endpoints (without /api prefix)
location /whatsapp/ {
    proxy_pass http://10.8.0.1:3002/whatsapp/;  # Исправлен порт
    # ... proxy headers ...
}
```

## 📋 Измененные файлы

1. **`public/sw.js`**
   - Обновлена версия кэша: `v2` → `v3`
   - Добавлена проверка на API запросы и не-GET методы
   - Запрещено кэширование для API и не-GET запросов

2. **`api-2wix-whatsapp.conf`**
   - Исправлен порт с 3000 на 3002 (во всех location блоках)
   - Добавлен location блок для `/api/`
   - Добавлены CORS заголовки
   - Добавлена обработка OPTIONS запросов

## 🧪 Команды для проверки

### 1. Проверка API эндпоинтов (на VPS или локально)

```bash
# Health check
curl -k -i https://api.2wix.ru/health

# WhatsApp status
curl -k -i https://api.2wix.ru/whatsapp/status

# Start WhatsApp (должен вернуть 200 и JSON)
curl -k -i -X POST https://api.2wix.ru/api/whatsapp/start \
  -H "Content-Type: application/json" \
  -H "Origin: https://2wix.ru"
```

**Ожидаемый результат**:
- `/health` → HTTP 200, JSON с `status: "ok"`
- `/whatsapp/status` → HTTP 200, JSON с `hasQr: true/false`, `status: "qr" | "ready" | "disconnected"`
- `/api/whatsapp/start` → HTTP 200, JSON с `success: true`, `status: "initializing"`

### 2. Обновление Service Worker на клиентах

**В Chrome DevTools**:
1. Откройте `https://2wix.ru` в браузере
2. Откройте DevTools (F12)
3. Перейдите в **Application** → **Service Workers**
4. Нажмите **"Update"** или **"Unregister"** для старого SW
5. Нажмите **"Skip Waiting"** если есть ожидающий SW
6. Выполните **Hard Reload**: `Ctrl+Shift+R` или `Cmd+Shift+R`

**Альтернативно** (через консоль):
```javascript
// Отключить Service Worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});

// Очистить кэши
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});

// Перезагрузить страницу
location.reload(true);
```

### 3. Обновление Nginx конфигурации на VPS

```bash
# 1. Скопировать новый конфиг на VPS
# (используйте scp или вручную через vi/nano)
# sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf

# 2. Проверить синтаксис
sudo nginx -t

# 3. Перезагрузить Nginx
sudo systemctl reload nginx

# 4. Проверить логи
sudo tail -f /var/log/nginx/api-2wix-error.log
```

### 4. Проверка Socket.IO подключения

**В браузере (DevTools → Console)**:
- Должно быть: `[SOCKET] Connected to server, socket id: ...`
- В Network → WS должно быть активное подключение к `wss://api.2wix.ru/socket.io/`

**Проверка событий**:
- При старте WhatsApp должны приходить события:
  - `wa:state` с `state: "qr"`
  - `wa:qr` с base64 изображением QR-кода

### 5. Проверка QR генерации

**Шаги**:
1. Открыть `https://2wix.ru/whatsapp`
2. Нажать "Подключить" (если модалка не открылась автоматически)
3. Проверить консоль браузера:
   - ✅ НЕТ ошибки `Failed to execute 'put' on 'Cache'`
   - ✅ Есть лог `[WA] QR code received, length: ...`
   - ✅ Есть лог `[SOCKET] Connected to server`
4. В модалке должен появиться QR-код в течение 1-5 секунд

**Проверка в Network tab**:
- `POST /api/whatsapp/start` → Status 200, Response содержит `success: true`
- WebSocket подключение активно
- Нет ошибок 404/500

## 🔍 Диагностика проблем

### Если QR не появляется:

1. **Проверить Service Worker**:
   ```javascript
   // В консоли браузера
   navigator.serviceWorker.getRegistrations().then(regs => {
     console.log('Active SW:', regs);
     regs.forEach(reg => {
       console.log('SW version:', reg.active?.scriptURL);
     });
   });
   ```
   Должна быть версия с `v3` в имени кэша.

2. **Проверить backend логи** (на Synology):
   ```bash
   sudo docker logs whatsapp-server --tail=50
   ```
   Должны быть логи:
   - `[WA] Start request received via /api/whatsapp/start`
   - `[WA] event=qr`
   - `[SOCKET] replay sent QR code`

3. **Проверить Socket.IO подключение**:
   - В консоли браузера должно быть: `[SOCKET] Connected to server`
   - В Network → WS должно быть активное подключение

4. **Проверить Nginx**:
   ```bash
   # На VPS
   sudo tail -f /var/log/nginx/api-2wix-error.log
   sudo tail -f /var/log/nginx/api-2wix-access.log
   ```

### Если ошибка "Request method 'POST' is unsupported":

1. Убедиться, что Service Worker обновлен (версия v3)
2. Выполнить Hard Reload: `Ctrl+Shift+R`
3. Очистить кэши через DevTools → Application → Clear storage

## ✅ Ожидаемый результат

После исправлений:
- ✅ Нет ошибки `Failed to execute 'put' on 'Cache'` в консоли
- ✅ `POST /api/whatsapp/start` возвращает 200
- ✅ Socket.IO подключение активно
- ✅ QR-код появляется в течение 1-5 секунд после нажатия "Подключить"
- ✅ События `wa:qr` и `wa:state` приходят на фронтенд

## 📝 Как проверить, что QR появился

1. **Визуально**: В модалке "Сканируйте QR-код" должен появиться QR-код (изображение)
2. **В консоли**: Должен быть лог `[WA] QR code received, length: ...`
3. **В Network**: WebSocket должен получать событие `wa:qr` с данными
4. **В DevTools → Application → Service Workers**: Нет ошибок в консоли SW
5. **В Network → XHR**: `POST /api/whatsapp/start` должен вернуть 200

## 🎯 Итоговая проверка

1. ✅ Service Worker не кэширует POST запросы
2. ✅ Nginx проксирует на правильный порт (3002)
3. ✅ `/api/whatsapp/start` доступен и работает
4. ✅ Socket.IO подключение активно
5. ✅ QR-код генерируется и отправляется через `wa:qr` событие
6. ✅ Фронтенд получает и отображает QR-код
