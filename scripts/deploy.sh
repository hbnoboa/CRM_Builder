#!/bin/bash

# ==============================================
# CRM Builder - Deploy Script
# ==============================================

set -e

cd /home/hbnoboa11/crm-builder

echo "🚀 Starting deployment..."

# 1. Pull latest changes (if using git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main || true
fi

# 2. Update dependencies
echo "📦 Updating dependencies..."
pnpm install

# 3. Run Prisma migrations
echo "🗄️  Running database migrations..."
cd apps/api
npx prisma db push
cd ../..

# 4. Build and deploy containers
echo "🔨 Building containers..."
docker compose -f docker-compose.prod.yml build api web

echo "🚢 Deploying containers..."
docker compose -f docker-compose.prod.yml up -d api web

# 5. Health check
echo "⏳ Waiting for services to be healthy..."
sleep 10

echo "🔍 Checking services..."
docker compose -f docker-compose.prod.yml ps

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Service status:"
curl -s http://localhost/api/v1/health || echo "API health check failed"
echo ""
