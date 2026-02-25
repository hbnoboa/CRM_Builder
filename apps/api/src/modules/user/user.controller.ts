import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obter perfil do usuário atual' })
  async getMe(@CurrentUser() user: CurrentUserType) {
    return this.userService.findOne(user.id, user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar perfil do usuário atual' })
  async updateMe(@Body() dto: UpdateUserDto, @CurrentUser() user: CurrentUserType) {
    // Impedir auto-escalacao de privilegio
    delete dto.customRoleId;
    delete dto.status;
    return this.userService.update(user.id, dto, user);
  }

  @Post()
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Criar usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: CurrentUserType) {
    return this.userService.create(dto, user);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Listar usuários' })
  async findAll(@Query() query: QueryUserDto, @CurrentUser() user: CurrentUserType) {
    return this.userService.findAll(query, user);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.userService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Atualizar usuário' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    if (dto.customRoleId) {
      checkModulePermission(user, 'users', 'canAssignRole');
    }
    if (dto.status) {
      checkModulePermission(user, 'users', 'canChangeStatus');
    }
    return this.userService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Excluir usuário' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.userService.remove(id, user);
  }

  // ═══════════════════════════════════════════════════════════════
  // TENANT ACCESS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  @Get(':userId/tenant-access')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Listar acessos a tenants de um usuario' })
  async listUserTenantAccess(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.userService.listUserTenantAccess(user, userId);
  }

  @Post(':userId/tenant-access')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Conceder acesso a outro tenant' })
  async grantTenantAccess(
    @Param('userId') userId: string,
    @Body() dto: { tenantId: string; customRoleId: string; expiresAt?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.userService.grantTenantAccess(user, { userId, ...dto });
  }

  @Delete('tenant-access/:accessId')
  @Roles('ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Revogar acesso a tenant' })
  async revokeTenantAccess(
    @Param('accessId') accessId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.userService.revokeTenantAccess(user, accessId);
  }
}
