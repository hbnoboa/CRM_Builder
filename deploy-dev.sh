#!/bin/bash
set -e

echo "=== CRM Builder Deploy DEV ==="

# 0. Garantir que estamos na branch develop ou dev
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ] && [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "ERRO: Deploy de dev so pode ser feito na branch 'develop' ou 'dev' (atual: '$CURRENT_BRANCH')"
  exit 1
fi

# 1. Build all packages (shared → api + web-admin)
echo "[1/7] Building packages..."
pnpm build

# 2. Garantir que postgres-dev e redis-dev estao rodando
echo "[2/7] Garantindo infra dev (postgres-dev, redis-dev)..."
docker compose -f docker-compose.prod.yml up -d postgres-dev redis-dev

# 3. Rotacionar tags: previous → removida, latest → previous
echo "[3/7] Rotacionando imagens (latest → previous)..."
for img in crm-builder-api-dev crm-builder-web-dev; do
  docker rmi "$img:previous" 2>/dev/null || true
  if docker image inspect "$img:latest" &>/dev/null; then
    docker tag "$img:latest" "$img:previous"
  fi
done

# 4. Build Docker images (copia artefatos pre-compilados, sem rebuild)
echo "[4/7] Building Docker images (dev)..."
docker compose -f docker-compose.prod.yml build --no-cache api-dev web-dev

# 5. Recreate dev containers (apenas api-dev e web-dev)
echo "[5/7] Deploying dev containers..."
docker compose -f docker-compose.prod.yml up -d --no-deps api-dev web-dev

# 6. Restart nginx to refresh upstream DNS
echo "[6/7] Restarting nginx..."
docker compose -f docker-compose.prod.yml restart nginx

# 7. Limpar imagens dangling e build cache antigo
echo "[7/7] Limpando lixo Docker..."
docker image prune -f
docker builder prune -f --filter 'until=1h' 2>/dev/null || true

echo "=== Deploy DEV concluido ==="
docker compose -f docker-compose.prod.yml ps api-dev web-dev postgres-dev redis-dev nginx
echo ""
echo "Imagens mantidas:"
docker images --format "  {{.Repository}}:{{.Tag}}  {{.Size}}" | grep "crm-builder-.*-dev"
