# 🔧 Ручное исправление конфига для Certbot

## 🚨 Проблема

Конфиг nginx не обрабатывает ACME challenge правильно - все еще редирект 301.

## ✅ Решение

Нужно вручную отредактировать конфиг на сервере:

```bash
ssh shortsai-vps
sudo nano /etc/nginx/sites-available/api-2wix-whatsapp.conf
```

### Изменить HTTP server block:

**Было:**
```nginx
location /.well-known/acme-challenge/ {
    root /var/www/html;
}
```

**Должно быть (вариант 1 - с приоритетом):**
```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/html;
    allow all;
}
```

**Или (вариант 2 - exact match для теста):**
```nginx
location = /.well-known/acme-challenge/test {
    root /var/www/html;
}

location ^~ /.well-known/acme-challenge/ {
    root /var/www/html;
}
```

### После редактирования:

```bash
sudo nginx -t
sudo systemctl reload nginx

# Проверить
echo 'test' | sudo tee /var/www/html/.well-known/acme-challenge/test
curl http://api.2wix.ru/.well-known/acme-challenge/test
# Должен вернуть "test", а не редирект 301
```

---

## ⚠️ Также нужно обновить DNS

DNS все еще возвращает два IP:
- `35.194.39.8` (старый)
- `159.255.37.158` (текущий)

**Нужно:**
1. Обновить DNS A-запись для `api.2wix.ru`
2. Удалить `35.194.39.8`
3. Оставить только `159.255.37.158`
4. Подождать 5-10 минут

---

## 📋 После исправления

```bash
sudo certbot --nginx -d api.2wix.ru
```

---

**Дата:** 2026-01-08
