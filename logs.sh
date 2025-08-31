#!/bin/bash

# Colors for output
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📋 H.E.A.R.T Application Logs${NC}"

cd ~/trading-info

# Function to show logs
show_logs() {
    if [ -f "logs/app.log" ]; then
        tail -f logs/app.log
    elif [ -f "app.log" ]; then
        tail -f app.log
    else
        echo "No log file found. Looking for running process..."
        if pgrep -f "node.*server.js" > /dev/null; then
            echo "Process is running but no log file found."
            echo "The application might be running in foreground or logging elsewhere."
        else
            echo "No log file and no running process found."
        fi
    fi
}

# Check for parameters
case "${1:-}" in
    -f|--follow)
        echo "Following logs (Ctrl+C to stop)..."
        show_logs
        ;;
    -n|--lines)
        LINES=${2:-50}
        echo "Showing last $LINES lines..."
        if [ -f "logs/app.log" ]; then
            tail -n $LINES logs/app.log
        elif [ -f "app.log" ]; then
            tail -n $LINES app.log
        else
            echo "No log file found"
        fi
        ;;
    -h|--help)
        echo "Usage: ./logs.sh [options]"
        echo ""
        echo "Options:"
        echo "  -f, --follow     Follow log output (default)"
        echo "  -n, --lines N    Show last N lines"
        echo "  -h, --help       Show this help"
        ;;
    *)
        echo "Following logs (Ctrl+C to stop)..."
        show_logs
        ;;
esac