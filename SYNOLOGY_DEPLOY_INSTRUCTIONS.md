# Инструкции по деплою изменений на Synology

## ✅ Файл server.ts успешно скопирован

Файл `whatsapp-server/src/server.ts` успешно загружен на Synology:
- Путь: `/volume1/docker/whatsapp-server/src/server.ts`
- Размер: 164K
- Время обновления: 09:22

## 🔄 Требуется пересборка контейнера

Поскольку код копируется в Docker образ при сборке (нет volume mount для `src`), необходимо пересобрать контейнер.

## 📋 Команды для выполнения на Synology

### Вариант 1: Через SSH (если есть доступ к sudo)

```bash
# Подключиться к Synology
ssh admin@192.168.100.222

# Перейти в директорию проекта
cd /volume1/docker/whatsapp-server

# Остановить контейнер
sudo docker stop whatsapp-server

# Пересобрать образ с новым кодом
sudo docker-compose -f docker-compose.synology.yml build

# Запустить контейнер
sudo docker-compose -f docker-compose.synology.yml up -d

# Проверить логи
sudo docker logs whatsapp-server --tail=50 -f
```

### Вариант 2: Через Synology DSM (Web UI)

1. Откройте **Docker** в Synology DSM
2. Перейдите в **Container**
3. Найдите контейнер `whatsapp-server`
4. Остановите его (Stop)
5. Перейдите в **Image**
6. Найдите образ `whatsapp-server`
7. Удалите его (Delete)
8. Откройте **Terminal** (или используйте SSH)
9. Выполните:
   ```bash
   cd /volume1/docker/whatsapp-server
   sudo docker-compose -f docker-compose.synology.yml build
   sudo docker-compose -f docker-compose.synology.yml up -d
   ```

### Вариант 3: Использовать готовый скрипт deploy.sh

```bash
ssh admin@192.168.100.222
cd /volume1/docker/whatsapp-server
chmod +x deploy.sh
sudo ./deploy.sh
```

## ✅ Проверка после деплоя

### 1. Проверить что контейнер запущен

```bash
sudo docker ps | grep whatsapp-server
```

Должен быть статус `Up`.

### 2. Проверить логи

```bash
sudo docker logs whatsapp-server --tail=50
```

Искать:
- `✅ Server ready`
- `[WA] Server ready. WhatsApp client will be initialized on demand`
- Нет ошибок компиляции TypeScript

### 3. Проверить эндпоинты

```bash
# Health check (должен вернуть 200)
curl -i http://localhost:3002/health

# WhatsApp status (должен вернуть 200)
curl -i http://localhost:3002/whatsapp/status

# API WhatsApp status (должен вернуть 200)
curl -i http://localhost:3002/api/whatsapp/status
```

### 4. Проверить с VPS

```bash
# С VPS проверить через VPN IP
curl -k -i https://api.2wix.ru/health
curl -k -i https://api.2wix.ru/whatsapp/status
curl -k -i https://api.2wix.ru/api/whatsapp/status
```

## 🔍 Что изменилось в server.ts

1. **`/health` endpoint**: Теперь всегда возвращает HTTP 200 (вместо 503)
2. **`/whatsapp/status` endpoint**: 
   - Всегда возвращает HTTP 200
   - Включает QR-код в ответе (`qrCode`)
   - Возвращает детальный статус
3. **`/api/whatsapp/status` endpoint**: Новый endpoint для единообразия

## ⚠️ Важные замечания

- После пересборки контейнера сессия WhatsApp сохранится (volume mount для `.wwebjs_auth`)
- Если возникнут проблемы, можно проверить логи: `sudo docker logs whatsapp-server -f`
- Для отладки можно зайти в контейнер: `sudo docker exec -it whatsapp-server sh`

## 📝 Альтернативный способ (если нет sudo)

Если нет доступа к sudo, можно:
1. Использовать Synology DSM Web UI для управления контейнерами
2. Или настроить пользователя в группу docker (требует root доступ)
