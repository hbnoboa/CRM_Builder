# ANÁLISE DETALHADA DO SISTEMA CRM BUILDER

> Documento gerado em: 2026-04-09

## 📋 ÍNDICE

1. [Visão Geral Arquitetural](#visão-geral-arquitetural)
2. [Backend - Módulos API](#backend---módulos-api)
3. [Frontend - Arquitetura](#frontend---arquitetura)
4. [Padrões Arquiteturais](#padrões-arquiteturais)
5. [Fluxos Principais](#fluxos-principais)
6. [Tech Debt & Pontos de Atenção](#tech-debt--pontos-de-atenção)
7. [Relacionamento entre Módulos](#relacionamento-entre-módulos)
8. [Resumo Executivo](#resumo-executivo)

---

## VISÃO GERAL ARQUITETURAL

O CRM Builder é uma plataforma **SaaS multi-tenant** completa com arquitetura moderna baseada em:

- **Backend**: NestJS 10 + Prisma 5 + PostgreSQL 16
- **Frontend**: Next.js 14 (App Router) + shadcn/ui + TanStack Query
- **Mobile**: Flutter 3.32+ (offline-first via PowerSync)
- **State Management**: Zustand (frontend) + Riverpod (mobile)
- **Comunicação Realtime**: Socket.IO para notificações
- **Monorepo**: pnpm + Turborepo

---

## BACKEND - MÓDULOS API

### 1. AUTH MODULE ⚙️

**Responsabilidade**: Autenticação, autorização e gerenciamento de sessões

**Endpoints Principais**:
- `POST /auth/register` - Registro de novo usuário
- `POST /auth/login` - Login com rate limiting (5 req/min)
- `POST /auth/refresh` - Renovação de tokens
- `POST /auth/logout` - Logout e invalidação
- `GET /auth/me` - Perfil do usuário atual
- `PATCH /auth/profile` - Atualizar perfil
- `POST /auth/change-password` - Alteração segura de senha
- `POST /auth/switch-tenant` - Alternar entre tenants (multi-tenant)
- `GET /auth/accessible-tenants` - Listar tenants acessíveis
- `POST /auth/forgot-password` - Recuperação de senha
- `POST /auth/reset-password` - Reset com token

**Lógica Principal**:
- **JWT Strategy**: Access token (curta duração) + Refresh token (7-30 dias)
- **Bcrypt Hash**: Cost=12 para senhas (seguro)
- **Multi-Tenant**: Suporta UserTenantAccess para acesso a múltiplos tenants
- **Token Reuse Prevention**: Refresh tokens são deletados atomicamente ao usar (transação)
- **Remember Me**: Estende refresh token para 30 dias se habilitado

**Integrações**:
- NotificationService (notificar novo usuário)
- AuditService (registrar logins)

**Pontos de Atenção**:
- ✅ Rate limiting em endpoints sensíveis
- ✅ Suporte a tenant switching para PLATFORM_ADMIN
- ✅ Token atomicity com Prisma $transaction
- ⚠️ TODO: Integração real com email service para reset

---

### 2. USER MODULE 👥

**Responsabilidade**: Gerenciamento de usuários e controle de acesso a tenants

**Endpoints**:
- `GET /users/me` - Perfil do usuário atual
- `PATCH /users/me` - Atualizar próprio perfil (sem escalação)
- `POST /users` - Criar usuário (requer canCreate)
- `GET /users` - Listar usuários com paginação/cursor
- `GET /users/:id` - Buscar usuário específico
- `PATCH /users/:id` - Atualizar usuário (com validação de escalação)
- `DELETE /users/:id` - Excluir usuário
- **Tenant Access**:
  - `GET /users/:userId/tenant-access` - Listar acessos a tenants
  - `POST /users/:userId/tenant-access` - Conceder acesso a outro tenant
  - `DELETE /users/tenant-access/:accessId` - Revogar acesso

**Lógica Principal**:
- **Cursor-Based Pagination**: Para listas grandes, com tiebreaker por ID
- **Multi-Tenant Filtering**: PLATFORM_ADMIN pode ver qualquer tenant
- **Auto-Prevention**: Não pode deletar a si mesmo
- **CPF/Phone Normalization**: Apenas dígitos armazenados
- **Escalation Prevention**: Impede que usuário comum atribua roles superiores

**Guarda de Segurança**:
- `JwtAuthGuard` + `ModulePermissionGuard`
- Verificação ownership em updates/deletes

**Integrações**:
- NotificationService (notificar novo usuário)
- AuditService (log de criação/atualização)

**Pontos de Atenção**:
- ✅ Validação de tenant no grantTenantAccess
- ✅ Expiração de acesso com validação temporal
- ✅ Atomic upserting de UserTenantAccess
- ⚠️ Normalization de CPF/CNPJ pode ser mais rigorosa (validar dígito)

---

### 3. ENTITY MODULE 📋

**Responsabilidade**: CRUD de definições de entidades (estrutura de dados dinâmica)

**Endpoints**:
- `POST /entities` - Criar entidade
- `GET /entities` - Listar entidades
- `GET /entities/grouped` - Listar agrupadas por categoria
- `GET /entities/:id` - Buscar por ID
- `GET /entities/slug/:slug` - Buscar por slug
- `PATCH /entities/:id/column-config` - Configurar colunas visíveis
- `PATCH /entities/:id/global-filters` - Atualizar filtros globais
- `PATCH /entities/:id` - Atualizar entidade
- `DELETE /entities/:id` - Excluir entidade

**Lógica Principal**:
- **Slug Generation**: Normaliza nome para slug (remove acentos, converte para kebab-case)
- **Campos Dinâmicos**: Suporta diversos tipos (text, number, email, date, boolean, select, api-select, relation, sub-entity, etc.)
- **Campo API-Select**: Busca dados de endpoints customizados com auto-fill
- **Auto-Dashboard**: Cria automaticamente template de dashboard ao criar entidade
- **Global Filters**: Filtros aplicados globalmente em todas as queries (ex: esconder dados arquivados)
- **Field Validation**: Suporta validações condicionais (requiredIf, visibleIf, readOnlyIf)

**Integrações**:
- DashboardTemplateService (auto-criar template)
- NotificationService (notificar criação)
- AuditService (registrar mudanças)
- CustomRoleService (buscar roles para atribuir ao template)

**Pontos de Atenção**:
- ✅ Normalização robusta de slugs
- ✅ Suporte a campos computados e relações
- ✅ Auto-criação de dashboard com visibilidade inteligente
- ⚠️ Validações complexas podem impactar performance em update

---

### 4. DATA MODULE 💾

**Responsabilidade**: CRUD de registros de entidades (dados reais) - **Core da plataforma**

**Endpoints**:
- `POST /data/:entitySlug` - Criar registro
- `GET /data/:entitySlug` - Listar registros (com filtros, busca, paginação)
- `GET /data/:entitySlug/:id` - Buscar registro
- `PATCH /data/:entitySlug/:id` - Atualizar registro
- `DELETE /data/:entitySlug/:id` - Excluir (arquivar)
- **Export/Import**:
  - `GET /data/:entitySlug/export` - Exportar (XLSX/JSON)
  - `POST /data/:entitySlug/import/preview` - Preview de importação
  - `POST /data/:entitySlug/import` - Importar dados
- **Archive**:
  - `GET /data/:entitySlug/archived` - Listar arquivados

**Lógica Principal - EntityDataQueryService**:

Pipeline centralizado de segurança (OBRIGATÓRIO para EntityData):

1. **Tenant isolation** - Filtra por tenantId (PLATFORM_ADMIN pode bypass)
2. **Scope filtering** - Aplica scope (own/all) via getEntityScope()
3. **Global filters** - Aplica entity.settings.globalFilters
4. **Role data filters** - Aplica customRole.permissions[].dataFilters
5. **User filters** - Filtros específicos do usuário
6. **Dashboard filters** - Cross-entity filters
7. **Search** - Busca full-text em campos configurados

**Computed Fields**:
- **formula** - Calcula expressões matemáticas
- **rollup** - Agrega dados de registros relacionados
- **timer** - Calcula tempo decorrido
- **sla-status** - Verifica status de SLA

**Automations Trigger**:
- Dispara webhooks
- Executa action-chains (legado)
- Executa entity-automations (novo)

**Soft Delete**:
- Registros vão para ArchivedEntityData (com deletedAt)
- Pode restaurar

**Integrações**:
- EntityDataQueryService (segurança de dados)
- WebhookService (dispara webhooks em CRUD)
- ActionChainService (executa action chains legados)
- EntityAutomationService (executa automações novas)
- NotificationService (notifica mudanças)
- ComputedFieldsService (calcula campos especiais)
- AuditService (registra CRUD)

**Pontos de Atenção**:
- ✅ Separação clara entre entidade (schema) e dados (registros)
- ✅ Automações disparadas assincronamente
- ✅ Soft delete com suporte a restore
- ✅ Sparse fieldsets para reduzir payload
- ⚠️ Computed fields em larga escala pode ser lento
- ⚠️ Automações devem ter rate limiting

---

### 5. CUSTOM-ROLE MODULE 🔐

**Responsabilidade**: RBAC granular - definição e gerenciamento de permissões

**Endpoints**:
- `POST /custom-roles` - Criar role customizada
- `GET /custom-roles` - Listar roles (apenas ADMIN/PLATFORM_ADMIN)
- `GET /custom-roles/:id` - Buscar role
- `GET /custom-roles/my-permissions` - Obter permissões do usuário
- `PATCH /custom-roles/:id` - Atualizar role
- `DELETE /custom-roles/:id` - Excluir role
- `POST /custom-roles/:roleId/assign/:userId` - Atribuir role a usuário

**Modelo de Permissões Hierárquico**:

```
CustomRole
├── roleType: 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' | 'CUSTOM'
├── modulePermissions: Record<module, { canRead, canCreate, canUpdate, canDelete }>
│   └── Modulos: dashboard, users, entities, data, roles, automations, templates, logs, etc.
├── permissions: EntityPermission[]
│   └── Por entidade: { entitySlug, canRead, canCreate, canUpdate, canDelete, scope: 'all' | 'own', dataFilters }
└── tenantPermissions: Permissões específicas do tenant
```

**Lógica Principal**:
- **Legacy Format Migration**: Converte formato boolean antigo para CRUD
- **Scope**: Controla acesso a dados (all = todos, own = próprios registros)
- **DataFilters**: Filtros adicionais por campo (ex: status != 'archived')
- **System Roles**: PLATFORM_ADMIN hardcoded com tudo
- **Default Role**: Cada tenant tem uma role default (USER)

**Integrações**:
- AuditService (log de mudanças de role)

**Pontos de Atenção**:
- ✅ Normalização de permissões para compatibilidade
- ✅ Granularidade por módulo + por entidade
- ✅ Suporte a scopes (own/all)
- ⚠️ DataFilters podem ser complexos - necessário validação robusta

---

### 6. NOTIFICATION MODULE 📢

**Responsabilidade**: Notificações em tempo real via WebSocket + Push

**Endpoints**:
- Via Socket.IO (WebSocket) - namespace `/notifications`

**Lógica Principal**:
- **Gateway WebSocket**: Gerencia conexões autenticadas via JWT
- **Redis Adapter**: Suporta múltiplas instâncias (pub/sub)
- **Rooms**: Organiza por tenant (`tenant:{tenantId}`) e usuário (`user:{userId}`)
- **Push Notifications**: Envia também para mobile via PushService
- **Entity-Based Filtering**: Notifica apenas usuários com permissão na entidade
- **Persistence**: Salva notificações no banco (Notification table)

**Fluxo**:
1. Ação dispara notificação (ex: novo registro criado)
2. NotificationService envia via WebSocket + Push + salva no DB
3. Frontend recebe em tempo real via Socket.IO
4. Mobile recebe push notification

**Integrações**:
- PushService (notificações mobile)
- PrismaService (persistência)

**Pontos de Atenção**:
- ✅ Fallback para in-memory adapter (sem Redis)
- ✅ JWT validation em conexão
- ✅ Suporte a múltiplas instâncias (Redis)
- ⚠️ Notificações podem encher banco - implementar TTL/cleanup

---

### 7. ENTITY-AUTOMATION MODULE 🤖

**Responsabilidade**: Automações baseadas em eventos (novo modelo unificado)

**Endpoints**:
- CRUD de automações
- Execução manual de automações
- Logs de execução

**Componentes**:

1. **EntityAutomationService**: Orquestra automações
2. **AutomationExecutorService**: Executa ações sequencialmente
3. **ConditionEvaluator**: Avalia condições em tempo real
4. **AutomationSchedulerService**: Agenda execuções

**Triggers**:
- `ON_CREATE` - Quando registro é criado
- `ON_UPDATE` - Quando registro é atualizado
- `ON_DELETE` - Quando registro é deletado
- `ON_FIELD_CHANGE` - Quando campo específico muda
- `ON_STATUS_CHANGE` - Quando status muda
- `SCHEDULE` - Agendado (cron)
- `MANUAL` - Executado manualmente

**Ações**:
- `send_email` - Envia email via template
- `call_webhook` - Dispara webhook externo
- `update_field` - Atualiza campo do registro
- `create_record` - Cria novo registro em outra entidade
- `notify_user` - Envia notificação
- `change_status` - Altera status
- `wait` - Aguarda (delay)
- `lookup_record` - Busca dados de outra entidade
- `update_related_record` - Atualiza registros relacionados
- `aggregate_records` - Calcula agregação
- `run_script` - Executa script customizado (VM)

**Lógica Principal**:
- **Execução Sequencial**: Ações executam em ordem (order field)
- **Passagem de Contexto**: lookupResults compartilha dados entre ações
- **Avaliação de Condições**: Condições globais + por ação
- **Rate Limiting**: Máximo de execuções/hora
- **Execution Log**: Rastreia cada passo com duração, status, erro
- **VM Script**: Executa scripts em sandbox (Node.js VM)

**Integrações**:
- EmailTemplateService (enviar emails)
- NotificationService (notificar usuários)
- DataService (criar/atualizar registros)

**Pontos de Atenção**:
- ✅ Model unificado (depreca webhooks + action-chains legados)
- ✅ Fallback para serviços legados (opcional)
- ✅ Rate limiting para evitar loops infinitos
- ✅ Execução async com criação de log
- ⚠️ VM script pode ter overhead - considerar timeout
- ⚠️ Recursão de automações (A cria B cria A) pode causar loop

---

### 8. WEBHOOK MODULE 🪝

**Responsabilidade**: Webhooks HTTP para integração externa (modelo legado)

**Endpoints**:
- CRUD de webhooks
- Trigger webhooks

**Lógica**:
- **Filtros**: Filtra eventos por condições
- **Retry**: Retentas com exponential backoff
- **Signatures**: HMAC-SHA256 para segurança
- **Timeout**: Configurável (default 30s)

**Integrações**:
- DataService (trigger em CRUD)

**Pontos de Atenção**:
- ⚠️ Modelo legado - migrar para EntityAutomation
- ✅ Mantém retrocompatibilidade

---

### 9. ACTION-CHAIN MODULE ⛓️

**Responsabilidade**: Fluxos de ação legados (deprecado em favor de EntityAutomation)

**Logica**:
- Triggers e ações customizadas
- Suporte a condições

**Pontos de Atenção**:
- ⚠️ Modelo legado - em transição para EntityAutomation
- ✅ Fallback ainda suportado no DataService

---

### 10. DASHBOARD-TEMPLATE MODULE 📊

**Responsabilidade**: Definição de dashboards por role

**Endpoints**:
- CRUD de templates de dashboard
- GET templates por role

**Lógica**:
- **Widgets**: Cada template contém múltiplos widgets (data-table, chart, stat, kanban, etc.)
- **Role-Based**: Templates atribuídos a roles específicas
- **Entity-Bound**: Template vinculado a uma entidade
- **Auto-Creation**: Cria automaticamente ao criar entidade

**Widget Types**:
- `data-table` - Tabela de dados
- `chart` - Gráficos (bar, line, pie)
- `stat` - Estatísticas (número, métrica)
- `kanban` - Quadro kanban
- `form` - Formulário
- `map` - Mapa
- `timeline` - Timeline

**Integrações**:
- EntityService (criação automática)

**Pontos de Atenção**:
- ✅ Flexibilidade de widgets
- ✅ Suporte a cross-filters entre widgets
- ⚠️ Atualizar configs de widgets pode ser complexo

---

### 11. PDF MODULE 📄

**Responsabilidade**: Geração e gerenciamento de templates PDF

**Endpoints**:
- CRUD de templates
- GET geração de PDF

**Lógica**:
- **Template Engine**: Suporta variables e condições
- **Data Binding**: Vincula dados do registro
- **Async Generation**: Gera em background

**Integrações**:
- DataService (dados para gerar)

---

### 12. ARCHIVE MODULE 📦

**Responsabilidade**: Gerenciamento de dados arquivados

**Lógica**:
- **Soft Delete**: Registros marcados com deletedAt
- **Restore**: Pode restaurar registros arquivados
- **Query Filtering**: Queries por padrão excluem arquivados

---

### 13. SYNC MODULE 🔄

**Responsabilidade**: Integração com PowerSync (mobile offline-first)

**Endpoint**:
- `POST /sync/credentials` - Obter token JWT para PowerSync

**Lógica**:
- Gera JWT com claims para PowerSync validar
- Suporta tenant switching para PLATFORM_ADMIN
- Token inclui: sub, user_id, tenantId, customRoleId, roleType

**Integrações**:
- Mobile app (Flutter)

**Pontos de Atenção**:
- ✅ Suporte a múltiplas instâncias de mobile
- ✅ PLATFORM_ADMIN override de tenant
- ⚠️ Coordenar com PowerSync sync rules

---

### 14. AUDIT MODULE 📋

**Responsabilidade**: Auditoria de ações (quem, o quê, quando)

**Endpoints**:
- GET logs de auditoria com paginação

**Lógica**:
- **Fire-and-Forget**: Não bloqueia requisição principal
- **Structured Logging**: action, resource, resourceId, oldData, newData
- **User Context**: Registra quem fez ação
- **Metadata**: Informações adicionais

**Integrações**:
- Todas as operações CRUD registram logs

**Pontos de Atenção**:
- ✅ Nunca loga senhas/tokens (segurança)
- ✅ Async para não impactar performance
- ⚠️ Pode crescer rapidamente - implementar cleanup

---

### 15. OUTROS MÓDULOS

#### EMAIL MODULE 📧
- Integração com serviço de email
- Interface genérica para providers (SendGrid, etc.)
- Templates com variables

#### PUSH MODULE 📱
- Push notifications para mobile
- Integração com Firebase Cloud Messaging
- Envio assíncrono

#### EXECUTION-LOGS MODULE ⏱️
- Logs de execução de automações
- GET histórico de execuções
- GET detalhes de execução

#### ESCALATION MODULE 📈
- Escalações automáticas de SLA

#### PUBLIC-LINK MODULE 🔗
- Links públicos para compartilhar dados
- Token-Based Access
- Expiration e permissions

#### STATS/METRICS MODULE 📈
- Estatísticas e métricas
- GET estatísticas (total registros, etc.)

#### TENANT MODULE 🏢
- Gerenciamento de tenants (empresas)
- CRUD de tenants
- Cópia de tenant (clone)

#### UPLOAD MODULE 📤
- Upload de arquivos
- File Validation
- Secure Storage (UUID)

#### ENTITY-FIELD-RULE MODULE 📏
- Regras de validação por campo

#### HEALTH MODULE 💚
- Health check
- `GET /health` - Status da API

---

## FRONTEND - ARQUITETURA

### Estrutura de Diretórios

```
src/
├── app/                          # Next.js App Router
│   ├── [locale]/                 # i18n
│   ├── dashboard/                # Dashboard
│   ├── data/                      # Data explorer (registros)
│   ├── entities/                  # Entity editor
│   ├── users/                     # User management
│   ├── roles/                     # Role management
│   ├── settings/                  # Settings
│   ├── tenants/                   # Tenant management
│   ├── login/                     # Login page
│   ├── register/                  # Register page
│   ├── profile/                   # User profile
│   └── ...outros
├── components/                   # Componentes React
│   ├── ui/                        # shadcn/ui base
│   ├── fields/                    # Field renderers (text, select, date, etc.)
│   ├── entity-data/               # CRUD components
│   ├── entity-editor/             # Entity schema editor
│   ├── entity-automation/         # Automation builder
│   ├── dashboard-widgets/         # Dashboard widgets
│   ├── data/                      # Data table, filters
│   ├── form/                      # Form components
│   ├── users/                     # User CRUD
│   ├── roles/                     # Role CRUD
│   ├── auth/                      # Auth components (login form)
│   ├── notifications/             # Notification UI
│   ├── pdf/                       # PDF editor/viewer
│   ├── pdf-editor/                # PDF template builder
│   └── ...
├── stores/                       # Zustand stores
│   ├── auth-store.ts             # Auth state
│   └── public-auth-store.ts      # Public link auth
├── hooks/                        # React hooks (TanStack Query)
│   ├── use-auth.ts
│   ├── use-data.ts              # Entity data queries
│   ├── use-entities.ts
│   ├── use-users.ts
│   ├── use-permissions.ts       # RBAC logic
│   ├── use-custom-roles.ts
│   ├── use-dashboard-templates.ts
│   ├── use-entity-automations.ts
│   └── ...
├── services/                     # API clients
│   ├── auth.service.ts
│   ├── data.service.ts          # DataService
│   ├── entities.service.ts
│   ├── users.service.ts
│   └── ...
├── types/                        # TypeScript types
├── lib/                          # Utilidades
│   ├── api.ts                   # Axios instance com interceptors
│   ├── jwt.ts                   # JWT utilities
│   └── ...
└── i18n/                         # Internacionalização
```

### 1. Authentication Flow 🔐

```
Login → AuthService.login() → Store accessToken + refreshToken
         ↓
App Mount → useAuthStore.ensureAuth() → Check token expiry
         ↓
   If expired → Refresh via /auth/refresh
         ↓
   Update tokens → getProfile() → Load user data
         ↓
   Redirect to dashboard or requested page
```

**Armazenamento**:
- localStorage: `accessToken`, `refreshToken`
- Zustand Store: `user` (apenas isAuthenticated persisted, não user para evitar PII)

**JWT Validation**:
- `isTokenExpired()` - Decodifica JWT e verifica exp claim
- Refresh automático em interceptor se expirado

**Multi-Tenant Switching**:
```
switchTenant(tenantId) → POST /auth/switch-tenant → Novo JWT com tenantId
                      → Update localStorage + store
                      → Dispatch custom event 'tenant-changed'
```

---

### 2. Permissions System 🛡️

**usePermissions Hook** - Lógica centralizada:

```typescript
interface UsePermissionsReturn {
  user: User | null
  roleType: RoleType                    // PLATFORM_ADMIN | ADMIN | MANAGER | USER | VIEWER | CUSTOM
  modulePermissions: ModulePermissions  // dashboard, users, entities, data, etc.
  entityPermissions: EntityPermission[] // Por entidade: {entitySlug, canRead, canCreate, ...}

  // Checkers
  hasModuleAccess(moduleKey): boolean                    // canRead?
  hasModulePermission(moduleKey, 'canCreate'): boolean  // Ação específica
  hasEntityPermission(entitySlug, 'canCreate'): boolean // Entidade específica
  hasModuleAction(moduleKey, action): boolean           // Ação sub-granular
  hasEntityAction(entitySlug, action): boolean
  getEntityScope(entitySlug): 'all' | 'own'            // Acesso dados do usuário ou todos
  getDefaultRoute(): string                             // Rota inicial baseada perms

  isAdmin: boolean  // PLATFORM_ADMIN
}
```

**Fluxo de Validação**:
1. User carrega do token JWT
2. CustomRole carregada com modulePermissions + permissions[]
3. **PLATFORM_ADMIN**: Tem acesso total hardcoded
4. **Outros roles**: Dependem APENAS de modulePermissions no DB
5. **Normalization**: Boolean antigo (true/false) → CRUD object

**Permission Gates** (Componentes):
```tsx
<PermissionGate resource="user" action="create">
  <Button>Novo Usuário</Button>  {/* Só aparece se tem permissão */}
</PermissionGate>
```

---

### 3. Data Fetching Architecture 📡

**TanStack Query (React Query)**:
- Caching automático
- Refetch em background
- Polling opcional
- Offline mode parcial

**Query Keys Strategy**:
```typescript
dataKeys = {
  all: ['entityData'],
  lists: () => [...all, 'list'],
  list: (entitySlug, params?) => [...lists(), entitySlug, params],
  infinite: (entitySlug, params?) => [...lists(), 'infinite', entitySlug, params],
  details: () => [...all, 'detail'],
  detail: (entitySlug, id) => [...details(), entitySlug, id],
}
```

**Hooks de Dados**:

1. **useEntityData** - Paginação offset (tabelas)
```typescript
const { data, isLoading, error, isPreviousData } = useEntityData(
  'users',
  { page: 1, limit: 20, search: 'João' }
)
```

2. **useInfiniteEntityData** - Infinite scroll (listas grandes)
```typescript
const { items, hasMore, isLoadingMore, loadMore } = useInfiniteEntityData(
  'users',
  { search: 'João' }
)
```

3. **useEntityDataItem** - Detalhe
```typescript
const { data: record, isLoading } = useEntityDataItem('users', userId)
```

4. **useCreateEntityData** - Criar
```typescript
const { mutate, isPending } = useCreateEntityData({
  success: 'Usuário criado!',
  error: 'Erro ao criar'
})
```

5. **useUpdateEntityData** - Atualizar
6. **useDeleteEntityData** - Deletar

**Filtros e Busca**:
- Aceita `filters` (array JSON stringified)
- Aceita `search` (busca full-text)
- Aceita `sortBy` e `sortOrder`
- Cursor-based pagination para performance

---

### 4. State Management 🗂️

**Zustand Stores**:

1. **useAuthStore** - Autenticação global
   - `user`: User | null
   - `isAuthenticated`: boolean
   - `isLoading`: boolean
   - `error`: string | null
   - Métodos: `login()`, `register()`, `logout()`, `switchTenant()`, `ensureAuth()`

2. **useTenantStore** (opcional) - Tenant atual

**Por que Zustand + TanStack Query?**
- **Zustand**: Estado global pequeno (auth, UI state)
- **TanStack Query**: Server state grande (listas, detalhes)

---

### 5. Principais Páginas e Componentes 🏗️

#### **Dashboard** (`/dashboard`)
- Widgets: data-table, chart, stat, kanban
- Cross-filters entre widgets
- Templates por role

#### **Data Explorer** (`/data/:entitySlug`)
- Data table com sort/filter
- Busca
- Inline editing
- Criar novo registro
- Exportar/Importar
- Sub-registros (parent-child)

#### **Entity Editor** (`/entities/:id`)
- WYSIWYG schema editor
- Adicionar/remover/editar campos
- Validações por campo
- Relation/sub-entity config

#### **User Management** (`/users`)
- CRUD de usuários
- Atribuição de roles
- Tenant access management
- Avatar upload

#### **Role Management** (`/roles`)
- CRUD de roles
- Module permissions grid (CRUD por módulo)
- Entity permissions (CRUD por entidade)
- Scope (all/own)

#### **Automations** (`/automations/:entityId`)
- Builder visual
- Triggers dropdown
- Ações customizáveis
- Condições
- Execution logs

#### **Settings**
- Configurações do tenant
- Global filters
- Field types customizados

---

### 6. Componentes Especializados 🎨

#### **Field Renderers** (`components/fields/`)
Renderizam campos dinâmicos baseado no tipo:
- TextField (text, email, url)
- NumberField
- SelectField
- DateField
- CheckboxField
- RelationField (busca registros)
- SubEntityField (embeds)
- FileField (upload)
- SignatureField
- MapField
- JSONField

#### **Data Table** (`components/data/DataTable.tsx`)
- Virtualization (milhares de linhas)
- Sortable columns
- Filtros por coluna
- Inline editing
- Selection (multi-select)
- Pagination

#### **Dashboard Widgets** (`components/dashboard-widgets/`)
- **DataTableWidget**: Tabela
- **ChartWidget**: Gráficos (bar, line, pie)
- **StatWidget**: Números/métricas
- **KanbanWidget**: Quadro
- **FormWidget**: Entrada
- **MapWidget**: Mapa
- **TimelineWidget**: Timeline

---

### 7. Form Handling 📝

**Zod Validation** (client-side):
```typescript
const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})
```

**React Hook Form**:
```typescript
const form = useForm({ resolver: zodResolver(schema) })
const onSubmit = async (data) => {
  await userService.create(data)
}
```

---

### 8. API Client Setup 🔌

**Axios Instance** (`lib/api.ts`):
```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
})

// Request interceptor - adiciona token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - refresh automático
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Tentar refresh
      const refreshToken = localStorage.getItem('refreshToken')
      const response = await axios.post('/auth/refresh', { refreshToken })
      // Update tokens + retry
    }
    return Promise.reject(error)
  }
)
```

---

### 9. Real-Time Updates 📡

**Socket.IO Connection** (listener):
```typescript
// apps/web-admin/src/lib/socket.ts
import io from 'socket.io-client'

const socket = io(SOCKET_URL, {
  auth: { token: localStorage.getItem('accessToken') },
})

socket.on('notification', (data) => {
  // Mostrar toast/notificação
})
```

**Integração com TanStack Query**:
```typescript
useEffect(() => {
  socket.on('data:created', ({ entitySlug }) => {
    queryClient.invalidateQueries({
      queryKey: dataKeys.list(entitySlug)
    })
  })
}, [queryClient])
```

---

## PADRÕES ARQUITETURAIS

### 1. Multi-Tenancy Enforcement
✅ **Centralizado**: `EntityDataQueryService` em backend
✅ **Isolamento**: Toda query filtra por tenantId
✅ **PLATFORM_ADMIN Bypass**: Pode ver qualquer tenant
✅ **Frontend**: Validação permissões antes de render

### 2. RBAC (Role-Based Access Control)
✅ **Hierarchical**: PLATFORM_ADMIN > ADMIN > MANAGER > USER > VIEWER > CUSTOM
✅ **Module-Level**: dashboard, users, entities, data, etc.
✅ **Entity-Level**: Por slug de entidade
✅ **Scope-Level**: all (todos) vs own (próprios)
✅ **Field-Level**: DataFilters (ex: status != archived)

### 3. Rate Limiting & Security
✅ **API Rate Limiting**: @Throttle decorator
✅ **Bcrypt Hashing**: Cost=12 para senhas
✅ **JWT Tokens**: Access (curta) + Refresh (longa)
✅ **CORS Configurado**: Whitelist de origins
✅ **Input Validation**: class-validator (backend) + Zod (frontend)

### 4. Async/Fire-and-Forget
✅ **Notifications**: Não bloqueia requisição
✅ **Automations**: Disparadas async
✅ **Audit Logs**: Registrados async
✅ **Email**: Enfileirado assincronamente

### 5. Data Query Pipeline

**Backend (EntityDataQueryService)**:
1. Tenant isolation
2. Scope filtering (own/all)
3. Global filters (entity.settings.globalFilters)
4. Role data filters (permissions.dataFilters)
5. User filters
6. Dashboard filters
7. Search

**Frontend (useData hooks)**:
1. Formato de query (offset vs cursor)
2. Lazy loading (infinite scroll)
3. Caching (TanStack Query)
4. Real-time updates (Socket.IO)

### 6. Field Type System
**Dinâmico**: text, email, number, date, boolean, select, api-select, relation, sub-entity, file, signature, map, json, formula, rollup, timer, sla-status

**Validações Condicionais**: requiredIf, visibleIf, readOnlyIf

### 7. Automations Pipeline
1. **Trigger**: ON_CREATE, ON_UPDATE, ON_DELETE, ON_FIELD_CHANGE, SCHEDULE, MANUAL
2. **Condition Check**: Avalia condições globais
3. **Action Loop**: Executa ações em sequência
4. **Context Passing**: lookupResults compartilha dados
5. **Logging**: Rastreia cada passo

---

## FLUXOS PRINCIPAIS

### Fluxo de Login

```
1. User digita email + password
2. POST /auth/login → {user, accessToken, refreshToken}
3. localStorage salva tokens
4. useAuthStore atualiza user + isAuthenticated
5. usePermissions carrega modulePermissions + entityPermissions
6. Redirect para dashboard (ou default route)
7. App renderiza com base em hasModuleAccess
```

### Fluxo de CRUD de Dados

```
1. GET /data/:entitySlug?filters=...&search=...
   ↓ Backend: EntityDataQueryService.buildWhere()
   - Filtra por tenantId
   - Aplica scope (own/all)
   - Aplica globalFilters
   - Aplica roleDataFilters
   - Aplica search
2. Response: {data: [], meta: {...}, entity: {...}}
3. Frontend: useEntityData() cai em cache TanStack Query
4. DataTable renderiza com sort/filter/inline-edit
5. PATCH /data/:entitySlug/:id → Update
6. Trigger automations (webhook, EntityAutomation, action-chain)
7. Socket.IO dispara 'data:updated'
8. TanStack Query invalida query → rerender
```

### Fluxo de Automação

```
1. User cria registro
2. DataService.create() → triggerAutomations('created')
3. EntityAutomationService.triggerByEvent()
4. AutomationExecutorService.executeAutomation()
   - Evalua condições globais
   - Loop: para cada ação
     - Evalua condição da ação
     - Executa ação (send_email, update_field, etc.)
     - Registra resultado
5. AutomationExecution salvo com: status, steps, errors
6. NotificationService notifica usuários
7. Logs expostos em UI (/automations/:id/logs)
```

---

## TECH DEBT & PONTOS DE ATENÇÃO

### Críticos 🔴

1. **Automations pode causar loops infinitos**
   - Rate limiting existe, mas pode ser mais agressivo
   - Considerar detecção de recursão

2. **EntityDataQueryService pode ter N+1 queries**
   - Roles com muitos permissions podem ser lentos
   - Considerar cache de permissions

3. **Computed fields em larga escala**
   - Formula, rollup, timer podem ser lentos
   - Considerar precalcular ou cache

### Importantes 🟡

4. **Audit logs podem crescer rapidamente**
   - Implementar TTL (ex: 90 dias)
   - Considerar archive/compression

5. **Soft deletes (deletedAt) aumentam tamanho**
   - Considerar migrate para hard delete + archive table

6. **WebSocket Gateway sem heartbeat explícito**
   - Pode desconectar em redes instáveis

7. **PowerSync sync rules complexas**
   - Sincronização bidirecional pode conflitar
   - Implementar conflict resolution robusto

### Melhorias Técnicas 🔄

8. **Migrar EntityAutomation para queue (Bull/RabbitMQ)**
   - Atualmente síncrono em-memory
   - Escalar para processos externos

9. **Caching de roles/permissions**
   - Usar Redis para cache com TTL
   - Invalidar em broadcast

10. **Batch operations**
    - Import grande pode ser lento
    - Considerar streaming/chunking

11. **Frontend offline mode**
    - Cache de dados para offline read
    - Queue de ações para quando voltar online

### Security ✅

12. **HTTPS em produção** (não observado no código)
13. **Rate limiting mais agressivo em endpoints públicos**
14. **CSRF protection** (verificar middleware)
15. **SQL injection prevention** (Prisma safe por padrão)
16. **XSS prevention** (React escapa HTML por padrão)

---

## RELACIONAMENTO ENTRE MÓDULOS

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTH (centralizador)                       │
│  - JWT geração                                               │
│  - Login/Logout                                              │
│  - Tenant switching                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      USER     ENTITY     CUSTOM-ROLE
        │          │          │
        │          │          ├─────────────────┐
        │          │          │                 │
        │          ▼          ▼                 ▼
        │       ENTITY-DATA   PERMISSION       DASHBOARD
        │       (core)        GATES            (templates)
        │          │
        │          ├──────────┬──────────┬──────────┐
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
    NOTIFICATION WEBHOOK ACTION-CHAIN ENTITY-     ARCHIVE
                                      AUTOMATION
                                          │
                                          ├─ EMAIL
                                          ├─ PUSH
                                          └─ RUN-SCRIPT

        ┌─────────────────────────────────────────┐
        │  AUDIT (observador)                      │
        │  - Registra todas as mudanças           │
        │  - Async (fire-and-forget)              │
        └─────────────────────────────────────────┘

        ┌─────────────────────────────────────────┐
        │  SYNC (mobile)                           │
        │  - JWT para PowerSync                    │
        │  - Offline sync bidirectional           │
        └─────────────────────────────────────────┘
```

---

## RESUMO EXECUTIVO

**CRM Builder** é uma plataforma enterprise robusta com:

✅ **Segurança Multi-Layer**: Tenant isolation, RBAC, rate limiting, bcrypt
✅ **Performance**: Cursor pagination, computed fields, query optimization
✅ **Extensibilidade**: Campos dinâmicos, automações, webhooks, APIs públicas
✅ **Real-Time**: WebSocket com Redis adapter, notifications
✅ **Mobile**: PowerSync offline-first com sincronização bidirecional
✅ **Developer Experience**: TypeScript strict, Zod validation, TanStack Query

**Pontos Críticos**:
- 🔴 Loops infinitos em automações (rate limit atual insuficiente)
- 🟡 N+1 queries em roles com muitas permissions
- 🟡 Crescimento exponencial de audit logs

**Recomendações**:
1. Implementar queue async (Bull) para automations
2. Cache Redis para roles/permissions
3. TTL em audit logs + archive
4. Testes de carga antes de production scale

Arquitetura bem organizada, separação clara de responsabilidades, mas precisa melhorias em escalabilidade para produção high-traffic.

---

**Documento completo gerado em 2026-04-09**
