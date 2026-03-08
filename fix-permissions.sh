#!/bin/bash
# Скрипт для исправления прав доступа WhatsApp на Synology

cd /volume1/docker/whatsapp-server

echo "🔧 Исправление прав доступа для WhatsApp..."

# Создать директории если не существуют
echo "📁 Создание директорий..."
sudo mkdir -p .wwebjs_auth
sudo mkdir -p .wwebjs_cache
sudo mkdir -p data

# Выдать права (adminv:users - текущий владелец, 775 - чтение/запись для владельца и группы)
echo "🔐 Настройка прав доступа..."
sudo chown -R adminv:users .wwebjs_auth
sudo chown -R adminv:users .wwebjs_cache
sudo chown -R adminv:users data

sudo chmod -R 775 .wwebjs_auth
sudo chmod -R 775 .wwebjs_cache
sudo chmod -R 775 data

# Проверить права
echo "✅ Проверка прав:"
ls -la | grep -E "wwebjs|data"

echo "✅ Права настроены!"
echo "📋 Следующий шаг: пересобрать контейнер"
echo "   sudo ./deploy.sh"
