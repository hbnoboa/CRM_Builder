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

## Cargos e Plataforma

- **Cargos de empresa (CustomRole)**: permission-driven (`modulePermissions` + `permissions[]` por tabela, coringa `*`) e `rank` (menor = mais poder; so se age sobre cargos de rank maior). `modulePermissions.allAccess` = acesso total DENTRO da empresa.
- **Modelo padrao** de toda empresa nova (`common/utils/default-roles.ts`): Administrador (10, allAccess) · Gerente (30) · Operador (50, padrao) · Visualizador (70).
- **Dono da empresa** (`Tenant.ownerId`): nao pode ser removido, desativado nem rebaixado pelos outros admins; a troca e feita pelo proprio dono ou pelo console.
- **Nenhum cargo de empresa alcanca outra empresa.** Nao existe mais `platform.*` nem modulo `tenants` em cargos. Gestao de empresas, "entrar como", copia de dados entre empresas e planos ficam so no **console da plataforma** (`/admin` no web, `modules/platform` na API), com login e equipe proprios (`PlatformStaff`: OWNER, SUPPORT, FINANCE, READONLY).

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
