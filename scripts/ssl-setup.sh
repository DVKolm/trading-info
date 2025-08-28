#!/bin/bash

# SSL Setup script for H.E.A.R.T Trading Academy

DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@${DOMAIN}"}

if [ "$DOMAIN" = "your-domain.com" ]; then
    echo "Usage: ./ssl-setup.sh <domain> [email]"
    echo "Example: ./ssl-setup.sh example.com admin@example.com"
    exit 1
fi

echo "🔒 Setting up SSL for domain: ${DOMAIN}"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    sudo apt update
    sudo apt install -y certbot
fi

# Stop nginx temporarily
echo "⏸️  Stopping Nginx temporarily..."
docker-compose stop nginx

# Get certificate
echo "🔐 Obtaining SSL certificate..."
sudo certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    -d "${DOMAIN}"

if [ $? -eq 0 ]; then
    echo "✅ Certificate obtained successfully!"
    
    # Copy certificates
    echo "📋 Copying certificates..."
    sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "nginx/ssl/cert.pem"
    sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "nginx/ssl/key.pem"
    sudo chown $USER:$USER nginx/ssl/*.pem
    
    # Update nginx config
    echo "⚙️  Updating Nginx configuration..."
    sed -i "s/your-domain\.com/${DOMAIN}/g" nginx/nginx.conf
    sed -i 's/# \(.*ssl.*\)/\1/' nginx/nginx.conf
    sed -i 's/# \(.*443.*\)/\1/' nginx/nginx.conf
    
    # Restart services
    echo "🔄 Restarting services..."
    docker-compose up -d
    
    # Setup auto-renewal
    echo "🔄 Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    echo "🎉 SSL setup completed!"
    echo "Your site is now available at: https://${DOMAIN}"
else
    echo "❌ Failed to obtain SSL certificate"
    # Restart nginx even if SSL failed
    docker-compose start nginx
    exit 1
fi