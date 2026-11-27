import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { DeliveryService } from './delivery.service';
import { IfoodService } from './ifood.service';

class DeliverySetupDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true })
  stores?: string[];

  @IsOptional() @IsBoolean()
  history?: boolean;
}

class DeliverySimulateDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  count?: number;
}

class DeliveryDemoDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(240)
  minutes?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30)
  every?: number;
}

class IfoodAuthorizationDto {
  @IsString() @MinLength(4) @MaxLength(300)
  authorizationCode!: string;
}

class IfoodLinkDto {
  @IsString() @MaxLength(40)
  storeId!: string;

  @IsUUID()
  merchantId!: string;
}

/** Apps conectados de delivery: central de pedidos, demonstracao e conector do iFood. */
@ApiTags('Delivery')
@Controller('delivery')
@ServiceScope('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeliveryController {
  constructor(private readonly service: DeliveryService, private readonly ifood: IfoodService) {}

  @Get()
  @ApiOperation({ summary: 'Central de pedidos: montada?, lojas, conectores e modo demonstracao' })
  status(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.status(user);
  }

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Monta tabelas, painel, cargos e automacao da central de pedidos' })
  setup(@Body() dto: DeliverySetupDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.setup(user, dto.stores, dto.history !== false);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Pedido(s) de demonstracao chegando agora' })
  simulate(@Body() dto: DeliverySimulateDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.simulate(user, dto.count ?? 1);
  }

  @Post('demo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liga o modo demonstracao: um pedido a cada N minutos' })
  startDemo(@Body() dto: DeliveryDemoDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.startDemo(user, dto.minutes ?? 60, dto.every ?? 2);
  }

  @Delete('demo')
  @ApiOperation({ summary: 'Desliga o modo demonstracao' })
  stopDemo(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.service.stopDemo(user);
  }

  @Get('ifood')
  @ApiOperation({ summary: 'iFood: conector ligado? e quais lojas estao ligadas' })
  ifoodStatus(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.status(user);
  }

  @Post('ifood/authorize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'iFood: gera o codigo que o dono confirma no Portal do Parceiro' })
  ifoodAuthorize(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.authorize(user);
  }

  @Post('ifood/authorize/finish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'iFood: conclui a autorizacao com o codigo que o portal mostrou' })
  ifoodFinish(@Body() dto: IfoodAuthorizationDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.finishAuthorization(user, dto.authorizationCode);
  }

  @Post('ifood/link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Liga uma loja da central a uma loja do iFood (codigo da loja no iFood)' })
  ifoodLink(@Body() dto: IfoodLinkDto, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.link(user, dto.storeId, dto.merchantId);
  }

  @Post('ifood/menu')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @ApiOperation({ summary: 'iFood: importa agora o cardapio das lojas ligadas (o sistema tambem importa de hora em hora)' })
  ifoodMenu(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.syncMenu(user);
  }

  @Delete('ifood')
  @ApiOperation({ summary: 'Desconecta o iFood da empresa (desliga todas as lojas)' })
  ifoodDisconnect(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.disconnect(user);
  }

  @Delete('ifood/link/:storeId')
  @ApiOperation({ summary: 'Desliga uma loja do iFood' })
  ifoodUnlink(@Param('storeId') storeId: string, @CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.ifood.unlink(user, storeId);
  }
}
