# 🏢 Regras de Multi-Tenancy

## Princípio Fundamental

> **NUNCA** um tenant pode ver ou modificar dados de outro tenant.

## Hierarquia

```
Tenant (Empresa/Cliente)
├── Organizations (Filiais/Departamentos)
│   └── Workspaces (Projetos/CRMs)
│       ├── Entities
│       ├── EntityData
│       ├── Pages
│       └── CustomEndpoints
└── Users
    └── Roles
```

## Regras de Isolamento

### 1. Toda Query DEVE ter tenantId

```typescript
// ✅ CORRETO
const users = await this.prisma.user.findMany({
  where: {
    tenantId: user.tenantId, // OBRIGATÓRIO
    status: 'ACTIVE',
  },
});

// ❌ ERRADO - NUNCA FAZER
const users = await this.prisma.user.findMany({
  where: {
    status: 'ACTIVE',
  },
});
```

### 2. Validar Ownership em Updates/Deletes

```typescript
// ✅ CORRETO
async update(id: string, user: User, dto: UpdateDto) {
  // Primeiro, verificar se pertence ao tenant
  const record = await this.prisma.record.findFirst({
    where: {
      id,
      tenantId: user.tenantId, // Valida tenant
    },
  });

  if (!record) {
    throw new NotFoundException('Registro não encontrado');
  }

  return this.prisma.record.update({
    where: { id },
    data: dto,
  });
}

// ❌ ERRADO - Permite acesso cross-tenant
async update(id: string, dto: UpdateDto) {
  return this.prisma.record.update({
    where: { id }, // ID pode ser de outro tenant!
    data: dto,
  });
}
```

### 3. Workspace pertence a Organization que pertence a Tenant

```typescript
// Ao criar entidade, validar cadeia completa
async createEntity(user: User, dto: CreateEntityDto) {
  // Verificar se workspace pertence ao tenant do usuário
  const workspace = await this.prisma.workspace.findFirst({
    where: {
      id: dto.workspaceId,
      tenantId: user.tenantId, // CRÍTICO!
    },
  });

  if (!workspace) {
    throw new ForbiddenException('Workspace não encontrado');
  }

  return this.prisma.entity.create({
    data: {
      ...dto,
      tenantId: user.tenantId, // Propagar tenantId
    },
  });
}
```

### 4. Nunca Confiar em IDs do Request

```typescript
// ✅ CORRETO - Sempre validar
@Get(':workspaceId/entities')
async getEntities(
  @Param('workspaceId') workspaceId: string,
  @CurrentUser() user: User,
) {
  // Validar que workspace pertence ao tenant
  const workspace = await this.workspaceService.findOne(
    workspaceId,
    user.tenantId
  );

  if (!workspace) {
    throw new NotFoundException();
  }

  return this.entityService.findByWorkspace(workspaceId, user.tenantId);
}
```

### 5. Relações: Sempre Verificar Tenant

```typescript
// Ao criar relação entre entidades
async createRelation(user: User, dto: CreateRelationDto) {
  // Ambas entidades devem ser do mesmo tenant
  const [source, target] = await Promise.all([
    this.prisma.entity.findFirst({
      where: { id: dto.sourceId, tenantId: user.tenantId },
    }),
    this.prisma.entity.findFirst({
      where: { id: dto.targetId, tenantId: user.tenantId },
    }),
  ]);

  if (!source || !target) {
    throw new ForbiddenException('Entidades não encontradas');
  }

  // Agora pode criar relação
}
```

## Guards de Tenant

```typescript
// common/guards/tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // PLATFORM_ADMIN pode acessar qualquer tenant
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    // Verificar se há tenantId no params/body
    const tenantId = 
      request.params.tenantId || 
      request.body.tenantId;

    if (tenantId && tenantId !== user.tenantId) {
      throw new ForbiddenException('Acesso negado a este tenant');
    }

    return true;
  }
}
```

## Índices no Banco

```prisma
// Sempre indexar tenantId
model Entity {
  // ...
  @@index([tenantId])
  @@index([tenantId, workspaceId])
}

model EntityData {
  // ...
  @@index([tenantId])
  @@index([tenantId, entityId])
}
```

## Logs e Auditoria

```typescript
// Sempre incluir tenantId nos logs
this.logger.log({
  action: 'user.created',
  tenantId: user.tenantId,
  userId: user.id,
  targetId: newUser.id,
});
```

## Checklist para Novos Endpoints

- [ ] Query filtra por `tenantId`?
- [ ] Update/Delete valida ownership?
- [ ] IDs de params são validados contra tenant?
- [ ] Relações verificam mesmo tenant?
- [ ] Logs incluem `tenantId`?
- [ ] Testes cobrem isolamento?
