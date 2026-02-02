import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Criar role' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.roleService.create(dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Listar roles' })
  async findAll(@CurrentUser() user: any) {
    return this.roleService.findAll(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Buscar role' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roleService.findOne(id, user);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Atualizar role' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.roleService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Excluir role' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roleService.remove(id, user);
  }

  @Post('assign')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Atribuir role a usuário' })
  async assign(@Body() dto: { userId: string; roleId: string }, @CurrentUser() user: any) {
    return this.roleService.assignToUser(dto.userId, dto.roleId, user);
  }

  @Delete('user/:userId/role/:roleId')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Remover role de usuário' })
  async unassign(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: any,
  ) {
    return this.roleService.removeFromUser(userId, roleId, user);
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Listar roles de usuário' })
  async getUserRoles(@Param('userId') userId: string, @CurrentUser() user: any) {
    return this.roleService.getUserRoles(userId, user);
  }
}
