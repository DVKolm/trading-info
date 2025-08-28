# 🚀 H.E.A.R.T Trading Academy - Docker Deployment Guide

Полное руководство по развертыванию приложения на собственном сервере с использованием Docker.

## 📋 Требования

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Минимум 1GB RAM**
- **Минимум 5GB свободного места**
- **Открытые порты:** 80, 443 (опционально 3001 для отладки)

## ⚡ Быстрый деплой

### 1. Подготовка сервера

```bash
# Обновление системы (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install docker-compose-plugin

# Перезагрузка для применения изменений
sudo reboot
```

### 2. Загрузка проекта

```bash
# Клонирование репозитория
git clone <your-repository-url> trading-info
cd trading-info

# Или загрузка архива
wget <archive-url> -O trading-info.zip
unzip trading-info.zip
cd trading-info
```

### 3. Деплой одной командой

```bash
# Сделать скрипт исполняемым
chmod +x deploy.sh

# Запустить деплой
./deploy.sh
```

## 🔧 Ручная настройка

### 1. Настройка окружения

```bash
# Создать файл окружения (опционально)
cp .env.example .env.production

# Отредактировать переменные
nano .env.production
```

### 2. Настройка Nginx

```bash
# Отредактировать конфигурацию Nginx
nano nginx/nginx.conf

# Заменить 'your-domain.com' на ваш домен
sed -i 's/your-domain.com/example.com/g' nginx/nginx.conf
```

### 3. Сборка и запуск

```bash
# Сборка образов
docker-compose build

# Запуск в фоновом режиме
docker-compose up -d

# Просмотр статуса
docker-compose ps
```

## 🔒 SSL/HTTPS настройка

### Вариант 1: Let's Encrypt (бесплатно)

```bash
# Установка Certbot
sudo apt install certbot

# Получение сертификата
sudo certbot certonly --standalone -d your-domain.com

# Копирование сертификатов
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Настройка прав доступа
sudo chown $USER:$USER nginx/ssl/*.pem
```

### Вариант 2: Самоподписанный сертификат

```bash
# Создание самоподписанного сертификата (только для тестирования)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

### 3. Активация HTTPS

```bash
# Раскомментировать HTTPS секцию в nginx.conf
nano nginx/nginx.conf

# Перезапустить Nginx
docker-compose restart nginx
```

## 🛠️ Управление приложением

### Основные команды

```bash
# Просмотр статуса контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f trading-app
docker-compose logs -f nginx

# Перезапуск сервисов
docker-compose restart

# Остановка
docker-compose down

# Обновление (после изменений в коде)
docker-compose build --no-cache
docker-compose up -d
```

### Мониторинг

```bash
# Использование ресурсов
docker stats

# Размер образов
docker images

# Очистка неиспользуемых ресурсов
docker system prune -f
```

## 🔍 Отладка проблем

### Проверка работы приложения

```bash
# Тест API
curl http://localhost:3001/api/lessons/structure

# Тест через Nginx
curl http://localhost/api/lessons/structure

# Проверка портов
netstat -tlnp | grep -E ":80|:443|:3001"
```

### Частые проблемы

1. **Контейнер не запускается:**
   ```bash
   docker-compose logs trading-app
   # Проверить ошибки в логах
   ```

2. **Нет доступа по HTTP:**
   ```bash
   # Проверить firewall
   sudo ufw status
   sudo ufw allow 80
   sudo ufw allow 443
   ```

3. **SSL не работает:**
   ```bash
   # Проверить сертификаты
   ls -la nginx/ssl/
   # Проверить конфигурацию nginx
   docker-compose exec nginx nginx -t
   ```

## 📊 Автоматическое обновление

### Настройка Watchtower (опционально)

```bash
# Запуск с автообновлением
docker-compose --profile autoupdate up -d

# Ручное обновление образов
docker-compose pull
docker-compose up -d
```

## 🔄 CI/CD интеграция

### GitHub Actions пример

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Deploy via SSH
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /path/to/trading-info
          git pull origin main
          ./deploy.sh
```

## 📈 Масштабирование

### Horizontal scaling

```bash
# Запуск нескольких инстансов приложения
docker-compose up -d --scale trading-app=3
```

### Resource limits

```yaml
# В docker-compose.yml
services:
  trading-app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## 🆘 Поддержка

### Логи и мониторинг

- **Логи приложения:** `docker-compose logs trading-app`
- **Логи Nginx:** `docker-compose logs nginx`
- **Системные ресурсы:** `docker stats`

### Backup

```bash
# Backup уроков
tar -czf lessons-backup-$(date +%Y%m%d).tar.gz lessons/

# Backup конфигурации
tar -czf config-backup-$(date +%Y%m%d).tar.gz nginx/ docker-compose.yml
```

---

## ✅ Чеклист после деплоя

- [ ] Приложение доступно по HTTP
- [ ] API отвечает на запросы
- [ ] SSL настроен (если требуется)
- [ ] Firewall настроен
- [ ] Backup стратегия определена
- [ ] Мониторинг настроен
- [ ] Домен настроен (если есть)

**🎉 Поздравляем! Ваше приложение H.E.A.R.T Trading Academy успешно развернуто!**