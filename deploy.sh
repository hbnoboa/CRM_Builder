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
echo "[1/6] Building packages..."
pnpm build

# 2. Rotacionar tags: previous → removida, latest → previous
echo "[2/6] Rotacionando imagens (latest → previous)..."
for img in crm-builder-api crm-builder-web; do
  docker rmi "$img:previous" 2>/dev/null || true
  if docker image inspect "$img:latest" &>/dev/null; then
    docker tag "$img:latest" "$img:previous"
  fi
done

# 3. Build Docker images (copia artefatos pre-compilados, sem rebuild)
echo "[3/6] Building Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache api web

# 4. Recreate containers
echo "[4/6] Deploying containers..."
docker compose -f docker-compose.prod.yml up -d api web

# 5. Restart nginx to refresh upstream DNS
echo "[5/6] Restarting nginx..."
docker compose -f docker-compose.prod.yml restart nginx

# 6. Limpar imagens dangling e build cache antigo
echo "[6/6] Limpando lixo Docker..."
docker image prune -f
docker builder prune -f --filter 'until=1h' 2>/dev/null || true

echo "=== Deploy concluido ==="
docker compose -f docker-compose.prod.yml ps api web nginx
echo ""
echo "Imagens mantidas:"
docker images --format "  {{.Repository}}:{{.Tag}}  {{.Size}}" | grep -E "crm-builder-(api|web):"
