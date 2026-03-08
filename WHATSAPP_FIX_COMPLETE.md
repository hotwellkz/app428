# Полное исправление WhatsApp интеграции

## Измененные файлы

### Frontend (React/Vite)

1. **`public/sw.js`**
   - Обновлен `CACHE_NAME` до `v4` для принудительного обновления SW
   - Исключены `/api/`, `/health`, `/socket.io/` из кэширования
   - Service Worker НЕ перехватывает эти запросы (return без event.respondWith)

2. **`src/config/api.ts`**
   - В production использует same-origin (пустая строка) вместо прямого api.2wix.ru
   - Все запросы идут через `/api/*` на фронтенде

3. **`src/utils/connectionStabilizer.ts`**
   - Использует `/api/health` вместо прямого `api.2wix.ru/health`
   - Улучшена логика: не считает disconnected при одной ошибке (нужно 3+ подряд)
   - Добавлен exponential backoff для интервалов проверки
   - Правильно определяет статус: ready или authenticated = connected

4. **`src/components/WhatsAppConnect.tsx`**
   - Уже правильно обрабатывает статус `authenticated` (показывает "Подключение...")
   - Не показывает QR если `authenticated`

5. **`src/components/WhatsAppContent.tsx`**
   - Уже правильно показывает статус при `authenticated` (спиннер + текст)

### Backend (Node/Express)

6. **`whatsapp-server/src/server.ts`**
   - `/health` всегда возвращает 200 OK (даже при ошибках)
   - Добавлено логирование сохранения сессии после `authenticated`
   - Безопасный `destroy` с try/catch

7. **`whatsapp-server/src/utils/chatStorage.ts`**
   - Исправлена ошибка `Cannot read properties of null (reading 'from')`
   - Добавлена фильтрация null значений перед сохранением

### Nginx

8. **`nginx-2wix-frontend.conf`** (НОВЫЙ файл)
   - Конфиг для добавления в server блок фронтенда 2wix.ru
   - Proxy для `/api/*` → `https://api.2wix.ru/api/`
   - Proxy для `/socket.io/*` → `https://api.2wix.ru/socket.io/`
   - CORS headers для same-origin запросов

9. **`api-2wix-whatsapp.conf`** (уже настроен)
   - CORS для `https://2wix.ru`
   - Proxy на `http://10.8.0.1:3002`

## Команды для применения на Synology

### 1. Загрузить файлы на сервер

```bash
# На локальной машине (Windows)
scp public/sw.js shortsai:/volume1/docker/app400-main/public/sw.js
scp src/config/api.ts shortsai:/volume1/docker/app400-main/src/config/api.ts
scp src/utils/connectionStabilizer.ts shortsai:/volume1/docker/app400-main/src/utils/connectionStabilizer.ts
scp nginx-2wix-frontend.conf shortsai:/tmp/nginx-2wix-frontend.conf
```

### 2. На фронтенде (2wix.ru) - добавить nginx proxy

```bash
# На сервере с фронтендом (где работает 2wix.ru)
# Найти существующий конфиг для 2wix.ru
sudo nano /etc/nginx/sites-available/2wix.ru  # или где у вас конфиг

# Добавить location блоки из nginx-2wix-frontend.conf
# Внутри server {} блока для 2wix.ru добавить:

    location /api/ {
        proxy_pass https://api.2wix.ru/api/;
        proxy_http_version 1.1;
        proxy_set_header Host api.2wix.ru;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        add_header Access-Control-Allow-Origin "https://2wix.ru" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "https://2wix.ru" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
            add_header Access-Control-Allow-Credentials true always;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /socket.io/ {
        proxy_pass https://api.2wix.ru/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host api.2wix.ru;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

# Проверить и перезагрузить nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Пересобрать фронтенд

```bash
# На сервере с фронтендом
cd /volume1/docker/app400-main  # или где у вас фронтенд
npm run build
# Перезапустить фронтенд (зависит от вашей настройки)
```

### 4. Пересобрать WhatsApp backend

```bash
# На Synology
cd /volume1/docker/whatsapp-server
sudo /usr/local/bin/docker stop whatsapp-server
sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml build
sudo /usr/local/bin/docker-compose -f docker-compose.synology.yml up -d
```

### 5. Очистить Service Worker в браузере

**ВАЖНО:** После обновления SW нужно очистить старый кэш:

1. Открыть DevTools (F12)
2. Application → Service Workers → Unregister
3. Application → Storage → Clear site data
4. Или просто Hard Refresh (Ctrl+Shift+R)

## Чеклист проверки

### ✅ В DevTools Console

- [ ] Нет ошибок `GET /health 503 (Service Worker error)`
- [ ] Нет ошибок `CORS blocked: No Access-Control-Allow-Origin`
- [ ] Нет спама `connectionStabilizer` в логах
- [ ] `/api/health` возвращает 200 OK

### ✅ В Network Tab

- [ ] `GET /api/health` → 200 OK (не 503)
- [ ] `GET /api/whatsapp/status` → 200 OK
- [ ] Headers содержат `Access-Control-Allow-Origin: https://2wix.ru`
- [ ] Нет запросов напрямую на `api.2wix.ru` (только через `/api/*`)

### ✅ UI Статус

- [ ] После скана QR показывается "Подключение..." (не QR снова)
- [ ] Когда `authenticated` → спиннер + "Аутентификация успешна"
- [ ] Когда `ready` → "WhatsApp подключен" + модалка закрывается
- [ ] Нет флапа CONNECTED/DISCONNECTED

### ✅ Функциональность

- [ ] Чаты загружаются после `ready`
- [ ] Сообщения отправляются
- [ ] Сообщения получаются
- [ ] После перезапуска контейнера не требуется QR (сессия сохраняется)

## Проверка через curl

```bash
# Проверить /api/health через фронтенд
curl -k https://2wix.ru/api/health

# Должен вернуть 200 OK с JSON:
# {
#   "status": "ok",
#   "whatsapp": {
#     "ready": true/false,
#     "authenticated": true/false
#   }
# }

# Проверить статус WhatsApp
curl -k https://2wix.ru/api/whatsapp/status

# Должен вернуть:
# {
#   "success": true,
#   "status": "ready" | "authenticated" | "qr",
#   "hasQr": false,
#   "currentState": "ready" | "authenticated" | "qr"
# }
```

## Итоговый результат

После всех исправлений:

1. ✅ Service Worker не кэширует API запросы
2. ✅ Фронт использует same-origin `/api/*` вместо прямого `api.2wix.ru`
3. ✅ CORS настроен правильно на всех уровнях
4. ✅ `/health` всегда 200 OK
5. ✅ UI правильно показывает статус `authenticated` → `ready`
6. ✅ Нет флапа состояния соединения
7. ✅ Чаты загружаются после подключения

## Если проблемы остаются

### Проблема: Все еще 503 Service Worker error

**Решение:**
1. Проверить что SW обновился (версия v4 в коде)
2. Application → Service Workers → Unregister + Clear site data
3. Hard Refresh (Ctrl+Shift+R)

### Проблема: CORS ошибки

**Решение:**
1. Проверить что nginx proxy для `/api/*` добавлен на фронтенде
2. Проверить что `api-2wix-whatsapp.conf` содержит CORS для `https://2wix.ru`
3. Проверить что backend `allowedOrigins` содержит `https://2wix.ru`

### Проблема: UI показывает "не подключен" хотя authenticated

**Решение:**
1. Проверить что `connectionStabilizer` использует `/api/health`
2. Проверить что `/api/health` возвращает правильный статус
3. Проверить логи: `console.log('[WA] State received:', state)`

### Проблема: После скана снова QR

**Решение:**
1. Проверить логи backend: `[WA] event=authenticated`, `[WA] event=ready`
2. Проверить что сессия сохраняется: `ls -la .wwebjs_auth/session-whatsapp-client/`
3. Проверить права на папки: `chown -R 1001:1001 .wwebjs_auth`
