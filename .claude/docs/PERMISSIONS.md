# Sistema de Permissoes (CustomRole RBAC)

## Visao Geral

O sistema usa **CustomRole** com permissoes granulares por entidade e por modulo. Cada usuario tem uma `customRole` que define seu `roleType` e suas permissoes especificas.

> **Importante:** O antigo sistema de permissoes baseado em strings (`recurso:acao:escopo`) foi completamente substituido pelo sistema CustomRole.

## Hierarquia de Roles (roleType)

| roleType | Descricao | Scope | Acesso |
|----------|-----------|-------|--------|
| `PLATFORM_ADMIN` | Super admin da plataforma | all | Tudo, cross-tenant |
| `ADMIN` | Admin do tenant | all | Tudo dentro do tenant |
| `MANAGER` | Gerente | all | Dados + leitura de usuarios |
| `USER` | Padrao | own | CRUD proprio |
| `VIEWER` | Apenas leitura | all | Leitura de todos os dados |
| `CUSTOM` | Configuravel | configuravel | Definido nas permissoes |

## Estrutura do CustomRole

### 1. permissions (por entidade)

JSON array com permissoes por entidade:

```typescript
interface EntityPermission {
  entitySlug: string;           // "clientes", "veiculos", etc.

  // CRUD basico
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;

  // Escopo de visibilidade
  scope: 'all' | 'own';        // all = todos, own = apenas createdById

  // Acoes extras (sub-granular)
  canExport?: boolean;
  canImport?: boolean;
  canConfigureColumns?: boolean;

  // Permissoes por campo (opcional)
  fieldPermissions?: {
    fieldSlug: string;
    canView: boolean;
    canEdit: boolean;
  }[];

  // Filtros de dados por role (restringe registros visiveis)
  dataFilters?: {
    fieldSlug: string;
    fieldName: string;
    fieldType: string;
    operator: string;           // equals, contains, gt, lt, between, etc.
    value?: unknown;
    value2?: unknown;
  }[];

  // Regras de notificacao
  notificationRules?: {
    enabled: boolean;
    onCreate: boolean;
    onUpdate: boolean;
    onDelete: boolean;
    conditions?: DataFilter[];  // Condicoes para disparar
  };
}
```

### 2. modulePermissions (por modulo do sistema)

JSON object com permissoes CRUD por modulo:

```typescript
interface ModulePermissions {
  dashboard?: ModulePermission;
  users?: ModulePermission;
  settings?: ModulePermission;
  apis?: ModulePermission;
  pages?: ModulePermission;
  entities?: ModulePermission;
  tenants?: ModulePermission;   // Apenas PLATFORM_ADMIN
  data?: ModulePermission;
  roles?: ModulePermission;
  pdfTemplates?: ModulePermission;
  auditLogs?: ModulePermission;
  dashboardTemplates?: ModulePermission;
}

interface ModulePermission {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;

  // Sub-granular (opcionais, por modulo)
  canGenerate?: boolean;       // pdfTemplates
  canPublish?: boolean;        // pdfTemplates
  canActivate?: boolean;       // apis, webhooks
  canTest?: boolean;           // apis
  canDuplicate?: boolean;
  canSuspend?: boolean;        // users
  canAssignRole?: boolean;     // users
  canChangeStatus?: boolean;   // users
  canSetDefault?: boolean;     // roles
  canManagePermissions?: boolean; // roles
  canUpdateLayout?: boolean;   // entities
  canCreateField?: boolean;    // entities
  canDeleteField?: boolean;    // entities
  canUpdateField?: boolean;    // entities
  canConfigureColumns?: boolean; // data
  canExport?: boolean;         // data
  canImport?: boolean;         // data
}
```

### 3. tenantPermissions (PLATFORM_ADMIN only)

```typescript
interface TenantPermissions {
  canAccessAllTenants: boolean;
  allowedTenantIds: string[];   // Se !canAccessAllTenants
}
```

## Verificacao de Permissoes

### Backend (API)

**Guards:** `JwtAuthGuard` → `RolesGuard`

```typescript
@Controller('resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourceController {
  // Verificacao de modulo:
  @Get()
  async findAll(@CurrentUser() user: CurrentUser) {
    checkModulePermission(user, 'settings', 'canRead');
    return this.service.findAll(user);
  }

  // Verificacao de entidade (acao sub-granular):
  @Post('export')
  async export(@CurrentUser() user: CurrentUser) {
    checkEntityAction(user, 'clientes', 'canExport');
  }
}
```

**`checkModulePermission(user, module, action)`**
- PLATFORM_ADMIN e ADMIN → sempre permitido
- Verifica `customRole.modulePermissions[module][action]`
- Fallback para defaults do roleType se DB nao define o modulo
- Lanca `ForbiddenException` se negado

**`checkEntityAction(user, entitySlug, action)`**
- PLATFORM_ADMIN e ADMIN → sempre permitido
- Verifica AMBOS: `modulePermissions.data[action]` OU `permissions[entitySlug][action]`
- Qualquer um que concede → permite

**`CustomRoleService.getEntityScope(userId, entitySlug)`**
- PLATFORM_ADMIN, ADMIN, MANAGER, VIEWER → `'all'`
- USER → `'own'`
- CUSTOM → `permissions[entitySlug].scope` (default `'all'`)
- Sem acesso → `null`

**`CustomRoleService.getFieldPermissions(userId, entitySlug)`**
- PLATFORM_ADMIN, ADMIN → `null` (sem restricao)
- CUSTOM → `permissions[entitySlug].fieldPermissions`
- Outros → `null` (sem restricao)

### Pipeline de Dados (EntityDataQueryService)

O `EntityDataQueryService.buildWhere()` aplica automaticamente:

```
1. Tenant isolation (PLATFORM_ADMIN bypass via getEffectiveTenantId)
2. Scope (own → where.createdById = user.id)
3. Global filters (entity.settings.globalFilters)
4. Role data filters (customRole.permissions[entitySlug].dataFilters)
5. User filters, dashboard filters, search
```

**Arquivo:** `apps/api/src/common/services/entity-data-query.service.ts`

### Frontend (Next.js)

**Hook:** `usePermissions()`

```typescript
const {
  roleType,
  isAdmin,
  isPlatformAdmin,
  modulePermissions,
  entityPermissions,
  hasModuleAccess,        // (moduleKey) → boolean (canRead)
  hasModulePermission,    // (moduleKey, action) → boolean
  hasEntityPermission,    // (entitySlug, action) → boolean
  hasModuleAction,        // (moduleKey, action) → boolean (sub-granular)
  hasEntityAction,        // (entitySlug, action) → boolean (sub-granular)
  getEntityScope,         // (entitySlug) → 'all' | 'own'
  getDefaultRoute,        // () → string (rota inicial baseada em permissoes)
} = usePermissions();
```

**Uso no JSX:**

```tsx
// Condicional por modulo
{hasModuleAccess('users') && <Link href="/users">Usuarios</Link>}

// Condicional por acao CRUD em modulo
{hasModulePermission('users', 'canCreate') && <Button>Novo Usuario</Button>}

// Condicional por entidade
{hasEntityPermission('clientes', 'canDelete') && <Button>Excluir</Button>}

// Acao sub-granular
{hasEntityAction('clientes', 'canExport') && <Button>Exportar</Button>}
```

**Funcao pura (fora de componentes):**

```typescript
import { getDefaultRouteForUser } from '@/hooks/use-permissions';
const route = getDefaultRouteForUser(user);
```

## Defaults por roleType

Quando `modulePermissions` nao esta definido no DB, o sistema usa defaults:

| Modulo | MANAGER | USER | VIEWER |
|--------|---------|------|--------|
| dashboard | Read | Read | Read |
| data | CRU (sem D) | CRU (sem D) | Read |
| users | Read | Read | - |
| entities | - | CRU (sem D) | - |
| settings | - | Read | Read |
| roles | Read | - | - |
| pdfTemplates | Read+Generate | Read+Generate | Read+Generate |
| dashboardTemplates | - | - | - |

> PLATFORM_ADMIN e ADMIN sempre tem FULL CRUD em tudo. CUSTOM começa sem nada e recebe permissoes explicitas.

## Arquivos Relevantes

| Arquivo | Descricao |
|---------|-----------|
| `apps/api/src/modules/custom-role/custom-role.service.ts` | CRUD de roles + getEntityScope + getFieldPermissions |
| `apps/api/src/modules/custom-role/dto/custom-role.dto.ts` | DTOs com validacao class-validator |
| `apps/api/src/common/utils/check-module-permission.ts` | checkModulePermission() + checkEntityAction() |
| `apps/api/src/common/guards/roles.guard.ts` | RolesGuard (verifica @Roles decorator) |
| `apps/api/src/common/services/entity-data-query.service.ts` | Pipeline centralizado (scope + filtros) |
| `apps/web-admin/src/hooks/use-permissions.ts` | Hook frontend com toda logica de permissoes |
| `packages/shared/src/enums.ts` | RoleType, PermissionScope |
