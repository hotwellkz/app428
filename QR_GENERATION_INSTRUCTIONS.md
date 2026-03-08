# Инструкции по генерации QR для WhatsApp

## ✅ Что исправлено

1. **CORS заголовки** добавлены во все location блоки nginx
2. **Location `/api/`** добавлен для эндпоинтов с префиксом `/api/`
3. **WebSocket** настроен для Socket.IO
4. **Health endpoint** проксирует на порт 3002

## 🎯 Как запустить генерацию QR

### Вариант 1: Через фронтенд (рекомендуется)

1. **Очистите Service Worker** (критично!):
   ```javascript
   // В консоли браузера на https://2wix.ru
   navigator.serviceWorker.getRegistrations().then(function(registrations) {
     for(let registration of registrations) {
       registration.unregister();
     }
   });
   localStorage.clear();
   sessionStorage.clear();
   location.reload(true);
   ```

2. **Нажмите кнопку "Подключить WhatsApp"** на фронтенде

3. **Проверьте консоль** - должны быть запросы к `/api/whatsapp/start`

### Вариант 2: Вручную через curl/Postman

```bash
# 1. Запустить генерацию QR
curl -k -X POST \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://2wix.ru' \
  https://api.2wix.ru/api/whatsapp/start

# Ожидаемый ответ:
# {"success":true,"status":"initializing","message":"WhatsApp client initialization started"}

# 2. Подождать 5-10 секунд и проверить статус
curl -k -s https://api.2wix.ru/whatsapp/status

# Ожидаемый ответ после генерации QR:
# {"hasQr":true,"status":"qr","qrCode":"data:image/png;base64,...","accountInfo":null}
```

### Вариант 3: Через Socket.IO (автоматически)

После вызова `/api/whatsapp/start`, QR код автоматически отправляется через Socket.IO событие `wa:qr`.

**Проверка в консоли браузера:**
```javascript
const socket = io('https://api.2wix.ru', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Socket connected');
  // Запустить генерацию QR
  fetch('https://api.2wix.ru/api/whatsapp/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include'
  }).then(r => r.json()).then(console.log);
});

socket.on('wa:qr', (qr) => {
  console.log('✅ QR received!', qr.substring(0, 50) + '...');
  // QR код в формате data:image/png;base64,...
});

socket.on('wa:state', (state) => {
  console.log('✅ State:', state);
  // state.state может быть: 'idle', 'qr', 'ready', 'disconnected', 'blocked'
});
```

## 📋 Проверка что все работает

### 1. Проверка CORS
```bash
curl -k -i -X OPTIONS -H 'Origin: https://2wix.ru' https://api.2wix.ru/api/whatsapp/start
# Должны быть заголовки:
# access-control-allow-origin: https://2wix.ru
# access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
# access-control-allow-credentials: true
```

### 2. Проверка эндпоинта start
```bash
curl -k -X POST -H 'Content-Type: application/json' https://api.2wix.ru/api/whatsapp/start
# Должен вернуть: {"success":true,"status":"initializing",...}
```

### 3. Проверка статуса
```bash
curl -k -s https://api.2wix.ru/whatsapp/status
# Должно быть: {"hasQr":true,"status":"qr",...} после запуска
```

### 4. Проверка WebSocket
```bash
curl -k -i https://api.2wix.ru/socket.io/?EIO=4&transport=polling
# Должен вернуть ответ от Socket.IO
```

## 🔧 Проверка на Synology

### 1. Проверка контейнера
```bash
ssh shortsai "sudo /usr/local/bin/docker ps | grep whatsapp"
ssh shortsai "sudo /usr/local/bin/docker logs --tail=50 whatsapp-server | grep -E '(WA|QR|start)'"
```

### 2. Проверка эндпоинтов внутри контейнера
```bash
ssh shortsai "sudo /usr/local/bin/docker exec whatsapp-server curl -s http://localhost:3000/api/whatsapp/start -X POST"
ssh shortsai "sudo /usr/local/bin/docker exec whatsapp-server curl -s http://localhost:3000/whatsapp/status"
```

### 3. Проверка папок
```bash
ssh shortsai "sudo /usr/local/bin/docker exec whatsapp-server ls -la /app/.wwebjs_auth"
ssh shortsai "sudo /usr/local/bin/docker exec whatsapp-server ls -la /app/.wwebjs_cache"
```

## ⚠️ Важно: Service Worker

**Service Worker блокирует все запросы!** Обязательно очистите его:

1. **Chrome DevTools** → **Application** → **Service Workers** → **Unregister**
2. **Application** → **Storage** → **Clear site data**
3. **Hard Reload**: `Ctrl+Shift+R`

Или через консоль:
```javascript
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
});
location.reload(true);
```

## 🚀 Итоговые шаги

1. ✅ Nginx конфиг обновлен с CORS
2. ✅ Location `/api/` добавлен
3. ⚠️ **Очистить Service Worker на фронтенде**
4. ⚠️ **Пересобрать и задеплоить фронтенд на Netlify**
5. ⚠️ **Вызвать `/api/whatsapp/start` для генерации QR**

После выполнения всех шагов QR код должен появиться автоматически через Socket.IO событие `wa:qr`.
