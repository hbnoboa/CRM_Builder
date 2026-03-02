#!/bin/bash
set -e

echo "=== CRM Builder Deploy DEV ==="

# 1. Build all packages
echo "[1/4] Building packages..."
pnpm build

# 2. Build Docker images (reusa as mesmas imagens)
echo "[2/4] Building Docker images (dev)..."
docker compose -f docker-compose.prod.yml build api-dev web-dev

# 3. Recreate dev containers
echo "[3/4] Deploying dev containers..."
docker compose -f docker-compose.prod.yml up -d api-dev web-dev

# 4. Restart nginx to refresh upstream DNS
echo "[4/4] Restarting nginx..."
docker compose -f docker-compose.prod.yml restart nginx

echo "=== Deploy DEV concluido ==="
docker compose -f docker-compose.prod.yml ps api-dev web-dev nginx
