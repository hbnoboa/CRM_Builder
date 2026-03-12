# Skill: Criar Endpoint

## Quando Usar
Quando precisar adicionar um novo endpoint na API NestJS.

## Passos

### 1. Criar DTO (se necessario)

```typescript
// src/modules/[module]/dto/create-[resource].dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### 2. Adicionar no Service

**Se o servico busca EntityData, DEVE usar EntityDataQueryService:**

```typescript
// src/modules/[module]/[module].service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';
import { CurrentUser } from '../../common/types';

@Injectable()
export class MeuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: EntityDataQueryService,
  ) {}

  // ✅ Buscar EntityData — SEMPRE via queryService
  async findEntityData(entitySlug: string, user: CurrentUser, tenantId?: string) {
    const { where, entity } = await this.queryService.buildWhere({
      entitySlug,
      user,
      tenantId,
    });
    // where ja inclui: entityId, tenantId, scope, globalFilters, roleDataFilters

    return this.prisma.entityData.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Para ArchivedEntityData, usar buildArchivedWhere:
  async findWithArchived(entitySlug: string, user: CurrentUser) {
    const { where } = await this.queryService.buildWhere({ entitySlug, user });
    const archivedWhere = this.queryService.buildArchivedWhere(where);

    const [active, archived] = await Promise.all([
      this.prisma.entityData.findMany({ where }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere }),
    ]);
    return [...active, ...archived];
  }
}
```

**Se o servico NAO acessa EntityData (ex: CRUD de recursos do sistema):**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class ResourceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUser, queryTenantId?: string) {
    const tenantId = getEffectiveTenantId(user, queryTenantId);
    return this.prisma.resource.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: CurrentUser) {
    const record = await this.prisma.resource.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!record) throw new NotFoundException();
    return record;
  }

  async create(user: CurrentUser, dto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: { ...dto, tenantId: user.tenantId },
    });
  }

  async update(id: string, user: CurrentUser, dto: UpdateResourceDto) {
    await this.findOne(id, user); // valida tenant
    return this.prisma.resource.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: CurrentUser) {
    await this.findOne(id, user); // valida tenant
    return this.prisma.resource.delete({ where: { id } });
  }
}
```

### 3. Adicionar no Controller

```typescript
// src/modules/[module]/[module].controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { checkModulePermission } from '../../common/utils/check-module-permission';

@Controller('resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUser, @Query('tenantId') tenantId?: string) {
    checkModulePermission(user, 'settings', 'canRead');
    return this.service.findAll(user, tenantId);
  }

  @Post()
  async create(@CurrentUser() user: CurrentUser, @Body() dto: CreateResourceDto) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.create(user, dto);
  }

  @Patch(':id')
  async update(@CurrentUser() user: CurrentUser, @Param('id') id: string, @Body() dto: UpdateResourceDto) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    checkModulePermission(user, 'settings', 'canDelete');
    return this.service.remove(id, user);
  }
}
```

### 4. Registrar no Module

```typescript
// src/modules/[module]/[module].module.ts
import { Module } from '@nestjs/common';
import { EntityDataQueryModule } from '../../common/services/entity-data-query.module';

@Module({
  imports: [EntityDataQueryModule], // apenas se acessa EntityData
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class ResourceModule {}
```

### 5. Adicionar no AppModule

```typescript
import { ResourceModule } from './modules/resource/resource.module';

@Module({
  imports: [
    // ...
    ResourceModule,
  ],
})
export class AppModule {}
```

### Checklist

- [ ] DTO com validacao class-validator
- [ ] Service com logica de negocio
- [ ] EntityData → usa `EntityDataQueryService.buildWhere()`
- [ ] Outros modelos → filtra por `tenantId` + usa `getEffectiveTenantId()`
- [ ] Controller com `@UseGuards(JwtAuthGuard, RolesGuard)`
- [ ] Permissoes via `checkModulePermission()` ou `checkEntityAction()`
- [ ] `@CurrentUser()` para obter usuario autenticado
- [ ] Tratamento de erros (NotFoundException, ForbiddenException)
- [ ] Module registrado no AppModule
- [ ] Module importa `EntityDataQueryModule` se acessa EntityData
