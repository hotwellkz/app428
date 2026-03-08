# Команды для обновления nginx конфига фронтенда

## Вариант 1: Автоматический (рекомендуется)

### 1. Загрузите файлы на сервер:

```bash
# Загрузить конфиг с location блоками
scp nginx-2wix-frontend.conf root@YOUR_SERVER:/tmp/

# Загрузить скрипт обновления
scp update-nginx-frontend.sh root@YOUR_SERVER:/tmp/

# Подключиться к серверу
ssh root@YOUR_SERVER
```

### 2. На сервере выполните:

```bash
# Сделать скрипт исполняемым
chmod +x /tmp/update-nginx-frontend.sh

# Запустить скрипт
/tmp/update-nginx-frontend.sh
```

## Вариант 2: Ручной (через nano)

### 1. На сервере найдите конфиг для 2wix.ru:

```bash
sudo find /etc/nginx -name "*2wix*"
```

### 2. Откройте конфиг в nano:

```bash
sudo nano /etc/nginx/sites-available/<найденный_файл>
```

### 3. Добавьте location блоки из nginx-2wix-frontend.conf

Скопируйте содержимое location блоков (строки 8-70 из nginx-2wix-frontend.conf) и вставьте их внутрь `server {}` блока для 2wix.ru, перед закрывающей скобкой `}`.

### 4. Сохраните и выйдите из nano:

- `Ctrl+O` (сохранить)
- `Enter` (подтвердить)
- `Ctrl+X` (выйти)

### 5. Проверьте и перезагрузите:

```bash
# Проверить синтаксис
sudo nginx -t

# Если OK, перезагрузить
sudo systemctl reload nginx
```

## Вариант 3: Через sed (автоматическая вставка)

```bash
# 1. Найти конфиг
FRONTEND_CONFIG=$(sudo find /etc/nginx -name "*2wix*" | grep -v api | head -1)

# 2. Создать backup
sudo cp "$FRONTEND_CONFIG" "${FRONTEND_CONFIG}.backup"

# 3. Загрузить location блоки (без комментариев)
LOCATION_BLOCKS=$(cat nginx-2wix-frontend.conf | grep -v '^#' | grep -v '^$' | sed '1,5d')

# 4. Вставить перед последней }
sudo sed -i '/^}$/i\
'"$LOCATION_BLOCKS"'
' "$FRONTEND_CONFIG"

# 5. Проверить и перезагрузить
sudo nginx -t && sudo systemctl reload nginx
```
