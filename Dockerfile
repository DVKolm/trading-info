# Multi-stage build для оптимизации размера образа

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Копируем package files для кэширования зависимостей
COPY client/package*.json ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для react-scripts)
RUN npm ci --no-audit --no-fund

# Копируем исходный код фронтенда
COPY client/ .

# Собираем production build
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Копируем package files для бэкенда
COPY package*.json ./

# Устанавливаем только production зависимости для бэкенда
RUN npm ci --omit=dev --no-audit --no-fund --prefer-offline && \
    npm cache clean --force

# Копируем исходный код сервера
COPY server.js ./
COPY lessons/ ./lessons/

# Копируем собранный фронтенд из предыдущего stage
COPY --from=frontend-builder /app/client/build ./client/build

# Меняем владельца файлов
RUN chown -R nextjs:nodejs /app
USER nextjs

# Открываем порт
EXPOSE 3001

# Проверка здоровья приложения
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/lessons/structure', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Запуск приложения
CMD ["node", "server.js"]