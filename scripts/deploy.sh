#!/bin/bash

# ==============================================
# CRM Builder - Deploy Script
# ==============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd /home/hbnoboa11/crm-builder

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Parse arguments
FORCE_REBUILD=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --force|-f) FORCE_REBUILD=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# 1. Pull latest changes
if [ -d ".git" ]; then
    echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
    git fetch origin
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)

    if [ "$LOCAL" != "$REMOTE" ]; then
        echo -e "${GREEN}New changes detected, pulling...${NC}"
        git pull origin main
        FORCE_REBUILD=true
    else
        echo -e "${YELLOW}No new changes from remote${NC}"
    fi
fi

# 2. Update dependencies
echo -e "${YELLOW}📦 Updating dependencies...${NC}"
pnpm install

# 3. Run Prisma migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
cd apps/api
npx prisma generate
npx prisma db push
cd ../..

# 4. Build containers
echo -e "${YELLOW}🔨 Building containers...${NC}"

if [ "$FORCE_REBUILD" = true ]; then
    echo -e "${GREEN}Force rebuild enabled - building without cache...${NC}"
    # Build without cache to ensure fresh build
    docker compose -f docker-compose.prod.yml build --no-cache --pull api web
else
    # Normal build (uses cache)
    docker compose -f docker-compose.prod.yml build api web
fi

# 5. Stop old containers
echo -e "${YELLOW}🛑 Stopping old containers...${NC}"
docker compose -f docker-compose.prod.yml stop api web

# 6. Remove old containers to ensure fresh start
docker compose -f docker-compose.prod.yml rm -f api web


# 7. Start new containers
echo -e "${YELLOW}🚢 Starting new containers...${NC}"
docker compose -f docker-compose.prod.yml up -d api web

# 7.1. Restart nginx to apply config changes
echo -e "${YELLOW}🔄 Restarting nginx...${NC}"
docker compose -f docker-compose.prod.yml restart nginx

# 8. Clean up old images
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f

# 9. Health check
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 15

echo -e "${YELLOW}🔍 Checking services...${NC}"
docker compose -f docker-compose.prod.yml ps

# 10. Verify API health
echo ""
echo -e "${GREEN}📊 Service health check:${NC}"
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health || echo "000")
if [ "$API_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ API is healthy (HTTP $API_HEALTH)${NC}"
else
    echo -e "${RED}❌ API health check failed (HTTP $API_HEALTH)${NC}"
fi

# 11. Show container logs if there are issues
if [ "$API_HEALTH" != "200" ]; then
    echo ""
    echo -e "${YELLOW}📋 Recent API logs:${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=20 api
    echo ""
    echo -e "${YELLOW}📋 Recent Web logs:${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=20 web
fi

echo ""
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo "Usage: ./deploy.sh [--force|-f]"
echo "  --force, -f : Force rebuild without cache"
