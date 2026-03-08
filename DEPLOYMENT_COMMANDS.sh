#!/bin/bash
# Скрипт для деплоя whatsapp-server с портом 3002
# Выполняйте команды по порядку

set -e

echo "=== ДЕПЛОЙ WHATSAPP-SERVER С ПОРТОМ 3002 ==="
echo ""

# ============================================
# ЧАСТЬ 1: ДИАГНОСТИКА НА VPS
# ============================================
echo "1. ДИАГНОСТИКА НА VPS"
echo "Выполните на VPS (shortsai-vps):"
echo ""
echo "# Проверка портов:"
echo "ss -lntp | grep -E ':(3000|3001|3002|3003)'"
echo ""
echo "# Проверка существующих конфигов (НЕ ТРОГАТЬ!):"
echo "sudo ls -la /etc/nginx/sites-enabled/"
echo "sudo grep -r 'server_name' /etc/nginx/sites-enabled/ | grep -v '#'"
echo ""
echo "# Проверка VPN маршрута:"
echo "ip route | grep '10.8.0'"
echo "ip addr show tun1 | grep 'inet '"
echo ""
echo "# Определите VPN IP Synology (обычно 10.8.0.1)"
echo ""
read -p "Нажмите Enter после выполнения диагностики на VPS..."

# ============================================
# ЧАСТЬ 2: ОБНОВЛЕНИЕ DOCKER-COMPOSE НА SYNOLOGY
# ============================================
echo ""
echo "2. ОБНОВЛЕНИЕ DOCKER-COMPOSE НА SYNOLOGY"
echo "Выполните на Synology:"
echo ""
echo "cd /volume1/docker/whatsapp-server"
echo "sudo docker-compose -f docker-compose.synology.yml down"
echo "sudo docker-compose -f docker-compose.synology.yml up -d --build"
echo "sudo ss -lntp | grep 3002"
echo ""
read -p "Нажмите Enter после обновления контейнера на Synology..."

# ============================================
# ЧАСТЬ 3: СОЗДАНИЕ NGINX КОНФИГА НА VPS
# ============================================
echo ""
echo "3. СОЗДАНИЕ NGINX КОНФИГА НА VPS"
echo ""
echo "На VPS выполните:"
echo ""
echo "# Скопируйте файл api-2wix-whatsapp-PORT3002.conf на VPS"
echo "# Или создайте вручную через nano"
echo ""
echo "sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf"
echo ""
echo "# Вставьте содержимое из api-2wix-whatsapp-PORT3002.conf"
echo "# ВАЖНО: Замените 10.8.0.1 на реальный VPN IP Synology!"
echo ""
echo "sudo ln -sf /etc/nginx/sites-available/api-2wix-whatsapp.conf /etc/nginx/sites-enabled/api-2wix-whatsapp.conf"
echo "sudo nginx -t"
echo "sudo systemctl reload nginx"
echo ""
read -p "Нажмите Enter после создания конфига на VPS..."

# ============================================
# ЧАСТЬ 4: ПРОВЕРКИ
# ============================================
echo ""
echo "4. ПРОВЕРКИ"
echo ""
echo "# На VPS выполните:"
echo ""
echo "# ACME challenge (должен вернуть 200):"
echo "echo 'test' | sudo tee /var/www/html/.well-known/acme-challenge/test"
echo "curl -I http://api.2wix.ru/.well-known/acme-challenge/test"
echo ""
echo "# Проверка доступности Synology через VPN:"
echo "curl -I http://10.8.0.1:3002/health"
echo ""
echo "# После certbot - проверка HTTPS:"
echo "curl -I https://api.2wix.ru/health"
echo "curl -I https://api.2wix.ru/whatsapp/status"
echo ""
echo "=== ГОТОВО ==="
