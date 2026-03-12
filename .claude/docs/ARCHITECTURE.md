# Arquitetura do Sistema

## Visao Geral

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CRM BUILDER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐│
│  │  Next.js 14    │  │  Flutter 3.32+ │  │  NestJS 10 (API)          ││
│  │  (web-admin)   │  │  (mobile)      │  │  Port 3001                ││
│  │  Port 3000     │  │  Offline-first │  │                            ││
│  └───────┬────────┘  └───────┬────────┘  │  ┌──────────────────────┐ ││
│          │ REST              │ REST+Sync  │  │ EntityDataQueryService│ ││
│          └───────────────────┴──────────▶│  │ (camada centralizada) │ ││
│                                          │  └──────────────────────┘ ││
│                                          └────────────┬───────────────┘│
│                                                       │ Prisma          │
│                                          ┌────────────▼───────────────┐│
│                                          │  PostgreSQL 16 + Redis 7   ││
│                                          └────────────────────────────┘│
│                                                       ▲                 │
│                                          ┌────────────┴───────────────┐│
│                                          │  PowerSync (self-hosted)   ││
│                                          │  Sync → SQLite (mobile)    ││
│                                          └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## Camadas da API (NestJS)

```
Request
   │
   ▼
┌──────────────────┐
│  Controller      │  ← Recebe request, valida com DTO (class-validator)
├──────────────────┤
│  Guards          │  ← JwtAuthGuard → RolesGuard (CustomRole-based)
├──────────────────┤
│  Service         │  ← Logica de negocio
├──────────────────┤
│  EntityDataQuery │  ← Pipeline centralizado (scope, filters, search)
│  Service         │     Usado por DataService, StatsService, PdfGenerator
├──────────────────┤
│  Prisma          │  ← ORM (PostgreSQL)
└──────────────────┘
```

## Pipeline Centralizado de Dados (EntityDataQueryService)

Todo modulo que busca `EntityData` DEVE usar o `EntityDataQueryService`:

```
buildWhere(options)
   │
   ├── 1. getEntityCached(slug) ─── cache 5s por slug:tenantId
   ├── 2. where.entityId = entity.id
   ├── 3. Tenant isolation (PLATFORM_ADMIN bypass)
   ├── 4. parentRecordId / includeChildren
   ├── 5. recordIds (export de selecionados)
   ├── 6. hasChildrenIn (registros com filhos)
   ├── 7. applyScopeFromCustomRole (own/all)
   ├── 8. applyGlobalFilters (entity.settings.globalFilters)
   ├── 9. applyRoleDataFilters (customRole.permissions[].dataFilters)
   ├── 10. applyUserFilters (query.filters JSON)
   ├── 11. applyDashboardFilters (cross-filters, date range)
   └── 12. applySearchClause (searchFields da entidade)
   │
   ▼
   { where, entity, effectiveTenantId }
```

**Arquivo:** `apps/api/src/common/services/entity-data-query.service.ts`
**Modulo:** `EntityDataQueryModule` (importar nos consumers)

**Consumers atuais:**
- `DataService` — listagem, export, CRUD
- `StatsService` — dashboard widgets
- `PdfGeneratorService` — geracao de PDFs

## Modulos da API

```
apps/api/src/
├── main.ts
├── app.module.ts
│
├── common/                          # Codigo compartilhado
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser()
│   │   └── roles.decorator.ts          # @Roles(), RoleType
│   ├── guards/
│   │   ├── jwt-auth.guard.ts           # Valida JWT
│   │   ├── roles.guard.ts              # Valida CustomRole permissions
│   │   └── tenant.guard.ts             # Valida tenantId
│   ├── services/
│   │   ├── entity-data-query.service.ts  # ★ Pipeline centralizado
│   │   └── entity-data-query.module.ts
│   ├── utils/
│   │   ├── build-filter-clause.ts      # Constroi WHERE para filtros JSON
│   │   ├── check-module-permission.ts  # checkModulePermission(), checkEntityAction()
│   │   ├── evaluate-notification-conditions.ts  # Avalia condicoes in-memory
│   │   ├── format-record.ts            # Formata dados para display
│   │   └── tenant.util.ts             # getEffectiveTenantId()
│   ├── filters/                        # Exception filters
│   ├── interceptors/                   # Logging, transform
│   ├── pipes/                          # Validacao
│   ├── dto/                            # DTOs compartilhados
│   └── types/                          # CurrentUser, pagination, etc.
│
├── prisma/
│   └── prisma.service.ts              # @Global() PrismaService
│
└── modules/
    │
    │  # ─── Core ───────────────────────────────────────
    ├── auth/                    # Login, register, refresh, JWT
    ├── user/                    # CRUD usuarios
    ├── tenant/                  # Multi-tenancy, tenant-copy
    ├── workspace/               # Areas de trabalho
    │
    │  # ─── Entity Builder ─────────────────────────────
    ├── entity/                  # Definicao de entidades (fields, settings)
    ├── data/                    # CRUD dinamico de EntityData
    ├── entity-field-rule/       # Regras condicionais de campos
    │
    │  # ─── Automacao ──────────────────────────────────
    ├── entity-automation/       # Automacoes trigger-based
    ├── action-chain/            # Cadeia de acoes (workflow)
    ├── escalation/              # Regras de escalacao temporal
    ├── scheduled-task/          # Tarefas agendadas (cron)
    │
    │  # ─── Seguranca & Auditoria ──────────────────────
    ├── custom-role/             # RBAC granular (CustomRole)
    ├── audit/                   # Log de auditoria
    ├── archive/                 # Arquivamento automatico
    │
    │  # ─── Reporting & Analytics ──────────────────────
    ├── stats/                   # Dashboard widgets (KPI, charts, funnel)
    ├── dashboard-template/      # Templates de dashboard por role
    ├── pdf/                     # Geracao de PDF (templates + batch)
    │
    │  # ─── Comunicacao ────────────────────────────────
    ├── notification/            # WebSocket + in-app notifications
    ├── email/                   # Envio de emails (SMTP)
    ├── email-template/          # Templates de email
    ├── push/                    # Push notifications (mobile)
    ├── webhook/                 # Webhooks de saida
    │
    │  # ─── Integracao ─────────────────────────────────
    ├── upload/                  # Upload de arquivos (S3/local)
    ├── sync/                    # PowerSync (mobile offline sync)
    │
    │  # ─── Monitoramento ──────────────────────────────
    ├── execution-logs/          # Logs de execucao (automacoes, webhooks)
    └── health/                  # Health checks
```

## Modelo de Dados

```
Tenant (Empresa)
│
├── CustomRole[] (Papeis com permissoes granulares)
│   ├── permissions: [{ entitySlug, canRead, canUpdate, scope, dataFilters }]
│   ├── modulePermissions: { data, settings, api, notification }
│   └── roleType: PLATFORM_ADMIN | ADMIN | MANAGER | USER | VIEWER | CUSTOM
│
├── User[] (vinculados a CustomRole)
│   └── UserTenantAccess[] (acesso multi-tenant)
│
├── Entity[] (Definicoes de entidade)
│   ├── fields: [{ slug, name, type, required, options, ... }]
│   ├── settings: { searchFields, titleField, globalFilters, slaConfig }
│   ├── EntityData[] (Registros ativos)
│   │   └── EntityData[] (Sub-registros via parentRecordId)
│   ├── ArchivedEntityData[] (Registros arquivados)
│   ├── EntityAutomation[] (Automacoes)
│   └── EntityFieldRule[] (Regras condicionais)
│
├── DashboardTemplate[] (Templates de dashboard por role)
├── PdfTemplate[] (Templates de PDF)
├── Webhook[] (Webhooks de saida)
├── ActionChain[] (Cadeias de acoes)
├── EmailTemplate[] (Templates de email)
└── AuditLog[] (Logs de auditoria)
```

## Fluxo de Autenticacao

```
1. POST /auth/login → Valida credenciais
2. Gera accessToken (15min) + refreshToken (7dias)
   - JWT payload: { sub, email, tenantId, customRoleId, roleType }
   - Audience: "powersync" (compartilhado com PowerSync)
3. Cliente envia: Authorization: Bearer <accessToken>
4. Token expirado → POST /auth/refresh com refreshToken
```

## Fluxo de Permissoes (CustomRole)

```
Request chega
     │
     ▼
JwtAuthGuard ── Valida JWT, popula req.user com CustomRole
     │
     ▼
RolesGuard ── Verifica @Roles() se presente
     │
     ▼
Controller ── Chama checkModulePermission() ou checkEntityAction()
     │
     ▼
Service ── Usa EntityDataQueryService que aplica:
     │      - scope (own/all) via getEntityScope()
     │      - globalFilters (entity.settings)
     │      - roleDataFilters (customRole.permissions[].dataFilters)
     │
     ├── ✅ Permite → Retorna dados filtrados
     └── ❌ Nega → 403 Forbidden
```

## Frontend (Next.js)

```
apps/web-admin/src/
├── app/[locale]/
│   ├── (auth)/                  # Login, register, forgot-password
│   └── (dashboard)/             # Rotas protegidas
│       ├── dashboard/           # Dashboard principal
│       ├── dashboard-templates/ # Builder de dashboards
│       ├── data/                # CRUD dinamico de entidades
│       ├── entities/            # Gerenciamento de entidades
│       ├── pdf-templates/       # Builder de PDFs
│       ├── roles/               # Gerenciamento de roles
│       ├── users/               # Gerenciamento de usuarios
│       ├── tenants/             # Gerenciamento de tenants (PLATFORM_ADMIN)
│       ├── permissions/         # Painel de permissoes
│       ├── audit-logs/          # Logs de auditoria
│       ├── execution-logs/      # Logs de automacoes
│       ├── settings/            # Configuracoes do tenant
│       └── profile/             # Perfil do usuario
│
├── components/
│   ├── ui/                      # shadcn/ui base components
│   ├── dashboard-widgets/       # Widgets de dashboard (KPI, charts, etc)
│   ├── entity-editor/           # Editor visual de entidades
│   └── [feature]/               # Componentes por feature
│
├── hooks/                       # TanStack Query hooks
│   ├── use-data.ts              # CRUD de EntityData
│   ├── use-dashboard-templates.ts # Stats + templates
│   ├── use-permissions.ts       # Permissoes (CustomRole-based)
│   └── ...
│
├── services/                    # API clients (axios)
├── stores/                      # Zustand stores
├── providers/                   # React context providers
└── types/                       # TypeScript types (re-exports @crm-builder/shared)
```

## Mobile (Flutter)

```
apps/mobile/
├── lib/
│   ├── core/
│   │   ├── database/            # PowerSync setup + connector
│   │   ├── upload/              # Upload queue offline
│   │   ├── cache/               # Image prefetch + cache
│   │   └── auth/                # Auth service (flutter_secure_storage)
│   ├── features/                # Features por modulo
│   ├── providers/               # Riverpod providers
│   └── design_system/           # Design system (mirror web-admin)
│
├── powersync.yaml               # Sync rules
└── pubspec.yaml
```

## Deploy

```bash
# Producao
./deploy.sh          # build + docker build + up + nginx restart

# Dev
./deploy-dev.sh      # branch develop, mesmo fluxo

# Fluxo:
pnpm build → docker build api web → docker compose up → nginx restart
```
