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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { TenantCopyService } from './tenant-copy.service';
import { CreateTenantDto, UpdateTenantDto, QueryTenantDto } from './dto/tenant.dto';
import { CopyTenantDataDto } from './dto/copy-tenant-data.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';

function assertTenantAccess(user: CurrentUserType, action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete' = 'canRead'): void {
  const roleType = user.customRole?.roleType;
  if (roleType === 'PLATFORM_ADMIN') return;

  const mp = user.customRole?.modulePermissions as Record<string, unknown> | undefined;
  const tenantPerm = mp?.tenants;

  // Backward compat: boolean true = acesso total
  if (tenantPerm === true) return;

  // CRUD format
  if (tenantPerm && typeof tenantPerm === 'object' && (tenantPerm as Record<string, boolean>)[action] === true) return;

  throw new ForbiddenException('Acesso negado. Permissao de tenants necessaria.');
}

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantCopyService: TenantCopyService,
  ) {}

  // Endpoint para usuario autenticado obter seu proprio tenant
  @Get('me')
  @ApiOperation({ summary: 'Obter tenant do usuario atual' })
  async getMyTenant(@CurrentUser() user: CurrentUserType) {
    return this.tenantService.findOne(user.tenantId);
  }

  @Post()
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Criar novo tenant' })
  @ApiResponse({ status: 201, description: 'Tenant criado' })
  async create(@Body() dto: CreateTenantDto, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user, 'canCreate');
    return this.tenantService.create(dto);
  }

  @Get()
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Listar tenants' })
  async findAll(@Query() query: QueryTenantDto, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantService.findAll(query);
  }

  @Get('stats')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Estatísticas de tenants' })
  async getStats(@CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantService.getStats();
  }

  @Post('copy-data')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Copiar dados entre tenants (PLATFORM_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Dados copiados com sucesso' })
  async copyData(@Body() dto: CopyTenantDataDto, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user, 'canCreate');
    return this.tenantCopyService.executeCopy(dto);
  }

  @Get(':id/copyable-data')
  @Roles('PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Listar dados copiaveis de um tenant (PLATFORM_ADMIN)' })
  async getCopyableData(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantCopyService.getCopyableData(id);
  }

  @Get(':id')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Buscar tenant por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Atualizar tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user, 'canUpdate');
    return this.tenantService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Suspender tenant' })
  async suspend(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user, 'canUpdate');
    checkModulePermission(user, 'tenants', 'canSuspend');
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Ativar tenant' })
  async activate(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user, 'canUpdate');
    checkModulePermission(user, 'tenants', 'canActivate');
    return this.tenantService.activate(id);
  }

  @Delete(':id')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Excluir tenant' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user, 'canDelete');
    return this.tenantService.remove(id);
  }
}
