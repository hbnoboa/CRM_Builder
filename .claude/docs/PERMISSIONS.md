# 🔐 Sistema de Permissões

## Formato

```
{recurso}:{ação}:{escopo}
```

### Recursos
| Recurso | Descrição |
|---------|-----------|
| `*` | Todos os recursos (wildcard) |
| `user` | Gerenciamento de usuários |
| `role` | Gerenciamento de roles |
| `tenant` | Gerenciamento de tenants |
| `organization` | Gerenciamento de organizações |
| `organization` | Gerenciamento de organizations |
| `entity` | Definição de entidades |
| `page` | Pages do Puck Builder |
| `api` | Endpoints customizados |
| `{entity_slug}` | Dados de entidade específica |

### Ações
| Ação | Descrição |
|------|-----------|
| `manage` | Todas as ações (wildcard) |
| `create` | Criar registros |
| `read` | Visualizar registros |
| `update` | Editar registros |
| `delete` | Excluir registros |
| `export` | Exportar dados |
| `import` | Importar dados |

### Escopos
| Escopo | Descrição |
|--------|-----------|
| `all` | Todos os registros do tenant |
| `team` | Registros da mesma organização |
| `own` | Apenas registros próprios |
| `none` | Sem acesso |

## Exemplos

```typescript
// Ver todos os clientes
'cliente:read:all'

// Editar apenas seus clientes
'cliente:update:own'

// Ver clientes da equipe
'cliente:read:team'

// Admin de usuários
'user:manage:all'

// Super admin
'*:manage:all'
```

## Roles Padrão

### PLATFORM_ADMIN
```json
["*:manage:all"]
```

### ADMIN
```json
[
  "user:manage:all",
  "role:manage:all",
  "organization:manage:all",
  "organization:manage:all",
  "entity:manage:all",
  "page:manage:all",
  "api:manage:all",
  "*:manage:all"  // Todas as entidades
]
```

### MANAGER
```json
[
  "user:read:team",
  "user:update:team",
  "*:read:all",
  "*:create:all",
  "*:update:team",
  "*:delete:team",
  "*:export:team"
]
```

### USER
```json
[
  "*:read:team",
  "*:create:all",
  "*:update:own",
  "*:delete:own"
]
```

### VIEWER
```json
[
  "*:read:team"
]
```

## Implementação Backend

### Decorator
```typescript
// common/decorators/require-permission.decorator.ts
export const RequirePermission = (
  resource: string, 
  action: string, 
  scope?: string
) => SetMetadata(PERMISSION_KEY, { resource, action, scope });

// Uso no controller
@Get()
@RequirePermission('cliente', 'read', 'all')
findAll() { ... }
```

### Guard
```typescript
// common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<PermissionRequirement>(
      PERMISSION_KEY, 
      context.getHandler()
    );
    
    if (!required) return true;
    
    const user = request.user;
    const hasPermission = await this.permissionService.check(
      user,
      required.resource,
      required.action,
      required.scope
    );
    
    if (!hasPermission) {
      throw new ForbiddenException('Permissão negada');
    }
    
    return true;
  }
}
```

### Service
```typescript
// common/services/permission.service.ts
@Injectable()
export class PermissionService {
  async check(
    user: User,
    resource: string,
    action: string,
    requiredScope?: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(user.id);
    
    for (const perm of permissions) {
      const parsed = this.parse(perm);
      
      // Wildcard de recurso
      if (parsed.resource === '*' || parsed.resource === resource) {
        // Wildcard de ação
        if (parsed.action === 'manage' || parsed.action === action) {
          // Verifica escopo
          if (this.scopeMatches(parsed.scope, requiredScope)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private scopeMatches(userScope: string, required?: string): boolean {
    if (!required) return true;
    if (userScope === 'all') return true;
    if (userScope === 'team' && required !== 'all') return true;
    if (userScope === required) return true;
    return false;
  }
}
```

## Implementação Frontend

### Hook
```typescript
// hooks/use-permission.ts
export function usePermission() {
  const { user } = useAuthStore();
  
  const can = useCallback((
    resource: string,
    action: string,
    scope?: string
  ): boolean => {
    if (!user) return false;
    
    // PLATFORM_ADMIN pode tudo
    if (user.role === 'PLATFORM_ADMIN') return true;
    
    const permissions = user.permissions || [];
    
    for (const perm of permissions) {
      const [permResource, permAction, permScope] = perm.split(':');
      
      if (permResource === '*' || permResource === resource) {
        if (permAction === 'manage' || permAction === action) {
          if (!scope || permScope === 'all' || permScope === scope) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [user]);
  
  return { can };
}
```

### Componente Gate
```typescript
// components/permission-gate.tsx
interface PermissionGateProps {
  resource: string;
  action: string;
  scope?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ 
  resource, 
  action, 
  scope, 
  children, 
  fallback = null 
}: PermissionGateProps) {
  const { can } = usePermission();
  
  if (!can(resource, action, scope)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

// Uso
<PermissionGate resource="cliente" action="delete">
  <Button variant="destructive">Excluir</Button>
</PermissionGate>
```

## Filtragem por Escopo

```typescript
// No service de dados
async findAll(user: User, entitySlug: string) {
  const scope = await this.getEffectiveScope(user, entitySlug, 'read');
  
  const where: any = {
    entity: { slug: entitySlug },
    tenantId: user.tenantId,
  };
  
  switch (scope) {
    case 'own':
      where.createdById = user.id;
      break;
    case 'team':
      where.createdBy = { organizationId: user.organizationId };
      break;
    case 'all':
      // Sem filtro adicional
      break;
    default:
      throw new ForbiddenException();
  }
  
  return this.prisma.entityData.findMany({ where });
}
```
