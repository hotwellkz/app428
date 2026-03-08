# Инструкции по развертыванию исправлений WhatsApp

## Измененные файлы

### Frontend
1. `public/sw.js` - Service Worker (v4, исключены API пути)
2. `src/config/api.ts` - Использует same-origin в production
3. `src/utils/connectionStabilizer.ts` - Улучшенная логика проверки статуса

### Backend (уже загружены ранее)
4. `whatsapp-server/src/server.ts` - /health всегда 200, логирование сессии
5. `whatsapp-server/src/utils/chatStorage.ts` - Исправлена ошибка null

### Nginx
6. `nginx-2wix-frontend.conf` - Конфиг для добавления proxy на фронтенде

## Шаг 1: Найти путь к фронтенду на сервере

```bash
# На Synology найти где лежит фронтенд
find /volume1 -type d -name "app400*" 2>/dev/null
find /volume1 -name "vite.config.*" 2>/dev/null
find /volume1 -name "package.json" | grep -E "vite|react" | head -3
```

## Шаг 2: Загрузить файлы фронтенда

После того как найдете путь (например `/volume1/docker/frontend` или `/volume1/web/2wix.ru`):

```bash
# На локальной машине (Windows PowerShell)
Get-Content public/sw.js | ssh shortsai "cat > <ПУТЬ_К_ФРОНТЕНДУ>/public/sw.js"
Get-Content src/config/api.ts | ssh shortsai "cat > <ПУТЬ_К_ФРОНТЕНДУ>/src/config/api.ts"
Get-Content src/utils/connectionStabilizer.ts | ssh shortsai "cat > <ПУТЬ_К_ФРОНТЕНДУ>/src/utils/connectionStabilizer.ts"
```

## Шаг 3: Добавить nginx proxy на фронтенде

На сервере где работает 2wix.ru (не Synology, а основной веб-сервер):

```bash
# Найти конфиг nginx для 2wix.ru
sudo find /etc/nginx -name "*2wix*" -o -name "*2wix.ru*"
# Или
sudo ls -la /etc/nginx/sites-available/ | grep 2wix
sudo ls -la /etc/nginx/conf.d/ | grep 2wix

# Открыть конфиг
sudo nano /etc/nginx/sites-available/2wix.ru  # или ваш путь

# Добавить в server {} блок для 2wix.ru (ПЕРЕД location /):
    # API proxy
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

    # Socket.IO proxy
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

# Проверить и перезагрузить
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 4: Пересобрать фронтенд

```bash
# На сервере с фронтендом
cd <ПУТЬ_К_ФРОНТЕНДУ>
npm run build

# Если используется Docker:
# Пересобрать и перезапустить контейнер фронтенда
```

## Шаг 5: Очистить Service Worker в браузере

**КРИТИЧНО:** После обновления SW нужно очистить старый кэш:

1. Открыть `https://2wix.ru` в Chrome
2. F12 → Application → Service Workers
3. Найти SW для 2wix.ru → Unregister
4. Application → Storage → Clear site data
5. Hard Refresh: Ctrl+Shift+R (или Cmd+Shift+R на Mac)

## Шаг 6: Проверка

### В браузере (DevTools Console):
- Нет ошибок `GET /health 503 (Service Worker error)`
- Нет ошибок `CORS blocked`
- `/api/health` возвращает 200 OK

### В Network Tab:
- `GET /api/health` → 200 OK
- `GET /api/whatsapp/status` → 200 OK
- Headers: `Access-Control-Allow-Origin: https://2wix.ru`

### UI:
- После скана QR → "Подключение..." (не QR снова)
- Когда `authenticated` → спиннер + "Аутентификация успешна"
- Когда `ready` → "WhatsApp подключен" + модалка закрывается

## Файлы на сервере

Конфиги сохранены в `/tmp/`:
- `/tmp/nginx-2wix-frontend.conf` - конфиг для nginx
- `/tmp/WHATSAPP_FIX_COMPLETE.md` - полная документация
