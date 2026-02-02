# 🔌 Skill: Criar Endpoint

## Quando Usar
Quando precisar adicionar um novo endpoint na API NestJS.

## Passos

### 1. Criar DTO (se necessário)

```typescript
// src/modules/[module]/dto/create-[resource].dto.ts
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty({ 
    description: 'Nome do recurso',
    example: 'Meu Recurso' 
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ 
    description: 'Descrição opcional' 
  })
  @IsOptional()
  @IsString()
  description?: string;
}
```

### 2. Adicionar no Service

```typescript
// src/modules/[module]/[module].service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@Injectable()
export class ResourceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: {
        ...dto,
        tenantId,
        createdById: userId,
      },
    });
  }

  async findAll(tenantId: string, query: PaginationDto) {
    const { page = 1, limit = 20, search } = query;

    const where = {
      tenantId, // SEMPRE filtrar por tenant
      ...(search && {
        name: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resource.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, tenantId: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, tenantId },
    });

    if (!resource) {
      throw new NotFoundException('Recurso não encontrado');
    }

    return resource;
  }

  async update(id: string, tenantId: string, dto: UpdateResourceDto) {
    // Verificar existência e tenant
    await this.findOne(id, tenantId);

    return this.prisma.resource.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.resource.delete({
      where: { id },
    });
  }
}
```

### 3. Adicionar no Controller

```typescript
// src/modules/[module]/[module].controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermission } from '@/common/decorators/permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@ApiTags('Resources')
@ApiBearerAuth()
@Controller('resources')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  @ApiOperation({ summary: 'Criar recurso' })
  @ApiResponse({ status: 201, description: 'Recurso criado' })
  @RequirePermission('resource', 'create')
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resourceService.create(user.tenantId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar recursos' })
  @RequirePermission('resource', 'read', 'all')
  async findAll(
    @CurrentUser() user: User,
    @Query() query: PaginationDto,
  ) {
    return this.resourceService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar recurso por ID' })
  @RequirePermission('resource', 'read')
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.resourceService.findOne(id, user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar recurso' })
  @RequirePermission('resource', 'update')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourceService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover recurso' })
  @RequirePermission('resource', 'delete')
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.resourceService.remove(id, user.tenantId);
  }
}
```

### 4. Registrar no Module

```typescript
// src/modules/[module]/[module].module.ts
import { Module } from '@nestjs/common';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';

@Module({
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class ResourceModule {}
```

### 5. Adicionar no AppModule

```typescript
// src/app.module.ts
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

- [ ] DTO com validação class-validator
- [ ] Service com lógica de negócio
- [ ] Controller com decorators Swagger
- [ ] Guards: JwtAuthGuard + PermissionsGuard
- [ ] Decorators: @RequirePermission, @CurrentUser
- [ ] Filtro por tenantId em todas as queries
- [ ] Tratamento de erros (NotFoundException, etc)
- [ ] Module registrado no AppModule
