# Финальные шаги для исправления прав WhatsApp на Synology

## ✅ Статус

- ✅ Контейнер пересобран и запущен
- ✅ Файлы обновлены (server.ts, docker-compose.synology.yml)
- ✅ Скрипт fix-permissions.sh создан

## 🔧 Требуется выполнить вручную (требует sudo)

### Шаг 1: Исправить права на хосте

Выполните на Synology:

```bash
cd /volume1/docker/whatsapp-server

# Создать директории если не существуют
sudo mkdir -p .wwebjs_auth .wwebjs_cache data

# Выдать права
sudo chown -R adminv:users .wwebjs_auth .wwebjs_cache data
sudo chmod -R 775 .wwebjs_auth .wwebjs_cache data

# Проверить права
ls -la | grep -E "wwebjs|data"
```

**Ожидаемый результат**:
```
drwxrwxr-x+ 1 adminv users   0 Jan  9 09:45 .wwebjs_auth
drwxrwxr-x+ 1 adminv users   0 Jan  9 09:45 .wwebjs_cache
drwxrwxr-x+ 1 adminv users  26 Jan  8 15:56 data
```

### Шаг 2: Проверить что контейнер может писать

```bash
# Проверить что контейнер может создавать файлы
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'mkdir -p /app/.wwebjs_auth/test && echo ok > /app/.wwebjs_auth/test/a.txt && ls -la /app/.wwebjs_auth/test && rm -rf /app/.wwebjs_auth/test'
```

**Ожидаемый результат**: Команда выполняется без ошибок, файл создается.

### Шаг 3: Проверить логи контейнера

```bash
sudo /usr/local/bin/docker logs whatsapp-server --tail=50 | grep -E "EACCES|permission|qr|QR|state=|event=qr|Session Path"
```

**Ожидаемый результат**:
- ✅ Нет ошибок `EACCES: permission denied`
- ✅ Есть лог `Session Path: /app/.wwebjs_auth` (не `/app/data/.wwebjs_auth`)
- ✅ При старте WhatsApp появляется `[WA] event=qr`

### Шаг 4: Запустить WhatsApp (если еще не запущен)

```bash
# Проверить статус
curl -k https://api.2wix.ru/api/whatsapp/status

# Запустить WhatsApp
curl -k -X POST https://api.2wix.ru/api/whatsapp/start

# Подождать 5 секунд и проверить статус снова
sleep 5
curl -k https://api.2wix.ru/api/whatsapp/status | jq .
```

**Ожидаемый результат**:
```json
{
  "success": true,
  "status": "qr",
  "hasQr": true,
  "qrCode": "data:image/png;base64,...",
  "currentState": "qr"
}
```

## 🔍 Диагностика проблем

### Если все еще EACCES:

1. **Проверить UID/GID контейнера**:
   ```bash
   sudo /usr/local/bin/docker exec whatsapp-server sh -c 'id'
   ```
   Обычно это `uid=1001(nodeuser) gid=1001(nodejs)` или `uid=1000(node) gid=1000(node)`

2. **Изменить владельца на UID/GID контейнера**:
   ```bash
   # Если контейнер использует 1001:1001
   sudo chown -R 1001:1001 /volume1/docker/whatsapp-server/.wwebjs_auth
   sudo chmod -R 775 /volume1/docker/whatsapp-server/.wwebjs_auth
   ```

3. **Или использовать более открытые права** (временно):
   ```bash
   sudo chmod -R 777 /volume1/docker/whatsapp-server/.wwebjs_auth
   ```

### Если путь все еще неправильный:

Проверить переменную окружения в контейнере:
```bash
sudo /usr/local/bin/docker exec whatsapp-server sh -c 'echo $WHATSAPP_SESSION_PATH'
```

Должно быть: `/app/.wwebjs_auth`

Если нет - перезапустить контейнер:
```bash
sudo /usr/local/bin/docker restart whatsapp-server
```

## ✅ Финальная проверка

1. ✅ Нет ошибок `EACCES: permission denied` в логах
2. ✅ Лог показывает `Session Path: /app/.wwebjs_auth`
3. ✅ При старте WhatsApp появляется `[WA] event=qr`
4. ✅ `/api/whatsapp/status` возвращает 200 с `hasQr: true` и `qrCode`
5. ✅ QR-код появляется в UI (`https://2wix.ru/whatsapp`)

## 📝 Команды для быстрой проверки

```bash
# Проверить логи (последние 50 строк)
sudo /usr/local/bin/docker logs whatsapp-server --tail=50

# Проверить статус через API
curl -k https://api.2wix.ru/api/whatsapp/status | jq .

# Проверить что сессия создалась
ls -la /volume1/docker/whatsapp-server/.wwebjs_auth/
```
