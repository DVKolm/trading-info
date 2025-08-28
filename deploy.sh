#!/bin/bash

# H.E.A.R.T Trading Academy - Deploy Script
# Скрипт для деплоя приложения на сервер

set -e  # Остановить выполнение при ошибке

echo "🚀 Starting H.E.A.R.T Trading Academy deployment..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Проверка необходимых инструментов
check_requirements() {
    log "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    info "✅ All requirements satisfied"
}

# Создание необходимых директорий
setup_directories() {
    log "Setting up directories..."
    
    mkdir -p logs/nginx
    mkdir -p nginx/ssl
    
    info "✅ Directories created"
}

# Остановка старых контейнеров
stop_old_containers() {
    log "Stopping old containers..."
    
    docker-compose down --remove-orphans || true
    
    # Очистка неиспользуемых образов
    docker system prune -f || true
    
    info "✅ Old containers stopped"
}

# Сборка и запуск
build_and_deploy() {
    log "Building and deploying application..."
    
    # Сборка образов
    docker-compose build --no-cache
    
    # Запуск сервисов
    docker-compose up -d
    
    info "✅ Application deployed"
}

# Проверка здоровья приложения
health_check() {
    log "Performing health check..."
    
    # Ожидание запуска
    sleep 10
    
    # Проверка статуса контейнеров
    if ! docker-compose ps | grep "Up" > /dev/null; then
        error "Some containers are not running properly"
        docker-compose logs
        exit 1
    fi
    
    # Проверка HTTP ответа
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/api/lessons/structure > /dev/null 2>&1; then
            log "✅ Application is healthy and responding"
            return 0
        fi
        
        info "Attempt $attempt/$max_attempts - waiting for application..."
        sleep 5
        ((attempt++))
    done
    
    error "Health check failed - application is not responding"
    docker-compose logs trading-app
    exit 1
}

# Показать информацию о деплое
show_deployment_info() {
    log "Deployment completed successfully! 🎉"
    
    echo ""
    echo "📊 Container Status:"
    docker-compose ps
    
    echo ""
    echo "🌐 Access URLs:"
    echo "   • Application: http://localhost"
    echo "   • Direct API:  http://localhost:3001"
    
    echo ""
    echo "📋 Useful Commands:"
    echo "   • View logs:     docker-compose logs -f"
    echo "   • Restart:       docker-compose restart"
    echo "   • Stop:          docker-compose down"
    echo "   • Update:        ./deploy.sh"
    
    echo ""
    echo "🔧 SSL Setup (optional):"
    echo "   1. Get SSL certificate (Let's Encrypt recommended)"
    echo "   2. Place cert.pem and key.pem in nginx/ssl/"
    echo "   3. Uncomment HTTPS section in nginx/nginx.conf"
    echo "   4. Restart: docker-compose restart nginx"
}

# Главная функция
main() {
    info "🎯 H.E.A.R.T Trading Academy Deployment"
    info "========================================"
    
    check_requirements
    setup_directories
    stop_old_containers
    build_and_deploy
    health_check
    show_deployment_info
    
    log "🚀 Deployment completed successfully!"
}

# Запуск скрипта
main "$@"