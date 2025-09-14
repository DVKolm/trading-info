# Development Environment Setup Guide

## Prerequisites
- Java 21 (OpenJDK or Oracle JDK)
- Node.js 16+ with npm
- PostgreSQL 12+
- Redis 6+ (optional but recommended for caching)
- Git (already installed)

## Step 1: Database Setup

1. **Install PostgreSQL** (if not already installed):
   - Download from https://www.postgresql.org/download/
   - Or use existing PostgreSQL installation

2. **Create Database**:
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres

   -- Run the setup script:
   \i C:/Users/IVA-PC/WebstormProjects/setup-database.sql
   ```

3. **Verify Database**:
   ```bash
   psql -U trading_user -d trading_info
   \dt  # Should show empty (tables will be created by Spring Boot)
   ```

## Step 2: Redis Setup (Optional)

1. **Install Redis**:
   - **Windows**: Download from https://github.com/microsoftarchive/redis/releases
   - **Docker**: `docker run --name redis -p 6379:6379 -d redis:7-alpine`
   - **WSL**: `sudo apt install redis-server`

2. **Start Redis**:
   ```bash
   # Windows service or Docker container
   redis-server

   # Test connection
   redis-cli ping  # Should return PONG
   ```

3. **Redis is optional**: Backend works without Redis, but caching improves performance

## Step 3: Backend Setup

1. **Navigate to backend folder**:
   ```bash
   cd C:/Users/IVA-PC/WebstormProjects/trading-info-backend
   ```

2. **Check Java version**:
   ```bash
   java -version  # Should be Java 21
   ```

3. **Build the project**:
   ```bash
   ./gradlew clean build
   ```

4. **Run the backend**:
   ```bash
   ./gradlew bootRun
   ```

   Backend will start on: http://localhost:3001

## Step 3: Frontend Setup

1. **Navigate to frontend folder**:
   ```bash
   cd C:/Users/IVA-PC/WebstormProjects/trading-info
   ```

2. **Install dependencies**:
   ```bash
   npm install-client
   ```

3. **Start development server**:
   ```bash
   npm start
   ```

   Frontend will start on: http://localhost:3000

## Step 4: Verification Tests

### Backend API Tests:
```bash
# Test lessons structure
curl http://localhost:3001/api/lessons/structure

# Test lesson folders
curl http://localhost:3001/api/lessons/folders

# Test subscription status
curl http://localhost:3001/api/subscription/status/123456789

# Test image serving (after adding some images)
curl http://localhost:3001/api/image/test.png
```

### Frontend Tests:
1. Open http://localhost:3000
2. Check console for API connection errors
3. Try accessing admin panel (if you have admin credentials)
4. Test lesson viewing functionality

## Step 5: Admin Panel Testing

1. **Access Admin Panel**:
   - Frontend should detect Telegram user ID
   - Admin access is hardcoded for IDs: 781182099, 5974666109

2. **Upload Test Lesson**:
   - Create a test .md file
   - Upload via admin panel
   - Verify it appears in lesson structure

3. **Test Image Serving**:
   - Add images to lessons folder or uploads/
   - Reference them in Markdown: `![image](image.png)`
   - Verify they load in lesson viewer

## Common Issues & Solutions

### Backend Issues:
- **Port 3001 in use**: Stop existing Node.js server
- **Database connection failed**: Check PostgreSQL is running
- **Build errors**: Ensure Java 21 is installed

### Frontend Issues:
- **API connection failed**: Ensure backend is running on 3001
- **CORS errors**: Backend has CORS configured for localhost:3000
- **Admin access denied**: Check Telegram user ID in logs

## Environment Variables

### Backend (.env or application properties):
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/trading_info
spring.datasource.username=trading_user
spring.datasource.password=Ke5zrdsf
telegram.bot.token=8453388495:AAGcNlP0GuFLQH49Kh4xzR831SQC_o5LrQw
```

### Frontend (client/.env):
```bash
REACT_APP_API_URL=http://localhost:3001
```

## Production Deployment Notes

When ready to deploy to your server (5.129.241.61):

1. **Backend**: Use `application-prod.properties` profile
2. **Frontend**: Build with `npm run build` and serve static files
3. **Database**: Use production PostgreSQL credentials
4. **Environment**: Set `NODE_ENV=production`