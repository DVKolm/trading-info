#!/bin/bash

# Update script for H.E.A.R.T Trading Academy

echo "🔄 Updating H.E.A.R.T Trading Academy..."

# Pull latest changes
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes from Git..."
    git pull origin main
else
    echo "⚠️  Not a Git repository. Please update files manually."
fi

# Rebuild and restart
echo "🔨 Rebuilding containers..."
docker-compose build --no-cache

echo "🚀 Restarting services..."
docker-compose up -d

# Health check
echo "🏥 Performing health check..."
sleep 10

if curl -f http://localhost:3001/api/lessons/structure > /dev/null 2>&1; then
    echo "✅ Update completed successfully!"
else
    echo "❌ Health check failed. Check logs: docker-compose logs"
    exit 1
fi