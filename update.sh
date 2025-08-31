#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 H.E.A.R.T v1.0.25 - Updating...${NC}"

# Change to app directory
cd ~/trading-info

# Fix permissions for all shell scripts (prevent permission denied errors)
echo -e "${BLUE}🔧 Fixing shell script permissions...${NC}"
chmod +x *.sh 2>/dev/null || true

# Function to check if process is running
check_process() {
    pgrep -f "node.*server.js" > /dev/null 2>&1
}

# Stop current process more reliably
echo -e "${YELLOW}⏹️  Stopping current process...${NC}"
if check_process; then
    echo "Found running node process, stopping..."
    pkill -f "node.*server.js" || true
    sleep 3
    
    # Force kill if still running
    if check_process; then
        echo "Process still running, force killing..."
        pkill -9 -f "node.*server.js" || true
        sleep 2
    fi
    echo "✅ Process stopped"
else
    echo "No running process found"
fi

# Backup current version (optional)
echo -e "${BLUE}💾 Creating backup...${NC}"
if [ -f "server.js" ]; then
    cp server.js "server.js.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
fi

# Pull latest changes
echo -e "${BLUE}📥 Pulling latest changes...${NC}"
git fetch origin
git reset --hard origin/master
git clean -fd

# Check if package.json changed
PACKAGE_CHANGED=false
if git diff HEAD~1 package.json > /dev/null 2>&1; then
    if ! git diff --quiet HEAD~1 package.json; then
        PACKAGE_CHANGED=true
    fi
fi

# Install dependencies (only if package.json changed or node_modules missing)
if [ "$PACKAGE_CHANGED" = true ] || [ ! -d "node_modules" ]; then
    echo -e "${BLUE}🔧 Installing dependencies...${NC}"
    npm ci --production --silent
else
    echo "📦 Dependencies up to date, skipping install"
fi

# Build frontend if needed
if [ -d "client" ] && [ -f "client/package.json" ]; then
    echo -e "${BLUE}🏗️  Building frontend...${NC}"
    cd client
    
    # Check if client dependencies need update
    CLIENT_PACKAGE_CHANGED=false
    if git diff HEAD~1 client/package.json > /dev/null 2>&1; then
        if ! git diff --quiet HEAD~1 client/package.json; then
            CLIENT_PACKAGE_CHANGED=true
        fi
    fi
    
    if [ "$CLIENT_PACKAGE_CHANGED" = true ] || [ ! -d "node_modules" ]; then
        npm ci --silent
    fi
    
    # Build only if source files changed or build doesn't exist
    if [ ! -d "build" ] || [ -n "$(find src -newer build -print -quit 2>/dev/null)" ]; then
        npm run build
        echo "✅ Frontend built successfully"
    else
        echo "📦 Frontend build up to date"
    fi
    
    cd ..
fi

# Test configuration
echo -e "${BLUE}🔍 Testing configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Creating .env from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please configure your .env file before starting${NC}"
    else
        echo -e "${RED}❌ .env.example also not found!${NC}"
        exit 1
    fi
fi

# Test database connection (optional)
if command -v psql >/dev/null 2>&1; then
    echo -e "${BLUE}🔍 Testing database connection...${NC}"
    if ! timeout 5 node -e "
        require('dotenv').config();
        const { Pool } = require('pg');
        const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'trading_info',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD
        });
        pool.query('SELECT 1').then(() => {
            console.log('✅ Database connection successful');
            pool.end();
        }).catch(err => {
            console.log('⚠️  Database connection failed:', err.message);
            pool.end();
        });
    " 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Database connection test failed (app will use file fallback)${NC}"
    fi
fi

# Start application
echo -e "${GREEN}🚀 Starting application...${NC}"

# Create logs directory
mkdir -p logs

# Start with better process management
nohup node server.js > logs/app.log 2>&1 &
APP_PID=$!

# Wait a moment and check if app started successfully
sleep 3
if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ Application started successfully (PID: $APP_PID)"
    echo $APP_PID > app.pid
    
    # Test if app is responding
    sleep 2
    if curl -f -s http://localhost:3001/api/lessons/structure >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Application is responding to requests${NC}"
    else
        echo -e "${YELLOW}⚠️  Application started but not responding yet (may need more time)${NC}"
    fi
else
    echo -e "${RED}❌ Application failed to start${NC}"
    echo "Check logs: tail -f logs/app.log"
    exit 1
fi

echo -e "${GREEN}✅ Update completed!${NC}"
echo -e "${BLUE}🌐 App available at: https://heart-trader.duckdns.org${NC}"
echo -e "${BLUE}📋 View logs: tail -f ~/trading-info/logs/app.log${NC}"
echo -e "${BLUE}🔍 Process ID: $APP_PID (saved to app.pid)${NC}"
echo -e "${BLUE}🛑 To stop: kill \$(cat ~/trading-info/app.pid)${NC}"