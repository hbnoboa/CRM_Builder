import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CustomRoleService } from './custom-role.service';
import { PermissionCacheService } from './permission-cache.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto, QueryCustomRoleDto } from './dto/custom-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { hasPlatformAccess, hasFullTenantAccess } from '../../common/utils/platform-access';

function assertAdminRole(user: CurrentUserType): void {
  // Gerir cargos = permissão (platform, acesso total ao tenant, OU roles.canUpdate).
  if (
    hasPlatformAccess(user.customRole?.modulePermissions) ||
    hasFullTenantAccess(user.customRole?.modulePermissions)
  ) {
    return;
  }
  const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
  if (mp?.roles?.canUpdate !== true) {
    throw new ForbiddenException('Acesso negado. Requer permissão de gerir cargos ou acesso de plataforma.');
  }
}

@ApiTags('Custom Roles')
@ServiceScope('admin')
@Controller('custom-roles')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class CustomRoleController {
  constructor(
    private readonly customRoleService: CustomRoleService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  @Post()
  @RequireModulePermission('roles', 'canCreate')
  @ApiOperation({ summary: 'Criar role customizada' })
  @ApiResponse({ status: 201, description: 'Role criada com sucesso' })
  async create(@Body() dto: CreateCustomRoleDto, @CurrentUser() user: CurrentUserType) {
    const tenantId = dto.tenantId;
    return this.customRoleService.create(dto, user, tenantId);
  }

  @Get('my-permissions')
  @ApiOperation({ summary: 'Obter permissões do usuário logado' })
  async getMyPermissions(@CurrentUser() user: CurrentUserType) {
    const [entities, modules] = await Promise.all([
      this.customRoleService.getAccessibleEntitySlugs(user.id),
      this.customRoleService.getUserModulePermissions(user.id),
    ]);
    return { entities, modules };
  }

  @Get()
  @RequireModulePermission('roles', 'canRead')
  @ApiOperation({ summary: 'Listar roles customizadas' })
  async findAll(@Query() query: QueryCustomRoleDto, @CurrentUser() user: CurrentUserType) {
    assertAdminRole(user);
    return this.customRoleService.findAll(query, user);
  }

  @Get(':id')
  @RequireModulePermission('roles', 'canRead')
  @ApiOperation({ summary: 'Buscar role por ID' })
  async findOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    assertAdminRole(user);
    return this.customRoleService.findOne(id, user, tenantId);
  }

  @Patch(':id')
  @RequireModulePermission('roles', 'canUpdate')
  @ApiOperation({ summary: 'Atualizar role customizada' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomRoleDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const tenantId = dto.tenantId;
    return this.customRoleService.update(id, dto, user, tenantId);
  }

  @Delete(':id')
  @RequireModulePermission('roles', 'canDelete')
  @ApiOperation({ summary: 'Excluir role customizada' })
  async remove(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.customRoleService.remove(id, user, tenantId);
  }

  @Post(':roleId/assign/:userId')
  @RequireModulePermission('roles', 'canUpdate')
  @ApiOperation({ summary: 'Atribuir role a um usuário (acesso temporário via expiresAt opcional)' })
  async assignToUser(
    @Param('roleId') roleId: string,
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Body() body?: { expiresAt?: string | null },
  ) {
    return this.customRoleService.assignToUser(roleId, userId, user, tenantId, body?.expiresAt);
  }

  @Delete('user/:userId')
  @RequireModulePermission('roles', 'canDelete')
  @ApiOperation({ summary: 'Remover role de um usuário' })
  async removeFromUser(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.customRoleService.removeFromUser(userId, user, tenantId);
  }

  @Get('cache/stats')
  @RequireModulePermission('roles', 'canRead')
  @ApiOperation({ summary: 'Obter estatísticas do cache de permissions' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas do cache',
    schema: {
      type: 'object',
      properties: {
        totalKeys: { type: 'number', example: 127 },
        permissionKeys: { type: 'number', example: 127 },
        averageTTL: { type: 'number', example: 245, description: 'TTL médio em segundos' },
      },
    },
  })
  async getCacheStats(@CurrentUser() user: CurrentUserType) {
    assertAdminRole(user);
    return this.permissionCache.getStats();
  }

  @Post('cache/invalidate/:userId')
  @RequireModulePermission('roles', 'canUpdate')
  @ApiOperation({ summary: 'Invalidar cache de permissions de um usuário' })
  async invalidateUserCache(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    assertAdminRole(user);
    await this.permissionCache.invalidateUserPermissions(userId, user.tenantId);
    return {
      success: true,
      message: `Cache de permissions do usuário ${userId} invalidado`,
    };
  }

  @Post('cache/invalidate-tenant')
  @RequireModulePermission('roles', 'canUpdate')
  @ApiOperation({ summary: 'Invalidar TODOS os caches de permissions do tenant' })
  async invalidateTenantCache(@CurrentUser() user: CurrentUserType) {
    assertAdminRole(user);
    await this.permissionCache.invalidateTenantPermissions(user.tenantId);
    return {
      success: true,
      message: `Caches de permissions do tenant invalidados`,
    };
  }
}
