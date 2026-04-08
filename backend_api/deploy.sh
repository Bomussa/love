#!/bin/bash
# Deployment Script for love-api
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /var/www/love-api

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Restart PM2 processes
echo "🔄 Restarting PM2 processes..."
pm2 restart ecosystem.config.js --env production

# Save PM2 process list
echo "💾 Saving PM2 process list..."
pm2 save

# Health check
echo "🏥 Running health check..."
sleep 3
curl -s http://localhost:3000/health | jq .

echo "✅ Deployment completed successfully!"
