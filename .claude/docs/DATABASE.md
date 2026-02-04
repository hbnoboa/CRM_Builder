# 🗃️ Banco de Dados

## Tecnologia

- **PostgreSQL 16** - Banco principal
- **Prisma 5** - ORM
- **Redis 7** - Cache (opcional)

## Schema Overview

```prisma
// Multi-tenancy
Tenant          → Organization → Organization
                      ↓
                    User

// CRM Builder
Entity          → EntityData
Page            → (Puck JSON)
CustomEndpoint  → (Logic JSON)

// RBAC
Role            → UserRole_ → User
```

## Modelos Principais

### Tenant
```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  domain    String?  @unique
  logo      String?
  settings  Json     @default("{}")
  plan      Plan     @default(FREE)    // FREE, STARTER, PROFESSIONAL, ENTERPRISE
  status    Status   @default(ACTIVE)  // ACTIVE, INACTIVE, SUSPENDED
}
```

### Organization
```prisma
model Organization {
  id        String @id @default(cuid())
  tenantId  String
  name      String
  slug      String
  settings  Json   @default("{}")
  
  @@unique([tenantId, slug])
}
```

### Organization
```prisma
model Organization {
  id             String @id @default(cuid())
  tenantId       String
  organizationId String
  name           String
  slug           String
  description    String?
  settings       Json   @default("{}")
  
  @@unique([organizationId, slug])
}
```

### User
```prisma
model User {
  id             String    @id @default(cuid())
  tenantId       String
  organizationId String?
  email          String
  password       String
  name           String
  avatar         String?
  role           UserRole  @default(USER)  // PLATFORM_ADMIN, ADMIN, MANAGER, USER, VIEWER
  status         Status    @default(ACTIVE)
  
  @@unique([tenantId, email])
}
```

### Entity (Definição)
```prisma
model Entity {
  id          String  @id @default(cuid())
  tenantId    String
  organizationId String
  name        String  // "Cliente"
  namePlural  String  // "Clientes"
  slug        String  // "cliente"
  icon        String? // "users"
  color       String? // "#3B82F6"
  fields      Json    // Array de campos
  settings    Json    @default("{}")
  isSystem    Boolean @default(false)
  
  @@unique([organizationId, slug])
}
```

### EntityData (Dados)
```prisma
model EntityData {
  id          String   @id @default(cuid())
  tenantId    String
  entityId    String
  data        Json     // Dados dinâmicos
  createdById String?
  updatedById String?
}
```

## Estrutura de Fields (Entity)

```typescript
interface EntityField {
  slug: string;         // Identificador único
  name: string;         // Nome para exibição
  type: FieldType;      // Tipo do campo
  required: boolean;
  unique?: boolean;
  defaultValue?: any;
  options?: {           // Para select, radio, etc
    label: string;
    value: string;
  }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'image'
  | 'color'
  | 'currency'
  | 'relation';  // FK para outra entidade
```

## Índices Importantes

```prisma
// Tenant sempre indexado
@@index([tenantId])

// Busca por status
@@index([status])

// Ordenação por data
@@index([createdAt])

// Busca por criador
@@index([createdById])
```

## Comandos Prisma

```bash
# Gerar client
pnpm db:generate

# Criar migration
pnpm db:migrate

# Push direto (dev only)
pnpm db:push

# Seed
pnpm db:seed

# Studio (UI)
pnpm db:studio

# Reset (CUIDADO!)
pnpm --filter api prisma migrate reset
```

## Migrations em Produção

```bash
# No deploy, usar:
npx prisma migrate deploy

# NUNCA usar em produção:
# - prisma db push
# - prisma migrate dev
# - prisma migrate reset
```

## Backup

```bash
# Dump
pg_dump -U postgres crm_builder > backup.sql

# Restore
psql -U postgres crm_builder < backup.sql

# Via Docker
docker exec crm-postgres pg_dump -U postgres crm_builder > backup.sql
```
