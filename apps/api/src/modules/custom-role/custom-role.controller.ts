import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CustomRoleService } from './custom-role.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto, QueryCustomRoleDto } from './dto/custom-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

const ADMIN_ROLES = ['PLATFORM_ADMIN', 'ADMIN'];

function assertAdminRole(user: CurrentUserType): void {
  const roleType = user.customRole?.roleType;
  if (!roleType || !ADMIN_ROLES.includes(roleType)) {
    throw new ForbiddenException('Acesso negado. Roles necessarias: ADMIN, PLATFORM_ADMIN');
  }
}

@ApiTags('Custom Roles')
@Controller('custom-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomRoleController {
  constructor(private readonly customRoleService: CustomRoleService) {}

  @Post()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
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
      this.customRoleService.getUserAccessibleEntities(user.id),
      this.customRoleService.getUserModulePermissions(user.id),
    ]);
    return { entities, modules };
  }

  @Get()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Listar roles customizadas' })
  async findAll(@Query() query: QueryCustomRoleDto, @CurrentUser() user: CurrentUserType) {
    assertAdminRole(user);
    return this.customRoleService.findAll(query, user);
  }

  @Get(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
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
  @Roles('ADMIN', 'PLATFORM_ADMIN')
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
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir role customizada' })
  async remove(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.customRoleService.remove(id, user, tenantId);
  }

  @Post(':roleId/assign/:userId')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atribuir role a um usuário' })
  async assignToUser(
    @Param('roleId') roleId: string,
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.customRoleService.assignToUser(roleId, userId, user, tenantId);
  }

  @Delete('user/:userId')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Remover role de um usuário' })
  async removeFromUser(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.customRoleService.removeFromUser(userId, user, tenantId);
  }
}
