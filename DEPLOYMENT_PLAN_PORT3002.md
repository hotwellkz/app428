# План деплоя whatsapp-server с портом 3002

## Архитектура

```
Internet → VPS (159.255.37.158) → VPN (10.8.0.1) → Synology:3002 → Container:3000
```

## ШАГ 1: Диагностика на VPS

Выполните на VPS (shortsai-vps):

```bash
# 1.1 Проверка портов
ss -lntp | grep -E ':(3000|3001|3002|3003)'

# 1.2 Проверка существующих конфигов (НЕ ТРОГАТЬ!)
sudo ls -la /etc/nginx/sites-enabled/
sudo grep -r 'server_name' /etc/nginx/sites-enabled/ | grep -v '#'

# 1.3 Проверка VPN маршрута до Synology
ip route | grep '10.8.0'
# Ожидаемый результат: VPN IP Synology обычно 10.8.0.1

# 1.4 Проверка текущего конфига api.2wix.ru
sudo cat /etc/nginx/sites-available/api-2wix-whatsapp.conf
ls -la /etc/nginx/sites-enabled/ | grep api-2wix
```

## ШАГ 2: Обновление docker-compose на Synology

На Synology нужно изменить `docker-compose.synology.yml`:

**БЫЛО:**
```yaml
expose:
  - "3000"
```

**СТАЛО:**
```yaml
ports:
  - "3002:3000"  # Публикуем порт 3002 на хосте -> 3000 в контейнере
```

**Команды на Synology:**
```bash
cd /volume1/docker/whatsapp-server
sudo nano docker-compose.synology.yml
# Измените expose на ports как показано выше

# Пересоздайте контейнер
sudo docker-compose -f docker-compose.synology.yml down
sudo docker-compose -f docker-compose.synology.yml up -d --build

# Проверьте что порт 3002 слушает
sudo netstat -tlnp | grep 3002
# или
sudo ss -lntp | grep 3002
```

## ШАГ 3: Создание Nginx конфига на VPS

**ВАЖНО:** Используйте VPN IP Synology (обычно 10.8.0.1, но проверьте!)

```bash
# На VPS
sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf
# Вставьте содержимое из файла api-2wix-whatsapp-PORT3002.conf
# ЗАМЕНИТЕ 10.8.0.1 на реальный VPN IP Synology если отличается!

# Создайте symlink (если еще нет)
sudo ln -sf /etc/nginx/sites-available/api-2wix-whatsapp.conf /etc/nginx/sites-enabled/api-2wix-whatsapp.conf

# Проверка синтаксиса
sudo nginx -t

# Перезагрузка (НЕ restart!)
sudo systemctl reload nginx
```

## ШАГ 4: Проверки

```bash
# 4.1 ACME challenge (должен вернуть 200, НЕ 301)
echo 'test' | sudo tee /var/www/html/.well-known/acme-challenge/test
curl -I http://api.2wix.ru/.well-known/acme-challenge/test
# Ожидается: HTTP/1.1 200 OK

# 4.2 Health check через HTTPS (после certbot)
curl -I https://api.2wix.ru/health
# Ожидается: HTTP/1.1 200 OK

# 4.3 WhatsApp status
curl -I https://api.2wix.ru/whatsapp/status
# Ожидается: HTTP/1.1 200 OK

# 4.4 WebSocket (проверка через браузер или wscat)
# Установите wscat: npm install -g wscat
# wscat -c wss://api.2wix.ru/socket.io/?EIO=4&transport=websocket
```

## ШАГ 5: SSL сертификат (после проверки ACME)

```bash
# Только после того как ACME challenge работает (200 OK)
sudo certbot --nginx -d api.2wix.ru

# Certbot автоматически:
# - Раскомментирует SSL директивы
# - Добавит ssl в listen
# - Настроит сертификаты
```

## Проверка что существующие проекты не затронуты

```bash
# Проверьте что старые конфиги на месте
sudo ls -la /etc/nginx/sites-enabled/
# Должны быть оба старых проекта + новый api-2wix-whatsapp.conf

# Проверьте что старые порты работают
curl -I http://localhost:3000  # Старый проект 1
curl -I http://localhost:3001  # Старый проект 2

# Проверьте что новые порты не заняты старыми проектами
ss -lntp | grep ':3002'
# Должен быть только на Synology, НЕ на VPS
```
