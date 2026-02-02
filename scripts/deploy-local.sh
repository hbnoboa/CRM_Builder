#!/bin/bash

# ===========================================
# CRM Builder - Deploy em VM Local
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   CRM Builder - Deploy Local${NC}"
echo -e "${BLUE}========================================${NC}"

show_usage() {
    echo ""
    echo "Uso: ./scripts/deploy-local.sh [comando]"
    echo ""
    echo "Comandos:"
    echo "  start       Iniciar tudo (banco + apps)"
    echo "  stop        Parar tudo"
    echo "  restart     Reiniciar apps (mantém banco)"
    echo "  build       Build das aplicações"
    echo "  logs        Ver logs dos apps"
    echo "  status      Ver status"
    echo "  db-start    Apenas banco de dados"
    echo "  db-stop     Parar banco de dados"
    echo "  migrate     Executar migrations"
    echo "  seed        Popular banco"
    echo "  nginx       Configurar Nginx"
    echo ""
}

# Iniciar banco de dados
start_db() {
    echo -e "${GREEN}▶ Iniciando banco de dados...${NC}"
    docker compose -f docker-compose.db.yml up -d
    echo -e "${GREEN}✓ Banco iniciado!${NC}"
}

# Parar banco de dados
stop_db() {
    echo -e "${YELLOW}■ Parando banco de dados...${NC}"
    docker compose -f docker-compose.db.yml down
}

# Build das aplicações
build_apps() {
    echo -e "${BLUE}🔨 Fazendo build das aplicações...${NC}"
    
    # Build API
    echo "Building API..."
    cd apps/api
    pnpm run build
    cd ../..
    
    # Build Web
    echo "Building Web..."
    cd apps/web-admin
    pnpm run build
    cd ../..
    
    echo -e "${GREEN}✓ Build concluído!${NC}"
}

# Iniciar aplicações com PM2
start_apps() {
    echo -e "${GREEN}▶ Iniciando aplicações com PM2...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✓ Aplicações iniciadas!${NC}"
}

# Parar aplicações
stop_apps() {
    echo -e "${YELLOW}■ Parando aplicações...${NC}"
    pm2 delete all 2>/dev/null || true
}

# Restart aplicações
restart_apps() {
    echo -e "${YELLOW}↻ Reiniciando aplicações...${NC}"
    pm2 restart all
}

# Ver logs
show_logs() {
    pm2 logs
}

# Ver status
show_status() {
    echo ""
    echo -e "${BLUE}📊 Status dos Serviços:${NC}"
    echo ""
    echo "=== Docker (Banco) ==="
    docker compose -f docker-compose.db.yml ps
    echo ""
    echo "=== PM2 (Apps) ==="
    pm2 status
    echo ""
}

# Migrations
run_migrations() {
    echo -e "${BLUE}📦 Executando migrations...${NC}"
    cd apps/api
    pnpm prisma migrate deploy
    cd ../..
    echo -e "${GREEN}✓ Migrations executadas!${NC}"
}

# Seed
run_seed() {
    echo -e "${BLUE}🌱 Populando banco de dados...${NC}"
    cd apps/api
    pnpm prisma db seed
    cd ../..
    echo -e "${GREEN}✓ Seed executado!${NC}"
}

# Configurar Nginx
setup_nginx() {
    echo -e "${BLUE}🔧 Configurando Nginx...${NC}"
    
    sudo apt-get update && sudo apt-get install -y nginx
    
    # Criar configuração
    sudo tee /etc/nginx/sites-available/crm-builder > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

    # Ativar site
    sudo ln -sf /etc/nginx/sites-available/crm-builder /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Testar e reiniciar
    sudo nginx -t && sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo -e "${GREEN}✓ Nginx configurado!${NC}"
}

# Iniciar tudo
start_all() {
    start_db
    sleep 5
    start_apps
    show_status
    
    IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
    echo ""
    echo -e "${GREEN}🚀 CRM Builder está rodando!${NC}"
    echo -e "   Frontend: http://${IP}"
    echo -e "   API:      http://${IP}/api/v1/health"
    echo ""
}

# Parar tudo
stop_all() {
    stop_apps
    stop_db
    echo -e "${GREEN}✓ Tudo parado!${NC}"
}

# Processar comandos
case "$1" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_apps
        ;;
    build)
        build_apps
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    db-start)
        start_db
        ;;
    db-stop)
        stop_db
        ;;
    migrate)
        run_migrations
        ;;
    seed)
        run_seed
        ;;
    nginx)
        setup_nginx
        ;;
    *)
        show_usage
        ;;
esac
