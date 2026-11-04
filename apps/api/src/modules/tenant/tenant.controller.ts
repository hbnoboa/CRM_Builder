import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { TenantOverviewService } from './tenant-overview.service';
import { hasAdminArea } from '../../common/utils/platform-access';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { assertNotImpersonating } from '../../common/utils/permission-governance';
import { TransferOwnershipDto, UpdateMyTenantDto } from './dto/tenant.dto';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { AuditService } from '../audit/audit.service';

// Gestao de tenants (CRUD, suspender/ativar, estatisticas, copia de dados) vive so
// no console da plataforma (modules/platform). Aqui o usuario so ve o proprio tenant.
@ApiTags('Tenants')
@ServiceScope('admin')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly overviewService: TenantOverviewService,
    private readonly auditService: AuditService,
  ) {}

  // Endpoint para usuario autenticado obter seu proprio tenant
  @Get('me')
  @ApiOperation({ summary: 'Obter tenant do usuario atual' })
  async getMyTenant(@CurrentUser() user: CurrentUserType) {
    return this.tenantService.findOne(user.tenantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Editar nome, logo e tema da propria empresa (settings.canUpdate)' })
  async updateMyTenant(@Body() dto: UpdateMyTenantDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    const { before, after, tenant } = await this.tenantService.updateMine(user.tenantId, dto);
    this.auditService.log(user, {
      action: 'update',
      resource: 'tenant',
      resourceId: user.tenantId,
      oldData: before,
      newData: after,
    }).catch(() => {});
    return tenant;
  }

  @Get('me/overview')
  @ApiOperation({ summary: 'Painel da administracao da empresa (pendencias e atividade)' })
  async getOverview(@CurrentUser() user: CurrentUserType) {
    if (!hasAdminArea(user.customRole?.modulePermissions)) {
      throw new ForbiddenException('Sem acesso a administracao da empresa');
    }
    return this.overviewService.overview(user);
  }

  @Patch('me/owner')
  @ApiOperation({ summary: 'Transferir a propriedade da empresa (so o dono)' })
  async transferOwnership(@Body() dto: TransferOwnershipDto, @CurrentUser() user: CurrentUserType) {
    assertNotImpersonating(user, 'transferir a propriedade');
    return this.tenantService.transferOwnership(user.tenantId, user.id, dto.userId);
  }
}
