# 🚀 Trading Info - Production Deployment Guide

Complete guide for deploying the Trading Info application with **Docker Backend** + **NPM Frontend**.

## 📋 Prerequisites

- **Server with Docker & Docker Compose**
- **Node.js 18+ & NPM** (for frontend)
- **Domain/IP address** for your server
- **Telegram Bot Token** (from @BotFather)

## 🐳 Backend Deployment (Docker)

### 1. Prepare Environment

```bash
cd /path/to/trading-info-backend

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 2. Configure Environment Variables (.env)

```bash
# Database Configuration
POSTGRES_PASSWORD=your_strong_postgres_password

# Redis Configuration
REDIS_PASSWORD=your_strong_redis_password

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHANNEL_ID=@DailyTradiBlog
TELEGRAM_ADMIN_IDS=123456789,987654321

# JWT Configuration (generate strong 32+ char secret)
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long
```

### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f trading-info-backend
```

### 4. Verify Backend

```bash
# Test health endpoint
curl http://localhost:8080/actuator/health

# Test API
curl http://localhost:8080/lessons/structure
```

## 📦 Frontend Deployment (NPM)

### 1. Prepare Frontend

```bash
cd /path/to/trading-info

# Install dependencies
npm run install-client
```

### 2. Configure Production Environment

Update `client/.env.production`:
```bash
# Production API Configuration - Backend runs on port 8080
REACT_APP_API_URL=http://your-server-ip:8080
REACT_APP_NODE_ENV=production

# Telegram Web App Configuration
REACT_APP_TELEGRAM_BOT_USERNAME=your_bot_username

# Production optimizations
GENERATE_SOURCEMAP=false
BUILD_PATH=build
```

### 3. Build & Deploy Frontend

```bash
# Build the React application
npm run build

# Serve the built application (option 1)
npm run serve

# OR use nginx/apache (option 2)
# Copy client/build/* to your web server directory
```

## 🔧 Production Server Setup

### Complete Deployment Script

```bash
#!/bin/bash
# Production deployment script

echo "🚀 Starting production deployment..."

# 1. Deploy Backend with Docker
cd /path/to/trading-info-backend
docker-compose up -d --build

# 2. Deploy Frontend with NPM
cd /path/to/trading-info
npm run install-client
npm run build

# 3. Start frontend server (or configure nginx)
npm run serve &

echo "✅ Deployment completed!"
echo "Backend: http://your-server:8080"
echo "Frontend: http://your-server:3000"
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   React + NPM   │───▶│   Spring Boot   │───▶│   PostgreSQL    │
│   Port: 3000    │    │   Docker        │    │   Docker        │
│                 │    │   Port: 8080    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Cache         │    │   Telegram      │
                       │   Redis         │    │   Bot API       │
                       │   Docker        │    │   External      │
                       │   Port: 6379    │    │                 │
                       └─────────────────┘    └─────────────────┘
```

## 📊 Port Configuration

| Service    | Port | Protocol | Description                |
|------------|------|----------|----------------------------|
| Frontend   | 3000 | HTTP     | React development server   |
| Backend    | 8080 | HTTP     | Spring Boot REST API       |
| PostgreSQL | 5432 | TCP      | Database                   |
| Redis      | 6379 | TCP      | Cache                      |

## 🔐 Security Considerations

### Environment Variables
- **Never commit .env files**
- Use strong passwords (16+ characters)
- Rotate JWT secrets regularly

### Network Security
```bash
# Configure firewall (example with ufw)
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 8080/tcp  # Backend API
sudo ufw deny 5432/tcp   # PostgreSQL (internal only)
sudo ufw deny 6379/tcp   # Redis (internal only)
```

### SSL/TLS Setup (Recommended)
```bash
# Use nginx as reverse proxy with SSL
server {
    listen 443 ssl;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
    }

    # API
    location /api {
        proxy_pass http://localhost:8080;
    }
}
```

## 🚨 Troubleshooting

### Backend Issues
```bash
# Check container logs
docker-compose logs trading-info-backend

# Check database connection
docker-compose exec postgres psql -U postgres -d trading_info -c "\\dt"

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Frontend Issues
```bash
# Check build errors
npm run build

# Test API connectivity
curl http://localhost:8080/actuator/health

# Check React app logs
npm run serve
```

### Common Problems

1. **Port conflicts**: Change ports in docker-compose.yml
2. **Environment variables**: Verify all required variables are set
3. **Database connection**: Check PostgreSQL is running
4. **CORS errors**: Verify frontend URL in backend CORS config

## 📈 Monitoring & Maintenance

### Health Checks
```bash
# Backend health
curl http://localhost:8080/actuator/health

# Database health
docker-compose exec postgres pg_isready

# Redis health
docker-compose exec redis redis-cli ping
```

### Backup
```bash
# Database backup
docker-compose exec postgres pg_dump -U postgres trading_info > backup.sql

# Volume backup
docker run --rm -v trading-info-backend_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz /data
```

### Updates
```bash
# Update backend
cd trading-info-backend
git pull
docker-compose build --no-cache
docker-compose up -d

# Update frontend
cd trading-info
git pull
npm run install-client
npm run build
# Restart frontend service
```

## ✅ Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Telegram bot created and configured
- [ ] Domain/SSL certificates ready
- [ ] Server resources adequate (2GB+ RAM recommended)

### Backend Deployment
- [ ] Docker & Docker Compose installed
- [ ] .env file configured
- [ ] Database migrations ready
- [ ] Health checks passing

### Frontend Deployment
- [ ] Node.js & NPM installed
- [ ] Production environment configured
- [ ] Build process successful
- [ ] API connectivity verified

### Post-deployment
- [ ] All services running
- [ ] Health checks passing
- [ ] Telegram notifications working
- [ ] Frontend can connect to backend
- [ ] File uploads working
- [ ] Database queries working

---

## 🆘 Support

For issues or questions:
1. Check logs for specific error messages
2. Verify all environment variables
3. Test individual components
4. Check network connectivity between services

**Happy Deploying! 🎉**