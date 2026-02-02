#!/bin/bash

# ===========================================
# CRM Builder - Deploy Script
# ===========================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CRM Builder - Production Deploy${NC}"
echo -e "${BLUE}========================================${NC}"

# Verificar se .env.production existe
if [ ! -f ".env.production" ]; then
    echo -e "${RED}Erro: .env.production não encontrado!${NC}"
    echo "Copie .env.production.example para .env.production e configure as variáveis"
    exit 1
fi

# Função para mostrar uso
show_usage() {
    echo ""
    echo "Uso: ./scripts/deploy.sh [comando]"
    echo ""
    echo "Comandos:"
    echo "  start       Iniciar todos os serviços"
    echo "  stop        Parar todos os serviços"
    echo "  restart     Reiniciar todos os serviços"
    echo "  build       Rebuild das imagens Docker"
    echo "  logs        Ver logs dos serviços"
    echo "  status      Ver status dos containers"
    echo "  migrate     Executar migrations do banco"
    echo "  seed        Popular banco com dados iniciais"
    echo "  backup      Fazer backup do banco de dados"
    echo "  restore     Restaurar backup do banco"
    echo "  ssl         Configurar certificado SSL (Let's Encrypt)"
    echo "  update      Atualizar e fazer deploy"
    echo ""
}

# Start dos serviços
start_services() {
    echo -e "${GREEN}▶ Iniciando serviços...${NC}"
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d
    echo -e "${GREEN}✓ Serviços iniciados!${NC}"
    show_status
}

# Stop dos serviços
stop_services() {
    echo -e "${YELLOW}■ Parando serviços...${NC}"
    docker compose -f docker-compose.prod.yml --env-file .env.production down
    echo -e "${GREEN}✓ Serviços parados!${NC}"
}

# Restart dos serviços
restart_services() {
    echo -e "${YELLOW}↻ Reiniciando serviços...${NC}"
    docker compose -f docker-compose.prod.yml --env-file .env.production restart
    echo -e "${GREEN}✓ Serviços reiniciados!${NC}"
}

# Build das imagens
build_images() {
    echo -e "${BLUE}🔨 Fazendo build das imagens...${NC}"
    docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
    echo -e "${GREEN}✓ Build concluído!${NC}"
}

# Ver logs
show_logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        docker compose -f docker-compose.prod.yml --env-file .env.production logs -f
    else
        docker compose -f docker-compose.prod.yml --env-file .env.production logs -f "$SERVICE"
    fi
}

# Status dos containers
show_status() {
    echo ""
    echo -e "${BLUE}📊 Status dos Serviços:${NC}"
    echo ""
    docker compose -f docker-compose.prod.yml --env-file .env.production ps
    echo ""
}

# Executar migrations
run_migrations() {
    echo -e "${BLUE}📦 Executando migrations...${NC}"
    docker compose -f docker-compose.prod.yml --env-file .env.production exec api npx prisma migrate deploy
    echo -e "${GREEN}✓ Migrations executadas!${NC}"
}

# Seed do banco
run_seed() {
    echo -e "${BLUE}🌱 Populando banco de dados...${NC}"
    docker compose -f docker-compose.prod.yml --env-file .env.production exec api npx prisma db seed
    echo -e "${GREEN}✓ Seed executado!${NC}"
}

# Backup do banco
backup_database() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="backup_${TIMESTAMP}.sql"
    BACKUP_DIR="$PROJECT_DIR/backups"
    
    mkdir -p "$BACKUP_DIR"
    
    echo -e "${BLUE}💾 Fazendo backup do banco de dados...${NC}"
    
    docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
        pg_dump -U postgres crm_builder > "$BACKUP_DIR/$BACKUP_FILE"
    
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    
    echo -e "${GREEN}✓ Backup salvo em: $BACKUP_DIR/${BACKUP_FILE}.gz${NC}"
}

# Restaurar backup
restore_database() {
    BACKUP_FILE=$1
    
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${RED}Erro: Especifique o arquivo de backup${NC}"
        echo "Uso: ./scripts/deploy.sh restore backup_file.sql.gz"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}Erro: Arquivo não encontrado: $BACKUP_FILE${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠ ATENÇÃO: Isso irá substituir todos os dados do banco!${NC}"
    read -p "Continuar? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}📦 Restaurando backup...${NC}"
        
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            gunzip -c "$BACKUP_FILE" | docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U postgres crm_builder
        else
            docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U postgres crm_builder < "$BACKUP_FILE"
        fi
        
        echo -e "${GREEN}✓ Backup restaurado!${NC}"
    fi
}

# Configurar SSL com Let's Encrypt
setup_ssl() {
    DOMAIN=$1
    
    if [ -z "$DOMAIN" ]; then
        echo -e "${RED}Erro: Especifique o domínio${NC}"
        echo "Uso: ./scripts/deploy.sh ssl seu-dominio.com"
        exit 1
    fi
    
    echo -e "${BLUE}🔒 Configurando SSL para $DOMAIN...${NC}"
    
    # Instalar certbot se não existir
    if ! command -v certbot &> /dev/null; then
        echo "Instalando certbot..."
        apt-get update && apt-get install -y certbot
    fi
    
    # Parar nginx temporariamente
    docker compose -f docker-compose.prod.yml --env-file .env.production stop nginx
    
    # Obter certificado
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN"
    
    # Copiar certificados
    mkdir -p nginx/ssl
    cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem nginx/ssl/
    cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem nginx/ssl/
    
    echo -e "${GREEN}✓ SSL configurado!${NC}"
    echo -e "${YELLOW}Atualize nginx/nginx.prod.conf para habilitar HTTPS${NC}"
    
    # Reiniciar nginx
    docker compose -f docker-compose.prod.yml --env-file .env.production start nginx
}

# Update completo
full_update() {
    echo -e "${BLUE}🚀 Iniciando atualização completa...${NC}"
    
    # Pull das alterações
    echo -e "${BLUE}📥 Baixando alterações do git...${NC}"
    git pull origin main
    
    # Backup antes de atualizar
    backup_database
    
    # Rebuild
    build_images
    
    # Restart
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d
    
    # Migrations
    run_migrations
    
    echo -e "${GREEN}✓ Atualização concluída!${NC}"
    show_status
}

# Processar comandos
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_images
        ;;
    logs)
        show_logs "$2"
        ;;
    status)
        show_status
        ;;
    migrate)
        run_migrations
        ;;
    seed)
        run_seed
        ;;
    backup)
        backup_database
        ;;
    restore)
        restore_database "$2"
        ;;
    ssl)
        setup_ssl "$2"
        ;;
    update)
        full_update
        ;;
    *)
        show_usage
        ;;
esac
