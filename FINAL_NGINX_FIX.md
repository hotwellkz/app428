# Финальный отчет: Исправление Nginx для api.2wix.ru

## 🔍 Диагностика проблемы

### Найденные проблемы:
1. **Неправильный порт**: Все `proxy_pass` указывали на `10.8.0.1:3000` вместо `10.8.0.1:3002`
2. **Неправильный бэкенд**: Запросы шли на `shorts-backend` (порт 3000) вместо `whatsapp-server` (порт 3002)
3. **404 ошибки**: Эндпоинты `/whatsapp/status` и `/status` возвращали 404 из-за неправильного проксирования

### Проверка эндпоинтов на whatsapp-server (10.8.0.1:3002):
- ✅ `/health` → `{"status":"ok","timestamp":"...","uptime":...}`
- ✅ `/whatsapp/status` → `{"hasQr":false,"status":"disconnected","accountInfo":null}`
- ❌ `/status` → 404 (роут не существует на whatsapp-server)

## ✅ Исправления в конфиге

### Файл: `/etc/nginx/sites-available/api-2wix-whatsapp.conf`

**Изменения:**
```nginx
# БЫЛО:
proxy_pass http://10.8.0.1:3000;

# СТАЛО:
proxy_pass http://10.8.0.1:3002;
```

**Исправленные location блоки:**
1. `location /health` → `proxy_pass http://10.8.0.1:3002/health;`
2. `location /whatsapp/` → `proxy_pass http://10.8.0.1:3002/whatsapp/;`
3. `location /socket.io/` → `proxy_pass http://10.8.0.1:3002;`
4. `location /` → `proxy_pass http://10.8.0.1:3002;`

## 📋 Команды для проверки после фикса

```bash
# 1. Проверка конфига
sudo nginx -t

# 2. Перезагрузка nginx
sudo systemctl reload nginx

# 3. Проверка эндпоинтов
curl -k -i https://api.2wix.ru/health
curl -k -i https://api.2wix.ru/whatsapp/status
curl -k -i https://api.2wix.ru/socket.io/?EIO=4&transport=polling

# 4. Проверка что проксируется на правильный порт
curl -k -i https://api.2wix.ru/health | grep x-upstream
# Должно быть: x-upstream: 10.8.0.1:3002
```

## 🎯 Рекомендации для фронтенда

### 1. Service Worker (критично!)
Ошибки "Service Worker Error" и 404 возникают из-за кэширования старого Service Worker:

**В Chrome DevTools:**
1. Откройте DevTools (F12)
2. Перейдите в **Application** → **Service Workers**
3. Нажмите **Unregister** для всех зарегистрированных SW
4. Перейдите в **Application** → **Storage**
5. Нажмите **Clear site data** (все чекбоксы)
6. Закройте DevTools
7. Сделайте **Hard Reload**: `Ctrl+Shift+R` (Windows) или `Cmd+Shift+R` (Mac)

**Альтернативно через консоль:**
```javascript
// В консоли браузера на странице фронтенда:
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
});
location.reload(true);
```

### 2. Netlify Environment Variables
Убедитесь что в Netlify установлено:
```
VITE_BACKEND_URL=https://api.2wix.ru
```

**Проверка:**
- Netlify Dashboard → Site settings → Environment variables
- Пересоберите сайт после изменения переменных

### 3. Правильные эндпоинты
- ✅ `https://api.2wix.ru/health` - работает
- ✅ `https://api.2wix.ru/whatsapp/status` - работает
- ✅ `wss://api.2wix.ru/socket.io/` - должен работать после очистки SW
- ❌ `https://api.2wix.ru/status` - не существует (используйте `/whatsapp/status`)

### 4. Проверка WebSocket
После очистки Service Worker проверьте WebSocket подключение:
```javascript
// В консоли браузера:
const socket = io('https://api.2wix.ru', {
  transports: ['websocket', 'polling']
});
socket.on('connect', () => console.log('✅ WebSocket connected'));
socket.on('error', (err) => console.error('❌ WebSocket error:', err));
```

## ✅ Итоговый статус

- ✅ Nginx конфиг исправлен (все proxy_pass на 3002)
- ✅ SSL сертификат работает
- ✅ `/health` проксируется на whatsapp-server
- ✅ `/whatsapp/status` проксируется на whatsapp-server
- ✅ WebSocket `/socket.io/` настроен
- ⚠️ Требуется очистка Service Worker на фронтенде

## 🚀 Следующие шаги

1. **На фронтенде**: Очистить Service Worker (см. выше)
2. **Проверить**: Все запросы должны идти на `https://api.2wix.ru`
3. **Проверить**: WebSocket должен подключаться к `wss://api.2wix.ru/socket.io/`
4. **Если проблемы остаются**: Проверить CORS настройки и переменные окружения
