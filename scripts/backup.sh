#!/bin/bash

# Backup script for H.E.A.R.T Trading Academy

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="trading-info-backup-${DATE}"

echo "🔄 Creating backup: ${BACKUP_NAME}"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Create backup archive
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
    --exclude=node_modules \
    --exclude=client/node_modules \
    --exclude=client/build \
    --exclude=logs \
    --exclude=backups \
    lessons/ \
    nginx/ \
    package*.json \
    server.js \
    docker-compose.yml \
    Dockerfile

echo "✅ Backup created: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Keep only last 7 backups
cd ${BACKUP_DIR}
ls -t trading-info-backup-*.tar.gz | tail -n +8 | xargs -r rm

echo "🧹 Old backups cleaned up"