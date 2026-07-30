#!/usr/bin/env bash
# Roda NA VM, chamado pelo workflow via `gcloud compute ssh`. Autentica na Google
# Artifact Registry pela service account da VM (metadata server), puxa as imagens
# ja buildadas no CI e sobe os containers. NAO builda nada aqui.
#
# Uso:  ENV_NAME=dev|prod  bash scripts/vm-deploy.sh
set -euo pipefail

ENV_NAME="${ENV_NAME:-dev}"
GAR_HOST="us-central1-docker.pkg.dev"
IMG_BASE="${GAR_HOST}/ios-forms-299fb/crm"
COMPOSE="docker-compose.prod.yml"

# 1. Login na GAR usando o token da SA da VM (sem chave, via metadata server)
TOKEN=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
  | cut -d'"' -f4)
echo "$TOKEN" | docker login -u oauth2accesstoken --password-stdin "https://${GAR_HOST}" >/dev/null

# 2. Imagens + servicos por ambiente (os image: no compose leem essas envs)
if [ "$ENV_NAME" = "prod" ]; then
  export API_IMAGE="$IMG_BASE/crm-builder-api:prod"
  export WEB_IMAGE="$IMG_BASE/crm-builder-web:prod"
  SERVICES="api web"
else
  export API_DEV_IMAGE="$IMG_BASE/crm-builder-api:dev"
  export WEB_DEV_IMAGE="$IMG_BASE/crm-builder-web:dev"
  SERVICES="api-dev web-dev"
fi

# 3. Pull das imagens prontas (ja buildadas no CI)
docker compose -f "$COMPOSE" pull $SERVICES

# 4. Migrations do banco, usando a imagem NOVA ja puxada, ANTES de subir o codigo.
#    Se falhar, o `set -e` aborta o deploy e o codigo atual segue no ar (nada foi trocado).
#    NOTA prod: o ledger (_prisma_migrations) precisa estar baseline — migrations ja
#    existentes marcadas como aplicadas via `prisma migrate resolve --applied` — antes
#    do primeiro deploy com migrate; senao o migrate deploy tentaria re-aplicar o que
#    ja existe. Dev ja foi baseline. Prod: fazer o rollout controlado + baseline primeiro.
API_SVC=$(printf '%s\n' $SERVICES | grep -m1 api)
echo "==> prisma migrate deploy ($API_SVC)"
docker compose -f "$COMPOSE" run --rm --no-deps "$API_SVC" \
  sh -c "node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma"

# 5. Up (sem rebuild), refresh do nginx, limpa lixo
docker compose -f "$COMPOSE" up -d --no-deps $SERVICES
docker compose -f "$COMPOSE" restart nginx
docker image prune -f
echo "deploy $ENV_NAME OK"
