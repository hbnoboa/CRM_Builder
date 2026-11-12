import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { PlatformAuthGuard } from '../platform/platform-jwt.strategy';
import { CurrentStaff, PlatformPermissionGuard, PlatformStaffPrincipal, RequirePlatformPermission } from '../platform/platform-permissions';
import { SiteDomainsService } from './site-domains.service';

class ConnectDomainDto {
  @IsString() @MaxLength(300) hostname: string;
}
class UpdateDomainDto {
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
class SearchDomainDto {
  @IsString() @MaxLength(100) q: string;
}
class CreateOrderDto {
  @IsString() @MaxLength(253) hostname: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3) years?: number;
  /** Titular: name, document (CPF/CNPJ), email, phone. */
  @IsObject() registrant: Record<string, string>;
}
class StaffOrderDto {
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class ListOrdersDto {
  @IsOptional() @IsIn(['awaiting_payment', 'registering', 'registered', 'failed', 'cancelled']) status?: string;
}

/** Dominios do site da empresa: mesma permissao das paginas para clientes. */
@ApiTags('Site Domains')
@ServiceScope('admin')
@RequireFeature('publicLinks')
@Controller('site-domains')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModulePermission('publicLinks', 'canManage')
@ApiBearerAuth()
export class SiteDomainsController {
  constructor(private readonly service: SiteDomainsService) {}

  @Get()
  @ApiOperation({ summary: 'Dominios ligados, pedidos de compra e instrucoes de DNS' })
  overview(@CurrentUser() user: CurrentUserType) {
    return this.service.overview(user);
  }

  @Get('search')
  @ApiOperation({ summary: 'Busca dominios livres para comprar' })
  search(@Query() q: SearchDomainDto, @CurrentUser() user: CurrentUserType) {
    return this.service.search(user, q.q);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Pede um dominio (fica aguardando pagamento)' })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: CurrentUserType) {
    return this.service.createOrder(user, dto);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.cancelOrder(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Liga um dominio que a empresa ja tem' })
  connect(@Body() dto: ConnectDomainDto, @CurrentUser() user: CurrentUserType) {
    return this.service.connect(user, dto.hostname);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confere o DNS de novo' })
  verify(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.verify(user, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDomainDto, @CurrentUser() user: CurrentUserType) {
    if (dto.isPrimary) return this.service.setPrimary(user, id);
    return this.service.overview(user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.remove(user, id);
  }
}

/**
 * Publico, usado pelo servidor do site: qual empresa responde num dominio e se um
 * dominio pode receber certificado (pergunta do proxy antes de emitir).
 */
@ApiTags('Site Domains - Public')
@Controller('public/domains')
@UseGuards(AuthThrottlerGuard)
export class SiteDomainsPublicController {
  constructor(private readonly service: SiteDomainsService) {}

  @Get('resolve')
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  async resolve(@Query('host') host: string) {
    const r = await this.service.resolve(String(host || '').slice(0, 300));
    if (!r) throw new NotFoundException('Domínio não configurado');
    return r;
  }

  @Get('tls')
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  async tls(@Query('domain') domain: string) {
    if (!(await this.service.tlsAllowed(String(domain || '').slice(0, 300)))) throw new NotFoundException();
    return { ok: true };
  }
}

/** Console: pedidos de dominio (cobranca por fora; aqui a equipe marca como pago). */
@ApiTags('Platform')
@ServiceScope('admin')
@Controller('platform/domain-orders')
@UseGuards(PlatformAuthGuard, PlatformPermissionGuard)
@ApiBearerAuth()
export class DomainOrdersConsoleController {
  constructor(private readonly service: SiteDomainsService) {}

  @Get()
  @RequirePlatformPermission('domains.read')
  list(@Query() q: ListOrdersDto) {
    return this.service.listOrders(q.status);
  }

  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('domains.manage')
  markPaid(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: StaffOrderDto) {
    return this.service.markPaid(staff, id, dto.notes);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('domains.manage')
  cancel(@CurrentStaff() staff: PlatformStaffPrincipal, @Param('id') id: string, @Body() dto: StaffOrderDto) {
    return this.service.cancelByStaff(staff, id, dto.notes);
  }
}
