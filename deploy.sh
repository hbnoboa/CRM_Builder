#!/bin/bash
set -e

echo "=== CRM Builder Deploy PRODUCAO ==="

# 0. Garantir que estamos na branch main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERRO: Deploy de producao so pode ser feito na branch 'main' (atual: '$CURRENT_BRANCH')"
  exit 1
fi

# 1. Build all packages (shared → api + web-admin)
echo "[1/4] Building packages..."
pnpm build

# 2. Build Docker images
echo "[2/4] Building Docker images..."
docker compose -f docker-compose.prod.yml build api web

# 3. Recreate containers
echo "[3/4] Deploying containers..."
docker compose -f docker-compose.prod.yml up -d api web

# 4. Restart nginx to refresh upstream DNS
echo "[4/4] Restarting nginx..."
docker compose -f docker-compose.prod.yml restart nginx

echo "=== Deploy concluido ==="
docker compose -f docker-compose.prod.yml ps api web nginx
