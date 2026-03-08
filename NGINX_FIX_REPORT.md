# Отчет о настройке Nginx для api.2wix.ru

## Проблема
- Все запросы проксировались на `10.8.0.1:3000` вместо `10.8.0.1:3002`
- Это был другой сервис (shorts-backend), а не whatsapp-server
- Эндпоинты `/whatsapp/status` и `/status` возвращали 404

## Решение
1. Исправлены все `proxy_pass` в конфиге с `3000` на `3002`
2. Обновлен конфиг `/etc/nginx/sites-available/api-2wix-whatsapp.conf`
3. Nginx перезагружен

## Проверка эндпоинтов на whatsapp-server (10.8.0.1:3002)
- ✅ `/health` → `{"status":"ok",...}`
- ✅ `/whatsapp/status` → `{"hasQr":false,"status":"disconnected","accountInfo":null}`
- ❌ `/status` → 404 (роут не существует)

## Итоговый конфиг
Все location блоки теперь проксируют на `10.8.0.1:3002`:
- `/health` → `http://10.8.0.1:3002/health`
- `/whatsapp/` → `http://10.8.0.1:3002/whatsapp/`
- `/socket.io/` → `http://10.8.0.1:3002/socket.io/`
- `/` → `http://10.8.0.1:3002`

## Рекомендации для фронтенда

### 1. Service Worker
Ошибки "Service Worker Error" возникают из-за кэширования старого SW:
```javascript
// В Chrome DevTools:
// 1. Application → Service Workers → Unregister
// 2. Application → Storage → Clear site data
// 3. Hard Reload (Ctrl+Shift+R)
```

### 2. Netlify Environment Variables
Убедитесь что установлено:
```
VITE_BACKEND_URL=https://api.2wix.ru
```

### 3. Проверка эндпоинтов
- ✅ `https://api.2wix.ru/health` - работает
- ✅ `https://api.2wix.ru/whatsapp/status` - работает
- ❌ `https://api.2wix.ru/status` - не существует (используйте `/whatsapp/status`)

### 4. WebSocket
- `wss://api.2wix.ru/socket.io/` - должен работать после очистки Service Worker
