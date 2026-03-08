# Быстрый деплой на Synology

## ✅ Файл server.ts загружен

Файл успешно скопирован на Synology: `/volume1/docker/whatsapp-server/src/server.ts`

## 🚀 Быстрый деплой (один скрипт)

На Synology выполните:

```bash
cd /volume1/docker/whatsapp-server
sudo ./deploy.sh
```

Скрипт автоматически:
1. Пересоберет контейнер с новым кодом
2. Запустит контейнер
3. Покажет последние логи

## 📋 Что изменилось

- `/health` → всегда 200 (не 503)
- `/whatsapp/status` → всегда 200, включает QR-код
- `/api/whatsapp/status` → новый endpoint

## ✅ Проверка

```bash
# Проверить контейнер
sudo /usr/local/bin/docker ps | grep whatsapp

# Проверить логи
sudo /usr/local/bin/docker logs whatsapp-server --tail=20

# Проверить эндпоинты
curl -i http://localhost:3002/health
curl -i http://localhost:3002/api/whatsapp/status
```
