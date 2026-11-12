import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { checkModulePermission } from '../../common/utils/check-module-permission';
import { assertNotImpersonating } from '../../common/utils/permission-governance';
import { AccountSecurityService } from './account-security.service';

class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}

class MfaDisableDto extends MfaCodeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

class SecurityPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireMfa?: boolean;

  @ApiPropertyOptional({ minimum: 8, maximum: 64 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(64)
  passwordMinLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  passwordRequireSymbol?: boolean;
}

/** Seguranca da propria conta: aparelhos conectados e verificacao em duas etapas. */
@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountSecurityController {
  constructor(private readonly security: AccountSecurityService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Aparelhos conectados' })
  sessions(@CurrentUser() user: CurrentUserType) {
    return this.security.listSessions(user);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Encerrar uma sessao' })
  revoke(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    assertNotImpersonating(user, 'encerrar sessoes');
    return this.security.revokeSession(user, id);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sair de todos os outros aparelhos' })
  revokeOthers(@CurrentUser() user: CurrentUserType) {
    assertNotImpersonating(user, 'encerrar sessoes');
    return this.security.revokeOtherSessions(user);
  }

  @Get('mfa')
  @ApiOperation({ summary: 'Situacao da verificacao em duas etapas' })
  mfa(@CurrentUser() user: CurrentUserType) {
    return this.security.mfaStatus(user);
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gerar QR code para o app autenticador' })
  setup(@CurrentUser() user: CurrentUserType) {
    assertNotImpersonating(user, 'configurar a verificacao em duas etapas');
    return this.security.mfaSetup(user);
  }

  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar o codigo e ativar (devolve os codigos de recuperacao)' })
  enable(@CurrentUser() user: CurrentUserType, @Body() dto: MfaCodeDto) {
    assertNotImpersonating(user, 'configurar a verificacao em duas etapas');
    return this.security.mfaEnable(user, dto.code);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar (pede senha e codigo)' })
  disable(@CurrentUser() user: CurrentUserType, @Body() dto: MfaDisableDto) {
    assertNotImpersonating(user, 'configurar a verificacao em duas etapas');
    return this.security.mfaDisable(user, dto.password, dto.code);
  }

  @Post('mfa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gerar novos codigos de recuperacao' })
  recovery(@CurrentUser() user: CurrentUserType, @Body() dto: MfaCodeDto) {
    assertNotImpersonating(user, 'configurar a verificacao em duas etapas');
    return this.security.regenerateRecoveryCodes(user, dto.code);
  }
}

/** Seguranca da empresa: politica e situacao da equipe (administracao). */
@ApiTags('Security')
@Controller('security')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompanySecurityController {
  constructor(private readonly security: AccountSecurityService) {}

  @Get('policy')
  @ApiOperation({ summary: 'Politica de seguranca da empresa' })
  policy(@CurrentUser() user: CurrentUserType) {
    return this.security.policyFor(user.tenantId);
  }

  @Patch('policy')
  @ApiOperation({ summary: 'Alterar a politica (settings.canUpdate)' })
  updatePolicy(@CurrentUser() user: CurrentUserType, @Body() dto: SecurityPolicyDto) {
    checkModulePermission(user, 'settings', 'canUpdate');
    return this.security.updatePolicy(user, dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'Equipe com duas etapas, ultimo acesso e aparelhos' })
  members(@CurrentUser() user: CurrentUserType) {
    checkModulePermission(user, 'users', 'canRead');
    return this.security.members(user);
  }

  @Post('members/:userId/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desconectar um membro de todos os aparelhos' })
  logoutMember(@CurrentUser() user: CurrentUserType, @Param('userId') userId: string) {
    checkModulePermission(user, 'users', 'canUpdate');
    return this.security.logoutMember(user, userId);
  }
}
