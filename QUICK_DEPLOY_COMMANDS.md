# БЫСТРАЯ ШПАРГАЛКА: Команды для деплоя

## 🔍 ДИАГНОСТИКА (VPS)

```bash
# Порты
ss -lntp | grep -E ':(3000|3001|3002|3003)'

# Существующие конфиги
sudo ls -la /etc/nginx/sites-enabled/
sudo grep -r 'server_name' /etc/nginx/sites-enabled/ | grep -v '#'

# VPN IP Synology
ip route | grep '10.8.0'
# Обычно: 10.8.0.1
```

---

## 🐳 SYNOLOGY: Обновление контейнера

```bash
cd /volume1/docker/whatsapp-server
sudo docker-compose -f docker-compose.synology.yml down
sudo docker-compose -f docker-compose.synology.yml up -d --build
sudo ss -lntp | grep 3002
```

---

## ⚙️ VPS: Создание Nginx конфига

```bash
# Скопируйте api-2wix-whatsapp-PORT3002.conf на VPS
# Или создайте вручную:
sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf
# Вставьте содержимое, замените 10.8.0.1 на реальный VPN IP если нужно

sudo ln -sf /etc/nginx/sites-available/api-2wix-whatsapp.conf /etc/nginx/sites-enabled/api-2wix-whatsapp.conf
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ ПРОВЕРКИ

```bash
# ACME (должен быть 200)
echo 'test' | sudo tee /var/www/html/.well-known/acme-challenge/test
curl -I http://api.2wix.ru/.well-known/acme-challenge/test

# Synology через VPN (замените IP!)
curl -I http://10.8.0.1:3002/health

# Старые проекты (должны работать)
curl -I http://localhost:3000
curl -I http://localhost:3001
```

---

## 🔒 SSL (после проверки ACME)

```bash
sudo certbot --nginx -d api.2wix.ru
curl -I https://api.2wix.ru/health
```
