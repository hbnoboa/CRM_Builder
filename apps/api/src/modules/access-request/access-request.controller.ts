import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { clientIp } from '../../common/utils/client-ip';
import { requestHost } from '../../common/utils/custom-domain';
import { AccessRequestService } from './access-request.service';

class CreateAccessRequestDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsEmail({}, { message: 'E-mail inválido' }) @MaxLength(150) email: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
  /** Armadilha para robos: campo invisivel que pessoas deixam vazio. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}
class ApproveDto {
  @IsString() @MaxLength(60) customRoleId: string;
}

/** Publico: "Pedir acesso" na tela de login do dominio proprio da empresa. */
@ApiTags('Access Requests')
@Controller('public/access-requests')
@UseGuards(AuthThrottlerGuard)
export class AccessRequestPublicController {
  constructor(private readonly service: AccessRequestService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Pede acesso a empresa dona do endereco (aprovacao do administrador)' })
  create(@Body() dto: CreateAccessRequestDto, @Req() req: Request) {
    if (dto.website) return { ok: true, message: 'Pedido enviado!' };
    return this.service.request(requestHost(req), dto, clientIp(req)?.replace(/^::ffff:/i, ''));
  }
}

/** Administracao: pedidos de acesso pendentes (quem pode cadastrar pessoas). */
@ApiTags('Access Requests')
@Controller('access-requests')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class AccessRequestController {
  constructor(private readonly service: AccessRequestService) {}

  @Get()
  @RequireModulePermission('users', 'canRead')
  list(@CurrentUser() user: CurrentUserType) {
    return this.service.list(user);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireModulePermission('users', 'canCreate')
  approve(@Param('id') id: string, @Body() dto: ApproveDto, @CurrentUser() user: CurrentUserType) {
    return this.service.approve(user, id, dto.customRoleId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireModulePermission('users', 'canCreate')
  reject(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.reject(user, id);
  }
}
