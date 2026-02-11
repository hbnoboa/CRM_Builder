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
import { CreateTenantDto, UpdateTenantDto, QueryTenantDto } from './dto/tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';

function assertTenantAccess(user: CurrentUserType): void {
  const roleType = user.customRole?.roleType;
  if (roleType === 'PLATFORM_ADMIN') return;

  const mp = user.customRole?.modulePermissions as Record<string, boolean> | undefined;
  if (mp?.tenants === true) return;

  throw new ForbiddenException('Acesso negado. Permissao de tenants necessaria.');
}

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

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
    assertTenantAccess(user);
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
    assertTenantAccess(user);
    return this.tenantService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Suspender tenant' })
  async suspend(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Ativar tenant' })
  async activate(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantService.activate(id);
  }

  @Delete(':id')
  @Roles('PLATFORM_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Excluir tenant' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    assertTenantAccess(user);
    return this.tenantService.remove(id);
  }
}
