# Banco de Dados

## Tecnologia

- **PostgreSQL 16** - Banco principal
- **Prisma 5** - ORM
- **Redis 7** - Cache (sessoes, rate limiting)

## Modelos Principais

### Tenant (Empresa)
```prisma
model Tenant {
  id       String  @id @default(cuid())
  name     String
  slug     String  @unique
  domain   String? @unique
  logo     String?
  settings Json    @default("{}")
  status   Status  @default(ACTIVE) // ACTIVE, INACTIVE, SUSPENDED
}
```

### User
```prisma
model User {
  id           String @id @default(cuid())
  tenantId     String
  email        String
  password     String
  name         String
  avatar       String?
  customRoleId String         // FK para CustomRole (sistema RBAC)
  status       Status @default(ACTIVE)

  @@unique([tenantId, email])
}
```

> **Nota:** O campo `role` (UserRole enum) foi removido. Agora o tipo de usuario e determinado por `customRole.roleType`.

### CustomRole (RBAC Granular)
```prisma
model CustomRole {
  id          String  @id @default(cuid())
  tenantId    String
  name        String
  description String?
  color       String? @default("#6366f1")
  roleType    String  @default("CUSTOM") // PLATFORM_ADMIN, ADMIN, MANAGER, USER, VIEWER, CUSTOM
  isSystem    Boolean @default(false)     // Protege nome e roleType

  // Permissoes por entidade (JSON array)
  permissions       Json @default("[]")   // EntityPermission[]
  // Permissoes por modulo do sistema (JSON object)
  modulePermissions Json @default("{}")   // ModulePermissions
  // Permissoes de tenant (PLATFORM_ADMIN only)
  tenantPermissions Json @default("{}")   // TenantPermissions

  isDefault Boolean @default(false)

  @@unique([tenantId, name])
}
```

Ver [PERMISSIONS.md](PERMISSIONS.md) para detalhes sobre a estrutura de permissoes.

### UserTenantAccess (Multi-tenant por usuario)
```prisma
model UserTenantAccess {
  id           String    @id @default(cuid())
  userId       String
  tenantId     String
  customRoleId String        // Role neste tenant especifico
  status       Status    @default(ACTIVE)
  expiresAt    DateTime?

  @@unique([userId, tenantId])
}
```

### Entity (Definicao de Entidade Dinamica)
```prisma
model Entity {
  id          String  @id @default(cuid())
  tenantId    String
  name        String      // "Cliente"
  namePlural  String      // "Clientes"
  slug        String      // "cliente"
  description String?
  icon        String?     // Lucide icon name
  color       String?     // Hex color
  fields      Json        // EntityField[]
  settings    Json @default("{}") // EntitySettings
  category    String?     // Agrupamento visual
  isSystem    Boolean @default(false)

  @@unique([tenantId, slug])
}
```

### EntityData (Dados das Entidades)
```prisma
model EntityData {
  id             String    @id @default(cuid())
  tenantId       String
  entityId       String
  data           Json          // Dados dinamicos do registro
  parentRecordId String?       // Sub-entidade: FK para registro pai
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdById    String?
  updatedById    String?
  deletedAt      DateTime?     // Soft delete (PowerSync sync)

  // Colunas mantidas por triggers PostgreSQL (PowerSync sync):
  matchesGlobalFilter  Boolean @default(true)  // Registro passa nos globalFilters?
  parentMatchesFilter  Boolean @default(true)  // Pai passa nos filtros? (sub-entidades)
  visibleToRoles       String[]                // IDs de CustomRole que veem este registro
  hasRoleFilter        Boolean @default(false) // Tem filtro de role ativo?
  visibleToRolesJson   Json    @default("[]")  // JSONB para PowerSync IN operator
}
```

### ArchivedEntityData (Dados Arquivados)
```prisma
model ArchivedEntityData {
  id             String   @id          // Mesmo ID do EntityData original
  tenantId       String
  entityId       String
  data           Json
  parentRecordId String?
  createdAt      DateTime
  updatedAt      DateTime
  createdById    String?
  updatedById    String?
  archivedAt     DateTime @default(now())
}
```

> **Nota:** ArchivedEntityData NAO tem colunas PowerSync (matchesGlobalFilter, visibleToRoles, etc.) porque registros arquivados nao sincronizam com o mobile.

### DashboardTemplate
```prisma
model DashboardTemplate {
  id          String  @id @default(cuid())
  tenantId    String
  name        String
  description String?
  entitySlug  String?     // null = dashboard global
  layout      Json @default("[]")    // react-grid-layout items
  widgets     Json @default("{}")    // { "widget-id": { type, title, config } }
  roleIds     String[]               // CustomRole IDs atribuidas
  priority    Int     @default(0)
  isActive    Boolean @default(true)

  @@unique([tenantId, name])
}
```

### PdfTemplate
```prisma
model PdfTemplate {
  id             String @id @default(cuid())
  tenantId       String
  name           String
  slug           String
  pageSize       PdfPageSize    @default(A4)
  orientation    PdfOrientation @default(PORTRAIT)
  margins        Json
  content        Json @default("{}")   // Editor visual JSON
  sourceEntityId String?               // Entidade fonte de dados
  selectedFields Json @default("[]")
  templateType   String @default("single") // "single" | "batch"
  isPublished    Boolean @default(false)
  version        Int     @default(1)

  @@unique([tenantId, slug])
}
```

## Estrutura de Fields (Entity.fields)

```typescript
interface EntityField {
  slug: string;           // Identificador unico (kebab-case)
  name: string;           // Nome para exibicao
  type: FieldType;        // Tipo do campo
  required: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];  // Para select, multiselect, radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  // Campos de relacao
  relatedEntitySlug?: string;
  relatedDisplayField?: string;
  // Campos computados
  formula?: string;       // Formula de calculo
  rollupConfig?: object;  // Rollup de sub-entidades
  timerConfig?: object;   // Timer/SLA
}

type FieldType =
  | 'text' | 'textarea' | 'richtext'
  | 'number' | 'currency'
  | 'email' | 'phone' | 'url' | 'cpf' | 'cnpj'
  | 'date' | 'datetime' | 'time'
  | 'boolean'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'file' | 'image' | 'video'
  | 'color'
  | 'relation'
  | 'computed' | 'formula' | 'rollup' | 'timer';
```

## Estrutura de Settings (Entity.settings)

```typescript
interface EntitySettings {
  titleField?: string;          // Campo usado como titulo do registro
  searchFields?: string[];      // Campos incluidos na busca textual
  globalFilters?: GlobalFilter[]; // Filtros aplicados automaticamente a todos
  slaConfig?: SlaConfig;        // Configuracao de SLA
  archiveConfig?: {             // Arquivamento automatico
    enabled: boolean;
    daysOld: number;
    statusField?: string;
    statusValue?: string;
  };
}

interface GlobalFilter {
  fieldSlug: string;
  fieldName: string;
  fieldType: string;
  operator: string;   // equals, contains, gt, lt, between, isEmpty, etc.
  value?: unknown;
  value2?: unknown;    // Para operator "between"
}
```

## Modelos de Automacao

```
EntityAutomation   → Automacoes trigger-based por entidade
ActionChain        → Cadeia de acoes (workflow manual/event/schedule)
ScheduledTask      → Tarefas agendadas (cron)
Webhook            → Webhooks outbound
EmailTemplate      → Templates de email
```

## Modelos de Comunicacao

```
Notification       → In-app + WebSocket
DeviceToken        → Push notifications (mobile)
```

## Modelos de Auditoria

```
AuditLog                 → Log de auditoria
WebhookExecution         → Log de webhooks
ActionChainExecution     → Log de action chains
ScheduledTaskExecution   → Log de scheduled tasks
AutomationExecution      → Log de entity automations
ApiExecutionLog          → Log de APIs customizadas
```

## Enums

```prisma
enum Status { ACTIVE, INACTIVE, SUSPENDED }
enum HttpMethod { GET, POST, PUT, PATCH, DELETE }
enum PdfPageSize { A4, LETTER, LEGAL }
enum PdfOrientation { PORTRAIT, LANDSCAPE }
enum PdfGenerationStatus { PENDING, PROCESSING, COMPLETED, FAILED }
enum NotificationType { INFO, SUCCESS, WARNING, ERROR }
enum WebhookStatus { ACTIVE, INACTIVE, PAUSED }
enum AutomationTrigger { ON_CREATE, ON_UPDATE, ON_DELETE, ON_FIELD_CHANGE, ON_STATUS_CHANGE, SCHEDULE, MANUAL }
enum ActionChainTrigger { MANUAL, WEBHOOK, SCHEDULE, EVENT }
```

## Indices Importantes

```prisma
// Multi-tenancy: SEMPRE indexar tenantId
@@index([tenantId])
@@index([tenantId, entityId])
@@index([tenantId, slug])

// Performance de listagem
@@index([tenantId, entityId, createdAt(sort: Desc)])
@@index([entityId, createdAt(sort: Desc)])

// Sub-entidades
@@index([parentRecordId])
@@index([entityId, parentRecordId])

// Soft delete (PowerSync)
@@index([deletedAt])
```

## Comandos Prisma

```bash
# Gerar client (necessario apos mudancas no schema)
cd apps/api && npx prisma generate

# Criar migration
cd apps/api && npx prisma migrate dev --name descricao

# Push direto (dev only - NAO usar em producao)
cd apps/api && npx prisma db push

# Seed
cd apps/api && npx prisma db seed

# Studio (UI visual)
cd apps/api && npx prisma studio

# Deploy (producao - apenas aplica migrations pendentes)
cd apps/api && npx prisma migrate deploy
```
