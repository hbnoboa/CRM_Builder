import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { assertNotImpersonating } from '../../common/utils/permission-governance';
import { TransferOwnershipDto } from './dto/tenant.dto';

// Gestao de tenants (CRUD, suspender/ativar, estatisticas, copia de dados) vive so
// no console da plataforma (modules/platform). Aqui o usuario so ve o proprio tenant.
@ApiTags('Tenants')
@ServiceScope('admin')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // Endpoint para usuario autenticado obter seu proprio tenant
  @Get('me')
  @ApiOperation({ summary: 'Obter tenant do usuario atual' })
  async getMyTenant(@CurrentUser() user: CurrentUserType) {
    return this.tenantService.findOne(user.tenantId);
  }

  @Patch('me/owner')
  @ApiOperation({ summary: 'Transferir a propriedade da empresa (so o dono)' })
  async transferOwnership(@Body() dto: TransferOwnershipDto, @CurrentUser() user: CurrentUserType) {
    assertNotImpersonating(user, 'transferir a propriedade');
    return this.tenantService.transferOwnership(user.tenantId, user.id, dto.userId);
  }
}
