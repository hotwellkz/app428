#!/bin/bash
# Скрипт для обновления nginx конфига фронтенда 2wix.ru

set -e

echo "🔍 Ищем конфиг для 2wix.ru..."
FRONTEND_CONFIG=$(sudo find /etc/nginx -name "*2wix*" -o -name "*default*" | grep -v api | head -1)

if [ -z "$FRONTEND_CONFIG" ]; then
    echo "❌ Конфиг для 2wix.ru не найден!"
    echo "Доступные конфиги:"
    sudo ls -la /etc/nginx/sites-available/
    exit 1
fi

echo "✅ Найден конфиг: $FRONTEND_CONFIG"

# Проверяем, что файл с location блоками существует
if [ ! -f "/tmp/nginx-2wix-frontend.conf" ]; then
    echo "❌ Файл /tmp/nginx-2wix-frontend.conf не найден!"
    echo "Сначала загрузите файл на сервер:"
    echo "  scp nginx-2wix-frontend.conf root@SERVER:/tmp/"
    exit 1
fi

echo "📝 Создаем backup..."
sudo cp "$FRONTEND_CONFIG" "${FRONTEND_CONFIG}.backup.$(date +%Y%m%d-%H%M%S)"

echo "📋 Извлекаем location блоки из /tmp/nginx-2wix-frontend.conf..."
# Извлекаем только location блоки (убираем комментарии и пустые строки в начале)
LOCATION_BLOCKS=$(grep -v '^#' /tmp/nginx-2wix-frontend.conf | grep -v '^$' | sed '/^$/d' | sed '1,5d')

# Проверяем, есть ли уже эти location блоки
if grep -q "location /api/" "$FRONTEND_CONFIG"; then
    echo "⚠️  Location /api/ уже существует в конфиге"
    read -p "Заменить существующие location блоки? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Удаляем старые location блоки
        sudo sed -i '/location \/api\//,/^    }/d' "$FRONTEND_CONFIG"
        sudo sed -i '/location \/socket.io\//,/^    }/d' "$FRONTEND_CONFIG"
    else
        echo "❌ Отменено"
        exit 0
    fi
fi

echo "➕ Добавляем location блоки в конфиг..."
# Находим последний location блок или закрывающую скобку server {} и вставляем перед ней
if grep -q "}" "$FRONTEND_CONFIG"; then
    # Вставляем перед последней закрывающей скобкой server {}
    sudo sed -i '/^}$/i\
'"$LOCATION_BLOCKS"'
' "$FRONTEND_CONFIG"
else
    # Если нет закрывающей скобки, добавляем в конец
    echo "$LOCATION_BLOCKS" | sudo tee -a "$FRONTEND_CONFIG" > /dev/null
fi

echo "✅ Location блоки добавлены"

echo "🔍 Проверяем синтаксис nginx..."
if sudo nginx -t; then
    echo "✅ Синтаксис корректен"
    echo "🔄 Перезагружаем nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx перезагружен!"
    echo ""
    echo "📋 Проверьте конфиг:"
    echo "   sudo cat $FRONTEND_CONFIG"
else
    echo "❌ Ошибка синтаксиса! Восстанавливаем backup..."
    sudo cp "${FRONTEND_CONFIG}.backup.$(date +%Y%m%d-%H%M%S)" "$FRONTEND_CONFIG"
    exit 1
fi
