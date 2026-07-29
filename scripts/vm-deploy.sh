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

# 3. Pull (imagem pronta) + up (sem rebuild), refresh do nginx, limpa lixo
docker compose -f "$COMPOSE" pull $SERVICES
docker compose -f "$COMPOSE" up -d --no-deps $SERVICES
docker compose -f "$COMPOSE" restart nginx
docker image prune -f
echo "deploy $ENV_NAME OK"
