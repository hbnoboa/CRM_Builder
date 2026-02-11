import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CustomRoleService } from './custom-role.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto, QueryCustomRoleDto } from './dto/custom-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
  async create(@Body() dto: CreateCustomRoleDto, @CurrentUser() user: any) {
    return this.customRoleService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar roles customizadas' })
  async findAll(@Query() query: QueryCustomRoleDto, @CurrentUser() user: any) {
    return this.customRoleService.findAll(query, user);
  }

  @Get('my-permissions')
  @ApiOperation({ summary: 'Obter permissões do usuário logado' })
  async getMyPermissions(@CurrentUser() user: any) {
    const [entities, modules] = await Promise.all([
      this.customRoleService.getUserAccessibleEntities(user.id),
      this.customRoleService.getUserModulePermissions(user.id),
    ]);
    return { entities, modules };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar role por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customRoleService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atualizar role customizada' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomRoleDto, @CurrentUser() user: any) {
    return this.customRoleService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir role customizada' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customRoleService.remove(id, user);
  }

  @Post(':roleId/assign/:userId')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atribuir role a um usuário' })
  async assignToUser(
    @Param('roleId') roleId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.customRoleService.assignToUser(roleId, userId, user);
  }

  @Delete('user/:userId')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Remover role de um usuário' })
  async removeFromUser(@Param('userId') userId: string, @CurrentUser() user: any) {
    return this.customRoleService.removeFromUser(userId, user);
  }
}
