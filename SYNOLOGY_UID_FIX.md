# Исправление прав доступа: UID/GID не совпадают

## 🔍 Проблема

- **Контейнер работает под**: `nodeuser` (UID 1001, GID 1001)
- **Папка на хосте принадлежит**: `adminv:users` (UID 1026, GID 100)
- **Результат**: Контейнер не может создавать файлы в volume mount

## ✅ Решение

Изменить владельца папок на хосте на UID/GID контейнера (1001:1001):

```bash
cd /volume1/docker/whatsapp-server

# Изменить владельца на UID/GID контейнера
sudo chown -R 1001:1001 .wwebjs_auth .wwebjs_cache data

# Выдать полные права (775 или 777)
sudo chmod -R 775 .wwebjs_auth .wwebjs_cache data

# Проверить права
ls -la | grep -E "wwebjs|data"
stat -c '%U:%G (%u:%g) %a' .wwebjs_auth
```

**Ожидаемый результат**:
```
drwxrwxr-x  1 1001 1001     0 Jan  9 01:45 .wwebjs_auth
drwxrwxr-x  1 1001 1001     0 Jan  8 18:50 .wwebjs_cache
drwxrwxr-x  1 1001 1001    26 Jan  8 15:56 data
```

## 🧪 Проверка

```bash
# Проверить что контейнер может создавать файлы
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'mkdir -p /app/.wwebjs_auth/test && echo ok > /app/.wwebjs_auth/test/a.txt && ls -la /app/.wwebjs_auth/test && rm -rf /app/.wwebjs_auth/test'
```

**Ожидаемый результат**: Команда выполняется без ошибок.

## 🔄 Перезапустить WhatsApp

```bash
# Перезапустить контейнер
sudo /usr/local/bin/docker restart whatsapp-server

# Подождать 10 секунд
sleep 10

# Проверить логи
sudo /usr/local/bin/docker logs whatsapp-server --tail=50 | grep -E "EACCES|permission|qr|QR|Session Path"
```

**Ожидаемый результат**:
- ✅ Нет ошибок `EACCES: permission denied`
- ✅ Появляется `[WA] event=qr`

## 📋 Альтернативный вариант (если 1001:1001 не работает)

Использовать более открытые права:

```bash
sudo chmod -R 777 .wwebjs_auth .wwebjs_cache data
```

Это менее безопасно, но гарантированно работает.
