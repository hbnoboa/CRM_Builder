# Regras de Multi-Tenancy

## Principio Fundamental

> **NUNCA** um tenant pode ver ou modificar dados de outro tenant.

## Hierarquia

```
Tenant (Empresa/Cliente)
├── CustomRole[] (Papeis com permissoes granulares)
├── Users[]
│   └── UserTenantAccess[] (acesso multi-tenant)
├── Entities[]
│   ├── EntityData[] (registros ativos)
│   │   └── EntityData[] (sub-registros via parentRecordId)
│   └── ArchivedEntityData[] (registros arquivados)
├── DashboardTemplates[]
├── PdfTemplates[]
├── Webhooks[]
└── ActionChains[]
```

## Regra #1: Usar EntityDataQueryService para EntityData

**OBRIGATORIO:** Todo modulo que busca `EntityData` DEVE usar o `EntityDataQueryService`.
Nunca construir WHERE manualmente para EntityData.

```typescript
// ✅ CORRETO — usa pipeline centralizado
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';

@Injectable()
export class MeuService {
  constructor(private readonly queryService: EntityDataQueryService) {}

  async buscarDados(entitySlug: string, user: CurrentUser, tenantId?: string) {
    const { where, entity, effectiveTenantId } = await this.queryService.buildWhere({
      entitySlug,
      user,
      tenantId,
    });
    // where ja tem: entityId, tenantId, scope, globalFilters, roleDataFilters
    return this.prisma.entityData.findMany({ where });
  }
}

// ❌ ERRADO — construcao manual (faltam scope, globalFilters, roleDataFilters)
async buscarDados(entitySlug: string, user: CurrentUser) {
  const entity = await this.entityService.findBySlug(entitySlug, user);
  return this.prisma.entityData.findMany({
    where: { entityId: entity.id, tenantId: user.tenantId },
  });
}
```

**O pipeline aplica automaticamente:**
1. Tenant isolation (PLATFORM_ADMIN bypass)
2. Scope (own/all) via `getEntityScope()`
3. Global filters (`entity.settings.globalFilters`)
4. Role data filters (`customRole.permissions[].dataFilters`)
5. User filters, dashboard filters, search

**Module import:**
```typescript
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';

@Module({
  imports: [EntityDataQueryModule],
})
```

## Regra #2: Toda Query DEVE ter tenantId

Para modelos que NAO sao EntityData (User, Entity, Webhook, etc.):

```typescript
// ✅ CORRETO
const users = await this.prisma.user.findMany({
  where: { tenantId: user.tenantId, status: 'ACTIVE' },
});

// ❌ ERRADO
const users = await this.prisma.user.findMany({
  where: { status: 'ACTIVE' },
});
```

## Regra #3: Usar getEffectiveTenantId para PLATFORM_ADMIN

```typescript
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

// PLATFORM_ADMIN pode acessar qualquer tenant via queryTenantId
// Outros roles sempre usam seu proprio tenantId
const effectiveTenantId = getEffectiveTenantId(currentUser, queryTenantId);
```

## Regra #4: Validar Ownership em Updates/Deletes

```typescript
async update(id: string, user: CurrentUser, dto: UpdateDto) {
  const record = await this.prisma.record.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!record) throw new NotFoundException();
  return this.prisma.record.update({ where: { id }, data: dto });
}
```

## Regra #5: Nunca Confiar em IDs do Request

```typescript
const entity = await this.prisma.entity.findFirst({
  where: { id: entityId, tenantId: user.tenantId },
});
if (!entity) throw new NotFoundException();
```

## Checklist para Novos Modulos

- [ ] Queries filtram por `tenantId`?
- [ ] EntityData usa `EntityDataQueryService.buildWhere()`?
- [ ] Update/Delete valida ownership (findFirst + tenantId)?
- [ ] PLATFORM_ADMIN usa `getEffectiveTenantId()`?
- [ ] IDs de params sao validados contra tenant?
- [ ] Module importa `EntityDataQueryModule` se acessa EntityData?
