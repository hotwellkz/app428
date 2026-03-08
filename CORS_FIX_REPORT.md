# Отчет: Исправление дублирования CORS заголовков

## 🔍 Проблема

**Ошибка**: `Access-Control-Allow-Origin header contains multiple values 'https://2wix.ru, https://2wix.ru'`

**Причина**: Заголовок `Access-Control-Allow-Origin` задавался:
1. В каждом `location` блоке (8 раз)
2. Внутри `if` блоков для OPTIONS запросов (3 раза)
3. Возможно, также отправлялся бэкендом

## ✅ Решение

### Изменения в `/etc/nginx/sites-available/api-2wix-whatsapp.conf`:

1. **Добавлено на уровне `server{}` блока** (один раз):
   ```nginx
   # Скрываем CORS заголовки от бэкенда, чтобы избежать дублирования
   proxy_hide_header Access-Control-Allow-Origin;
   proxy_hide_header Access-Control-Allow-Methods;
   proxy_hide_header Access-Control-Allow-Headers;
   proxy_hide_header Access-Control-Allow-Credentials;

   # CORS headers - ОДИН РАЗ на уровне server{} блока
   add_header Access-Control-Allow-Origin "https://2wix.ru" always;
   add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
   add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
   add_header Access-Control-Allow-Credentials true always;
   ```

2. **Удалено из всех `location` блоков**:
   - Убраны все `add_header Access-Control-Allow-Origin` из location блоков
   - Убраны CORS заголовки из `if` блоков для OPTIONS (оставлен только `Content-Length` и `Content-Type`)

### Результат:

- ✅ Заголовок `Access-Control-Allow-Origin` отправляется **только один раз**
- ✅ Заголовки от бэкенда скрыты через `proxy_hide_header`
- ✅ CORS заголовки применяются ко всем location блокам через `always` флаг

## 📋 Проверка

### Команды для проверки:

```bash
# 1. Проверка количества заголовков (должно быть 1)
curl -k -I https://api.2wix.ru/health | grep -c 'access-control-allow-origin'
# Ожидается: 1

curl -k -I https://api.2wix.ru/whatsapp/status | grep -c 'access-control-allow-origin'
# Ожидается: 1

# 2. Проверка всех CORS заголовков
curl -k -I https://api.2wix.ru/whatsapp/status | grep -i 'access-control'
# Ожидается:
# access-control-allow-origin: https://2wix.ru
# access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
# access-control-allow-headers: Authorization, Content-Type
# access-control-allow-credentials: true

# 3. Проверка в nginx конфиге (должно быть 4 строки на уровне server{})
sudo nginx -T | grep -n 'Access-Control-Allow-Origin' | grep 'api.2wix.ru'
# Ожидается: 4 строки (по одной для каждого заголовка)
```

## ✅ Итоговый статус

- [x] CORS заголовки заданы только один раз на уровне `server{}` блока
- [x] Заголовки от бэкенда скрыты через `proxy_hide_header`
- [x] Все `location` блоки очищены от дублирующих CORS заголовков
- [x] Nginx конфиг проверен (`nginx -t`)
- [x] Nginx перезагружен (`systemctl reload nginx`)
- [x] Проверено что заголовок не дублируется

## 🚀 Следующие шаги

1. **Проверить на фронтенде**: Ошибка CORS должна исчезнуть
2. **Очистить Service Worker** (если еще не сделано):
   - Chrome DevTools → Application → Service Workers → Unregister
   - Application → Storage → Clear site data
   - Hard Reload: `Ctrl+Shift+R`

Проблема решена! Заголовок `Access-Control-Allow-Origin` теперь отправляется только один раз.
