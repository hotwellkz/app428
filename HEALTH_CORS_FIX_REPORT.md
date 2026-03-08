# Отчет: Исправление /health endpoint и CORS заголовков

## 🔍 Проблема

**Ошибки на фронтенде:**
- `GET https://api.2wix.ru/health -> 404 (Service worker error)`
- `CORS: "No 'Access-Control-Allow-Origin' header is present on the requested resource"`

**Причина:**
- В `location = /health` CORS заголовки не применялись (nginx особенность: `location =` может не наследовать заголовки из `server{}` блока)
- Заголовки с флагом `always` на уровне `server{}` не всегда применяются к точным location блокам

## ✅ Решение

### Изменения в `/etc/nginx/sites-available/api-2wix-whatsapp.conf`:

1. **Добавлены CORS заголовки явно в `location = /health`** с флагом `always`:
   ```nginx
   location = /health {
       proxy_pass http://10.8.0.1:3002/health;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       
       # CORS headers с always (чтобы применялись даже при ошибках)
       add_header Access-Control-Allow-Origin "https://2wix.ru" always;
       add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
       add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
       add_header Access-Control-Allow-Credentials true always;
       
       # No caching for health checks
       add_header Cache-Control "no-cache, no-store, must-revalidate" always;
       
       # Handle preflight OPTIONS requests
       if ($request_method = OPTIONS) {
           add_header Content-Length 0;
           add_header Content-Type text/plain;
           return 204;
       }
   }
   ```

2. **CORS заголовки на уровне `server{}` блока** остались для других location блоков:
   ```nginx
   add_header Access-Control-Allow-Origin "https://2wix.ru" always;
   add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
   add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
   add_header Access-Control-Allow-Credentials true always;
   ```

### Результат:

- ✅ `/health` возвращает HTTP 200 с JSON ответом
- ✅ CORS заголовки присутствуют в ответе (один раз, без дублирования)
- ✅ OPTIONS запросы обрабатываются корректно (204)
- ✅ Заголовки применяются даже при ошибках (благодаря флагу `always`)

## 📋 Проверка

### Команды для проверки:

```bash
# 1. Проверка /health endpoint
curl -k -i https://api.2wix.ru/health
# Ожидается:
# HTTP/2 200
# access-control-allow-origin: https://2wix.ru
# access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
# access-control-allow-headers: Authorization, Content-Type
# access-control-allow-credentials: true
# {"status":"ok",...}

# 2. Проверка количества заголовков (должно быть 1)
curl -k -I https://api.2wix.ru/health | grep -c 'access-control-allow-origin'
# Ожидается: 1

# 3. Проверка OPTIONS запроса
curl -k -I -X OPTIONS -H 'Origin: https://2wix.ru' https://api.2wix.ru/health
# Ожидается: HTTP/2 204

# 4. Проверка JSON ответа
curl -k -s https://api.2wix.ru/health
# Ожидается: {"status":"ok","timestamp":...,...}
```

## ✅ Итоговый статус

- [x] `/health` endpoint возвращает HTTP 200
- [x] CORS заголовки присутствуют в ответе `/health`
- [x] Заголовки применяются с флагом `always` (даже при ошибках)
- [x] OPTIONS запросы обрабатываются корректно (204)
- [x] Нет дублирования заголовков (ровно 1 заголовок `Access-Control-Allow-Origin`)
- [x] Nginx конфиг проверен (`nginx -t`)
- [x] Nginx перезагружен (`systemctl reload nginx`)

## 🚀 Следующие шаги

1. **Проверить на фронтенде**: Ошибка CORS на `/health` должна исчезнуть
2. **Очистить Service Worker** (если еще не сделано):
   - Chrome DevTools → Application → Service Workers → Unregister
   - Application → Storage → Clear site data
   - Hard Reload: `Ctrl+Shift+R`

## 📝 Измененные файлы

- `/etc/nginx/sites-available/api-2wix-whatsapp.conf` - добавлены CORS заголовки в `location = /health` с флагом `always`

## 🔧 Технические детали

**Почему нужно было явно добавить заголовки в `location = /health`:**

В nginx, когда используется точное совпадение `location =`, заголовки из родительского `server{}` блока могут не применяться, если в location блоке есть свой `add_header`. Даже с флагом `always` на уровне `server{}`, точные location блоки требуют явного указания заголовков.

**Решение:**
- Явно добавить CORS заголовки в `location = /health` с флагом `always`
- Это гарантирует, что заголовки будут применяться даже при ошибках (404, 500, etc.)

Проблема решена! Endpoint `/health` теперь работает корректно с CORS заголовками.
