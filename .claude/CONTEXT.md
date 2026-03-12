# Contexto do Projeto CRM Builder

## Status Atual

### Backend (API NestJS) - Completo
- [x] Monorepo pnpm + Turborepo
- [x] Docker (PostgreSQL + Redis)
- [x] Prisma Schema completo (20+ modelos)
- [x] Autenticacao JWT com refresh tokens
- [x] CustomRole RBAC granular (permissoes por entidade, modulo, campo, data filters)
- [x] Modulos core: Auth, User, Tenant, Workspace, Entity, Data
- [x] EntityDataQueryService centralizado (scope + filtros + search)
- [x] Dashboard Templates + Stats widgets (KPI, charts, funnel, cross-field)
- [x] PDF Templates + geracao batch/single
- [x] Automacoes (entity-automation, action-chain, escalation, scheduled-task)
- [x] Webhooks (saida)
- [x] Email (SMTP + templates)
- [x] Push notifications (mobile)
- [x] Audit logs
- [x] Archivamento automatico
- [x] Import/Export de dados
- [x] Upload de arquivos (imagens, videos, PDFs)
- [x] Computed fields (formula, rollup, timer, SLA)
- [x] Entity field rules (condicoes dinamicas)
- [x] Health checks + Swagger
- [x] Seed com dados de demo

### Frontend (Next.js 14) - Completo
- [x] App Router com i18n (pt-BR, en, es)
- [x] Autenticacao (login, register, forgot-password)
- [x] Dashboard com widgets configuraveis
- [x] Dashboard Templates builder (drag-and-drop, por role)
- [x] CRUD dinamico de entidades com sub-entidades
- [x] PDF Templates builder (editor visual)
- [x] Gerenciamento de roles (CustomRole com permissoes granulares)
- [x] Gerenciamento de usuarios
- [x] Audit logs viewer
- [x] Execution logs viewer
- [x] Configuracoes do tenant
- [x] Notificacoes realtime (WebSocket)
- [x] Tema claro/escuro

### Mobile (Flutter 3.32+) - Fase 1 Completa
- [x] Offline-first com PowerSync (self-hosted) → PostgreSQL sync
- [x] Riverpod + Dio + go_router
- [x] Design system mirror web-admin
- [x] Auth com flutter_secure_storage
- [x] Upload queue offline
- [x] Image prefetch + cache

### DevOps - Completo
- [x] Docker Compose (dev + prod)
- [x] Dockerfiles (API + Frontend)
- [x] Nginx reverse proxy
- [x] Scripts de deploy (deploy.sh, deploy-dev.sh)
- [x] PowerSync self-hosted (docker-compose.powersync.yml)

## Estrutura de Pastas

```
crm-builder/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── prisma/            # Schema + migrations + seed
│   │   └── src/
│   │       ├── common/        # Guards, decorators, services, utils
│   │       │   ├── services/  # EntityDataQueryService (pipeline centralizado)
│   │       │   ├── guards/    # JWT, Roles, Tenant
│   │       │   └── utils/     # build-filter-clause, tenant.util, etc.
│   │       ├── modules/       # 25+ modulos da aplicacao
│   │       └── prisma/        # PrismaService (@Global)
│   │
│   ├── web-admin/             # Frontend Next.js 14
│   │   └── src/
│   │       ├── app/[locale]/  # App Router com i18n
│   │       ├── components/    # shadcn/ui + componentes custom
│   │       ├── hooks/         # TanStack Query hooks
│   │       ├── services/      # API clients
│   │       ├── stores/        # Zustand stores
│   │       └── types/         # Re-exports @crm-builder/shared
│   │
│   └── mobile/                # Flutter offline-first
│       └── lib/
│           ├── core/          # Database, auth, upload, cache
│           ├── features/      # Features por modulo
│           └── providers/     # Riverpod
│
├── packages/
│   └── shared/                # @crm-builder/shared (tipos compartilhados)
│       └── src/               # Enums, types por dominio
│
├── nginx/                     # Config Nginx (prod + dev)
├── deploy.sh                  # Deploy producao
├── deploy-dev.sh              # Deploy dev
└── .claude/                   # Contexto para Claude
```

## URLs de Desenvolvimento

| Servico | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |

## Credenciais de Teste

```
# Super Admin
Email: superadmin@platform.com
Senha: superadmin123

# Admin Demo
Email: admin@demo.com
Senha: admin123

# Usuario Demo
Email: user@demo.com
Senha: user123
```

## Comandos

```bash
pnpm dev              # Roda tudo (API + Frontend)
pnpm build            # Build completo (shared → api + web-admin)
./deploy.sh           # Deploy producao
./deploy-dev.sh       # Deploy dev (branch develop)
```
