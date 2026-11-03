import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ServiceScope } from '../../common/service-scope/service-scope.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from '../../common/guards/module-permission.guard';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { RequireModulePermission } from '../../common/decorators/module-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationService } from './invitation.service';

@ApiTags('Invitations')
@ServiceScope('admin')
@Controller('invitations')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@ApiBearerAuth()
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Get()
  @RequireModulePermission('users', 'canRead')
  @ApiOperation({ summary: 'Convites pendentes da empresa' })
  list(@CurrentUser() user: CurrentUserType) {
    return this.invitations.list(user);
  }

  @Post()
  @RequireModulePermission('users', 'canCreate')
  @ApiOperation({ summary: 'Convidar alguem por e-mail (devolve o link para copiar)' })
  create(@Body() dto: CreateInvitationDto, @CurrentUser() user: CurrentUserType) {
    return this.invitations.create(user, dto);
  }

  @Post(':id/resend')
  @RequireModulePermission('users', 'canCreate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gerar link novo e reenviar o convite' })
  resend(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.invitations.resend(user, id);
  }

  @Delete(':id')
  @RequireModulePermission('users', 'canCreate')
  @ApiOperation({ summary: 'Cancelar convite' })
  revoke(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.invitations.revoke(user, id);
  }
}

/** Rotas de quem recebeu o link (sem login). */
@ApiTags('Invitations')
@Controller('invitations/public')
@UseGuards(AuthThrottlerGuard)
export class InvitationPublicController {
  constructor(private readonly invitations: InvitationService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Dados do convite (empresa, cargo, se a conta ja existe)' })
  info(@Param('token') token: string) {
    return this.invitations.publicInfo(token);
  }

  @Post(':token/accept')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceitar o convite e entrar na empresa' })
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(token, dto);
  }
}
