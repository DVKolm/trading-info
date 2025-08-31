#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⏹️  Stopping H.E.A.R.T application...${NC}"

cd ~/trading-info

# Check if PID file exists
if [ -f "app.pid" ]; then
    PID=$(cat app.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping process $PID..."
        kill $PID
        
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! kill -0 $PID 2>/dev/null; then
                echo -e "${GREEN}✅ Process stopped gracefully${NC}"
                rm -f app.pid
                exit 0
            fi
            sleep 1
        done
        
        # Force kill if still running
        echo "Forcing process termination..."
        kill -9 $PID 2>/dev/null || true
        rm -f app.pid
        echo -e "${GREEN}✅ Process terminated${NC}"
    else
        echo "PID file exists but process not running"
        rm -f app.pid
    fi
else
    # Fallback to pkill
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "No PID file, using pkill..."
        pkill -f "node.*server.js"
        sleep 2
        echo -e "${GREEN}✅ Process stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  No running process found${NC}"
    fi
fi