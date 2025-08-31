#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 H.E.A.R.T Application Status${NC}"
echo "================================="

cd ~/trading-info

# Check if process is running
if [ -f "app.pid" ]; then
    PID=$(cat app.pid)
    if kill -0 $PID 2>/dev/null; then
        echo -e "Status: ${GREEN}✅ Running${NC} (PID: $PID)"
        
        # Get process info
        if command -v ps >/dev/null; then
            echo "Process info:"
            ps -p $PID -o pid,ppid,cmd,etime,pcpu,pmem 2>/dev/null || echo "Cannot get process info"
        fi
        
        # Check if app is responding
        echo -n "Health check: "
        if curl -f -s http://localhost:3001/api/lessons/structure >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Responding${NC}"
        else
            echo -e "${RED}❌ Not responding${NC}"
        fi
        
        # Check memory usage
        if command -v free >/dev/null; then
            echo ""
            echo "System memory:"
            free -h
        fi
        
    else
        echo -e "Status: ${RED}❌ Not running${NC} (stale PID file)"
        rm -f app.pid
    fi
else
    # Check if process exists without PID file
    if pgrep -f "node.*server.js" > /dev/null; then
        FOUND_PID=$(pgrep -f "node.*server.js")
        echo -e "Status: ${YELLOW}⚠️  Running without PID file${NC} (PID: $FOUND_PID)"
        echo $FOUND_PID > app.pid
    else
        echo -e "Status: ${RED}❌ Not running${NC}"
    fi
fi

echo ""

# Check log file size
if [ -f "logs/app.log" ]; then
    LOG_SIZE=$(du -h logs/app.log 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")
    echo "Log file size: $LOG_SIZE"
    echo "Recent log entries:"
    echo "==================="
    tail -10 logs/app.log 2>/dev/null || echo "Cannot read log file"
elif [ -f "app.log" ]; then
    LOG_SIZE=$(du -h app.log 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")
    echo "Log file size: $LOG_SIZE"
    echo "Recent log entries:"
    echo "==================="
    tail -10 app.log 2>/dev/null || echo "Cannot read log file"
else
    echo "No log file found"
fi

echo ""

# Check disk space
echo "Disk usage:"
df -h . 2>/dev/null || echo "Cannot get disk info"

echo ""

# Quick git info
if [ -d ".git" ]; then
    echo "Git info:"
    echo "Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
    echo "Last commit: $(git log -1 --pretty=format:'%h %s (%cr)' 2>/dev/null || echo 'unknown')"
fi