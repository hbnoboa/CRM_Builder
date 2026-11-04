import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from '../../common/guards/auth-throttler.guard';
import { AuthService } from './auth.service';
import { LoginDto, LoginMfaDto, RegisterDto, RefreshTokenDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { clientIp } from '../../common/utils/client-ip';
import { assertNotImpersonating } from '../../common/utils/permission-governance';
import type { Request } from 'express';
import type { ClientInfo } from './session-cache';

const clientInfo = (req: Request): ClientInfo => ({
  // IPv4 chega como ::ffff:1.2.3.4 quando o servidor escuta em IPv6.
  ip: clientIp(req)?.replace(/^::ffff:/i, ''),
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
});

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  // Throttle so nas rotas publicas de auth (o guard nao e global): ver AuthThrottlerGuard.
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @ApiOperation({ summary: 'Cadastro self-service: cria empresa (trial) + administrador e devolve a sessao' })
  @ApiResponse({ status: 201, description: 'Usuario criado' })
  @ApiResponse({ status: 409, description: 'Email ja em uso' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente em 1 minuto.' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, clientInfo(req));
  }

  @Post('login')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  @ApiResponse({ status: 200, description: 'Login realizado' })
  @ApiResponse({ status: 401, description: 'Credenciais invalidas' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente em 1 minuto.' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, clientInfo(req));
  }

  @Post('login/mfa')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Segundo passo do login (codigo do app autenticador ou de recuperacao)' })
  async loginMfa(@Body() dto: LoginMfaDto, @Req() req: Request) {
    return this.authService.loginWithMfa(dto, clientInfo(req));
  }

  @Post('refresh')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar tokens' })
  @ApiResponse({ status: 200, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Refresh token invalido' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente em 1 minuto.' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto, clientInfo(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  @ApiResponse({ status: 200, description: 'Logout realizado' })
  async logout(@CurrentUser() user: CurrentUserType) {
    return this.authService.logout(user.id, user.sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter usuario atual' })
  @ApiResponse({ status: 200, description: 'Dados do usuario' })
  async getMe(
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') jwtTenantId: string,
  ) {
    return this.authService.getMe(userId, jwtTenantId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar perfil do usuario' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alterar senha' })
  @ApiResponse({ status: 200, description: 'Senha alterada' })
  @ApiResponse({ status: 400, description: 'Senha atual incorreta' })
  async changePassword(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: ChangePasswordDto,
  ) {
    assertNotImpersonating(user, 'trocar a senha');
    return this.authService.changePassword(user.id, dto, user.sessionId);
  }

  @Post('switch-tenant')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trocar para outro tenant (requer UserTenantAccess)' })
  @ApiResponse({ status: 200, description: 'Tokens com novo tenant' })
  @ApiResponse({ status: 401, description: 'Sem acesso ao tenant' })
  async switchTenant(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: SwitchTenantDto,
    @Req() req: Request,
  ) {
    return this.authService.switchTenant(user.id, dto.tenantId, user.sessionId, clientInfo(req));
  }

  @Get('accessible-tenants')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar tenants acessiveis pelo usuario' })
  @ApiResponse({ status: 200, description: 'Lista de tenants' })
  async getAccessibleTenants(@CurrentUser('id') userId: string) {
    return this.authService.getAccessibleTenants(userId);
  }

  @Post('forgot-password')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar recuperacao de senha' })
  @ApiResponse({ status: 200, description: 'Email enviado (se existir)' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente em 1 minuto.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @ApiResponse({ status: 200, description: 'Senha redefinida' })
  @ApiResponse({ status: 400, description: 'Token invalido ou expirado' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente em 1 minuto.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
