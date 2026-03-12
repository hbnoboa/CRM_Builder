# CRM Builder - Instrucoes para Claude

## Sobre Este Projeto

Plataforma SaaS multi-tenant para criar CRMs personalizados com entidades dinamicas, permissoes granulares (RBAC via CustomRole), dashboards configuraveis, geracao de PDF, automacoes e app mobile offline-first.

## Stack Tecnologica

| Camada | Tecnologia |
|--------|------------|
| **Backend** | NestJS 10 + Prisma 5 + PostgreSQL 16 |
| **Frontend** | Next.js 14 (App Router) + shadcn/ui + Tailwind |
| **Mobile** | Flutter 3.32+ (offline-first via PowerSync) |
| **State** | TanStack Query + Zustand |
| **Auth** | JWT + Refresh Tokens |
| **Realtime** | Socket.IO |
| **Shared** | `@crm-builder/shared` (tipos compartilhados) |
| **Monorepo** | pnpm + Turborepo |

## Estrutura do Monorepo

```
crm-builder/
├── apps/api/           # NestJS backend (CommonJS)
├── apps/web-admin/     # Next.js 14 frontend (ESNext)
├── apps/mobile/        # Flutter offline-first
├── packages/shared/    # @crm-builder/shared tipos
├── deploy.sh           # Deploy producao
└── deploy-dev.sh       # Deploy dev (branch develop)
```

## Arquitetura Multi-Tenant

```
Tenant (Empresa)
├── CustomRole[] (RBAC granular)
├── User[] → CustomRole
├── Entity[] (Definicoes dinamicas)
│   ├── EntityData[] (Registros)
│   └── ArchivedEntityData[] (Arquivados)
├── DashboardTemplate[] (por role)
├── PdfTemplate[] (geracao PDF)
└── Webhook[], ActionChain[], EntityAutomation[]
```

## Hierarquia de Roles (CustomRole.roleType)

1. **PLATFORM_ADMIN** - Super admin (acesso cross-tenant)
2. **ADMIN** - Admin do tenant (tudo dentro do tenant)
3. **MANAGER** - Gerente (scope: all)
4. **USER** - Padrao (scope: own)
5. **VIEWER** - Apenas leitura (scope: all)
6. **CUSTOM** - Permissoes configuradas por entidade

## Camada Centralizada de Dados

**OBRIGATORIO:** Todo modulo que busca `EntityData` DEVE usar `EntityDataQueryService`:

```typescript
const { where, entity } = await this.queryService.buildWhere({
  entitySlug, user, tenantId, filters, search, dashboardFilters,
});
```

Pipeline automatico: tenant → scope → globalFilters → roleDataFilters → userFilters → dashboardFilters → search

**Arquivo:** `apps/api/src/common/services/entity-data-query.service.ts`

## Comandos Principais

```bash
pnpm dev              # Roda API + Frontend
pnpm build            # Build completo (shared → api + web-admin)
./deploy.sh           # Deploy producao
./deploy-dev.sh       # Deploy dev (branch develop)
```

## Regras Gerais

1. **Sempre TypeScript** — nunca JavaScript puro
2. **EntityData → EntityDataQueryService** — nunca WHERE manual
3. **Multi-tenancy obrigatorio** — sempre filtrar por tenantId
4. **class-validator** nos DTOs do NestJS
5. **Zod** para validacao no frontend
6. **CustomRole RBAC** — checkModulePermission() / checkEntityAction()
7. **Git: branch develop** — nunca dev, nunca push direto em main

## Referencias

- Documentacao: `.claude/docs/`
- Regras de codigo: `.claude/rules/`
- Skills: `.claude/skills/`
- Comandos: `.claude/commands/`
