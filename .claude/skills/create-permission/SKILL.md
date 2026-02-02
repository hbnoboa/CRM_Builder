# 🔐 Skill: Criar Permissão

## Quando Usar
Quando precisar adicionar nova permissão ao sistema RBAC.

## Formato de Permissão

```
{recurso}:{ação}:{escopo}
```

## Passos

### 1. Definir a Permissão

```typescript
// Exemplo: permitir exportar relatórios
const permission = 'relatorio:export:all';
```

### 2. Usar no Backend (Controller)

```typescript
// src/modules/relatorio/relatorio.controller.ts
import { RequirePermission } from '@/common/decorators/permissions.decorator';

@Controller('relatorios')
export class RelatorioController {
  @Get('export')
  @RequirePermission('relatorio', 'export', 'all')
  async export(@CurrentUser() user: User) {
    return this.relatorioService.export(user.tenantId);
  }
}
```

### 3. Usar no Backend (Service com escopo)

```typescript
// src/modules/relatorio/relatorio.service.ts
@Injectable()
export class RelatorioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async export(user: User) {
    // Verificar escopo da permissão
    const scope = await this.permissionService.getEffectiveScope(
      user,
      'relatorio',
      'export'
    );

    const where: any = { tenantId: user.tenantId };

    // Aplicar filtro baseado no escopo
    switch (scope) {
      case 'own':
        where.createdById = user.id;
        break;
      case 'team':
        where.createdBy = { organizationId: user.organizationId };
        break;
      // 'all' não precisa de filtro adicional
    }

    return this.prisma.relatorio.findMany({ where });
  }
}
```

### 4. Usar no Frontend (Hook)

```typescript
// hooks/use-permission.ts
import { usePermission } from '@/hooks/use-permission';

function RelatorioPage() {
  const { can } = usePermission();

  return (
    <div>
      {can('relatorio', 'export') && (
        <Button onClick={handleExport}>Exportar</Button>
      )}
    </div>
  );
}
```

### 5. Usar no Frontend (Component Gate)

```typescript
// components/shared/permission-gate.tsx
import { PermissionGate } from '@/components/shared/permission-gate';

function RelatorioPage() {
  return (
    <div>
      <PermissionGate resource="relatorio" action="export">
        <Button onClick={handleExport}>Exportar</Button>
      </PermissionGate>
    </div>
  );
}
```

### 6. Adicionar às Roles Padrão

```typescript
// prisma/seed.ts

// Roles com a nova permissão
const roles = {
  admin: [
    // ... outras permissões
    'relatorio:manage:all',  // Admin pode tudo
  ],
  manager: [
    // ... outras permissões
    'relatorio:read:all',
    'relatorio:export:team', // Gerente exporta da equipe
  ],
  user: [
    // ... outras permissões
    'relatorio:read:team',
    'relatorio:export:own', // Usuário exporta os próprios
  ],
  viewer: [
    'relatorio:read:team', // Viewer só visualiza
  ],
};
```

### 7. Documentar

```markdown
<!-- .claude/docs/PERMISSIONS.md -->

## Relatórios

| Permissão | Descrição |
|-----------|-----------|
| `relatorio:read:all` | Ver todos os relatórios |
| `relatorio:read:team` | Ver relatórios da equipe |
| `relatorio:read:own` | Ver próprios relatórios |
| `relatorio:create:all` | Criar relatórios |
| `relatorio:export:all` | Exportar todos |
| `relatorio:export:team` | Exportar da equipe |
| `relatorio:export:own` | Exportar próprios |
```

## Permissões Comuns

```typescript
// CRUD básico
'recurso:create:all'
'recurso:read:all'
'recurso:read:team'
'recurso:read:own'
'recurso:update:all'
'recurso:update:team'
'recurso:update:own'
'recurso:delete:all'
'recurso:delete:team'
'recurso:delete:own'

// Extras
'recurso:export:all'
'recurso:import:all'
'recurso:manage:all'  // Todas as ações
```

## Checklist

- [ ] Permissão definida no formato correto
- [ ] @RequirePermission no controller
- [ ] Escopo aplicado no service (se necessário)
- [ ] Hook usePermission no frontend
- [ ] PermissionGate nos componentes
- [ ] Adicionada nas roles padrão (seed)
- [ ] Documentada em PERMISSIONS.md
