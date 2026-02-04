# 📋 Contexto do Projeto CRM Builder

## Status Atual: FASE 1 - MVP (85% completo)

### ✅ O que já está implementado

#### Backend (API NestJS) - 95%
- [x] Estrutura do monorepo (pnpm + Turborepo)
- [x] Configuração Docker (PostgreSQL + Redis)
- [x] Prisma Schema completo
- [x] Autenticação JWT com refresh tokens
- [x] Sistema de permissões RBAC
- [x] Módulos: Auth, User, Tenant, Organization, Organization
- [x] Módulos: Entity, Data (CRUD dinâmico)
- [x] Módulos: Page, CustomApi, Stats, Upload
- [x] Notifications (WebSocket)
- [x] Health checks
- [x] Swagger documentação
- [x] Rate limiting
- [x] Seed com dados de demo

#### Frontend (Next.js) - 70%
- [x] Estrutura base App Router
- [x] Autenticação (login/register)
- [x] Layout com sidebar
- [x] Dashboard básico
- [x] Listagem de entidades
- [x] CRUD de dados dinâmicos
- [x] Gerenciamento de usuários
- [x] Organization switcher
- [x] Notificações realtime
- [ ] Page Builder (Puck) - parcial
- [ ] API Builder - parcial
- [ ] Configurações avançadas

#### DevOps - 80%
- [x] Docker Compose (dev)
- [x] Docker Compose (prod)
- [x] Dockerfile API
- [x] Dockerfile Frontend
- [x] Nginx config
- [x] Script de deploy
- [x] GitHub Actions CI/CD
- [x] Railway config
- [x] Vercel config
- [ ] Monitoramento (Prometheus/Grafana)
- [ ] Backup automatizado

### 🔄 Em Progresso
- Page Builder integração completa
- Testes E2E com Playwright
- Documentação de componentes

### ❌ Pendente
- Importação/Exportação CSV
- Webhooks
- Integrações externas
- Multi-idioma (i18n)
- PWA/Mobile

## Estrutura de Pastas

```
crm-builder/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── prisma/            # Schema + migrations + seed
│   │   └── src/
│   │       ├── common/        # Guards, decorators, pipes
│   │       ├── modules/       # Módulos da aplicação
│   │       └── prisma/        # Prisma service
│   │
│   └── web-admin/             # Frontend Next.js
│       └── src/
│           ├── app/           # App Router pages
│           ├── components/    # Componentes React
│           ├── hooks/         # Custom hooks
│           ├── lib/           # Utilitários
│           ├── providers/     # Context providers
│           ├── services/      # API services
│           ├── stores/        # Zustand stores
│           └── types/         # TypeScript types
│
├── packages/
│   └── shared/                # Tipos compartilhados
│
├── docs/                      # Documentação
├── e2e/                       # Testes Playwright
├── nginx/                     # Config Nginx (prod)
├── scripts/                   # Scripts de automação
└── .claude/                   # Contexto para Claude
```

## URLs de Desenvolvimento

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |
| Adminer | http://localhost:8080 |

## Credenciais de Teste

```
# Super Admin
Email: superadmin@platform.com
Senha: superadmin123

# Admin Demo
Email: admin@demo.com
Senha: admin123

# Usuário Demo
Email: user@demo.com
Senha: user123
```

## Próximos Passos Prioritários

1. **Finalizar Page Builder** - Integrar Puck Editor completamente
2. **Testes E2E** - Cobrir fluxos críticos com Playwright
3. **Deploy produção** - Validar em ambiente real
4. **Documentação** - Completar docs de API e componentes
