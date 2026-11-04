import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto, RefreshTokenDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { Status, TenantLifecycle } from '@prisma/client';
import { TenantService, RESERVED_TENANT_SLUGS } from '../tenant/tenant.service';
import { EmailService } from '../email/email.service';
import { transactionalEmail } from '../email/email-layout';
import { appUrl } from '../../common/utils/app-url';

export interface UserForTokenGeneration {
  id: string;
  email: string;
  tenantId: string;
  customRoleId: string;
}

// Identidade global (#10): tenant + cargo vem SEMPRE da Membership (UserTenantAccess).
const FULL_ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  color: true,
  isSystem: true,
  rank: true,
  permissions: true,
  modulePermissions: true,
  tenantPermissions: true,
  isDefault: true,
} as const;

const TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  settings: true,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tenantService: TenantService,
    private email: EmailService,
  ) {}

  // ── Resolucao de Membership (fonte da verdade de tenant + cargo) ────────────
  /** Membership "home": primaria (isPrimary) ou, na falta, a mais antiga ativa. */
  private async loadPrimaryMembership(userId: string) {
    const memberships = await this.prisma.userTenantAccess.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        tenant: { select: TENANT_SELECT },
        customRole: { select: FULL_ROLE_SELECT },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return memberships[0] ?? null;
  }

  /** Membership de (usuario, tenant) especifico. */
  private async loadMembership(userId: string, tenantId: string) {
    return this.prisma.userTenantAccess.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: {
        tenant: { select: TENANT_SELECT },
        customRole: { select: FULL_ROLE_SELECT },
      },
    });
  }

  private isMembershipUsable(m: { status: string; expiresAt: Date | null } | null): boolean {
    return !!m && m.status === 'ACTIVE' && (!m.expiresAt || m.expiresAt > new Date());
  }

  /**
   * Cadastro self-service: cria uma empresa nova (tenant em TRIAL no plano
   * padrao) com o usuario como administrador e ja devolve a sessao (mesmo
   * formato do login). Unico caminho publico de criacao de conta.
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('Email ja esta em uso');
    }

    const slug = await this.uniqueTenantSlug(dto.tenantName);
    const plan = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });
    const trialDays = parseInt(this.configService.get<string>('SIGNUP_TRIAL_DAYS') || '14', 10);
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    await this.tenantService.create(
      {
        name: dto.tenantName,
        slug,
        adminName: dto.name,
        adminEmail: dto.email,
        adminPassword: dto.password,
      },
      { planId: plan?.id ?? null, lifecycle: TenantLifecycle.TRIAL, trialEndsAt },
    );

    this.logger.log(`Cadastro self-service: ${dto.email} -> tenant ${slug} (trial ${trialDays}d)`);
    return this.login({ email: dto.email, password: dto.password });
  }

  /** Slug a partir do nome da empresa, sem colidir com tenants nem rotas reservadas. */
  private async uniqueTenantSlug(name: string): Promise<string> {
    const base =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32)
        .replace(/-+$/, '') || 'empresa';

    for (let i = 1; i <= 20; i++) {
      const candidate = i === 1 ? base : `${base}-${i}`;
      if (RESERVED_TENANT_SLUGS.has(candidate)) continue;
      const taken = await this.prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${base}-${randomUUID().slice(0, 6)}`;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, status: Status.ACTIVE, isServiceAccount: false },
      select: { id: true, email: true, name: true, avatar: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    // Tenant + cargo vem da membership home.
    const membership = await this.loadPrimaryMembership(user.id);
    if (!membership) {
      throw new UnauthorizedException('Usuario sem acesso a nenhum tenant');
    }
    if (membership.tenant.status !== Status.ACTIVE) {
      throw new UnauthorizedException('Tenant suspenso ou inativo');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const tokens = await this.generateTokens(
      {
        id: user.id,
        email: user.email,
        tenantId: membership.tenantId,
        customRoleId: membership.customRoleId,
      },
      dto.rememberMe,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Quantos tenants ele alcanca (home incluso). >1 = multi-tenant.
    const accessCount = await this.prisma.userTenantAccess.count({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    this.logger.log(`Login: ${user.email}${dto.rememberMe ? ' (remember me)' : ''}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        customRoleId: membership.customRoleId,
        customRole: membership.customRole,
        tenantId: membership.tenantId,
        tenant: membership.tenant,
        hasMultipleTenants: accessCount > 1,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Rotacao de uso unico (como o portal do CLIENTE do segmob): o refresh token e
      // revogado imediatamente e um novo e emitido. A robustez contra logout vem do
      // frontend (single-flight unico: interceptor + ensureAuth nunca disparam 2 refresh).
      const storedToken = await this.prisma.$transaction(async (tx) => {
        const token = await tx.refreshToken.findUnique({
          where: { token: dto.refreshToken },
          include: { user: { select: { id: true, email: true, status: true } } },
        });

        if (!token || token.expiresAt < new Date()) {
          throw new UnauthorizedException('Refresh token invalido ou expirado');
        }

        await tx.refreshToken.delete({ where: { id: token.id } });
        return token;
      });

      if (storedToken.user.status !== Status.ACTIVE) {
        throw new UnauthorizedException('Usuario inativo');
      }

      // Preserva o contexto de tenant trocado + rememberMe do token anterior.
      const decoded = this.jwtService.decode(dto.refreshToken) as {
        tenantId?: string;
        rememberMe?: boolean;
        impersonatedBy?: { id: string; name: string };
      } | null;
      const requestedTenantId = decoded?.tenantId;
      const wasRememberMe = decoded?.rememberMe ?? false;

      const ctx = await this.resolveTokenContext(storedToken.user.id, requestedTenantId);
      if (!ctx) {
        throw new UnauthorizedException('Usuario sem acesso a nenhum tenant');
      }

      return this.generateTokens(
        {
          id: storedToken.user.id,
          email: storedToken.user.email,
          tenantId: ctx.tenantId,
          customRoleId: ctx.customRoleId,
        },
        wasRememberMe,
        // Sessao impersonada continua impersonada apos o refresh (auditoria + banner).
        decoded?.impersonatedBy,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Refresh token invalido');
    }
  }

  /**
   * Resolve {tenantId, customRoleId} para um tenant solicitado:
   * membership usavel do tenant -> senao home (nunca tenant sem membership).
   * Espelha a logica do jwt.strategy.
   */
  private async resolveTokenContext(userId: string, requestedTenantId?: string) {
    const primary = await this.loadPrimaryMembership(userId);
    if (!primary) return null;

    if (requestedTenantId && requestedTenantId !== primary.tenantId) {
      const m = await this.loadMembership(userId, requestedTenantId);
      if (this.isMembershipUsable(m)) {
        return { tenantId: requestedTenantId, customRoleId: m!.customRoleId };
      }
    }
    return { tenantId: primary.tenantId, customRoleId: primary.customRoleId };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Logout realizado com sucesso' };
  }

  async getMe(userId: string, jwtTenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const primary = await this.loadPrimaryMembership(userId);
    if (!primary) {
      throw new UnauthorizedException('Usuario sem acesso a nenhum tenant');
    }

    const accessCount = await this.prisma.userTenantAccess.count({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const target = jwtTenantId || primary.tenantId;

    // Membership no tenant solicitado.
    const membership = target === primary.tenantId ? primary : await this.loadMembership(userId, target);
    if (this.isMembershipUsable(membership)) {
      return {
        ...user,
        tenantId: membership!.tenantId,
        tenant: membership!.tenant,
        customRoleId: membership!.customRoleId,
        customRole: membership!.customRole,
        hasMultipleTenants: accessCount > 1,
      };
    }

    // Fallback: home.
    return {
      ...user,
      tenantId: primary.tenantId,
      tenant: primary.tenant,
      customRoleId: primary.customRoleId,
      customRole: primary.customRole,
      hasMultipleTenants: accessCount > 1,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatar && { avatar: dto.avatar }),
      },
      select: { id: true, email: true, name: true, avatar: true },
    });

    this.logger.log(`Perfil atualizado: ${user.email}`);
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Senha alterada: ${user.email}`);
    return { message: 'Senha alterada com sucesso' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // Email e global -> nao filtra por tenant.
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, status: Status.ACTIVE, isServiceAccount: false },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return { message: 'Se o email existir, voce recebera um link de recuperacao' };
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires: resetExpires },
    });

    const url = `${appUrl()}/pt-BR/reset-password?token=${resetToken}`;
    const { html, text } = transactionalEmail({
      title: 'Redefinir sua senha',
      paragraphs: [`Olá, ${user.name}!`, 'Recebemos um pedido para redefinir a sua senha. O link vale por 1 hora.'],
      buttonLabel: 'Criar nova senha',
      url,
      footer: 'Se você não pediu, ignore este e-mail: sua senha continua a mesma.',
    });
    const result = await this.email.send({ to: user.email, subject: 'Redefinir sua senha', html, text });
    this.logger.log(`Reset de senha para ${user.email}: e-mail ${result.sent ? 'enviado' : 'NAO enviado (sem provedor)'}`);
    return { message: 'Se o email existir, voce recebera um link de recuperacao' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpires: { gt: new Date() },
        status: Status.ACTIVE,
      },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('Token invalido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpires: null },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    this.logger.log(`Senha resetada: ${user.email}`);
    return { message: 'Senha redefinida com sucesso' };
  }

  async switchTenant(userId: string, targetTenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true, status: true },
    });
    if (!user || user.status !== Status.ACTIVE) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const primary = await this.loadPrimaryMembership(userId);
    if (!primary) {
      throw new UnauthorizedException('Usuario sem acesso a nenhum tenant');
    }

    const buildResult = (
      tenantId: string,
      tenant: unknown,
      customRoleId: string,
      customRole: unknown,
    ) =>
      this.generateTokens({
        id: user.id,
        email: user.email,
        tenantId,
        customRoleId,
      }).then((tokens) => ({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          customRoleId,
          customRole,
          tenantId,
          tenant,
          hasMultipleTenants: true,
        },
        ...tokens,
      }));

    // Home tenant (primaria).
    if (targetTenantId === primary.tenantId) {
      return buildResult(primary.tenantId, primary.tenant, primary.customRoleId, primary.customRole);
    }

    // Membership no tenant destino?
    const access = await this.loadMembership(userId, targetTenantId);
    if (this.isMembershipUsable(access)) {
      if (access!.tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tenant suspenso ou inativo');
      }
      return buildResult(targetTenantId, access!.tenant, access!.customRoleId, access!.customRole);
    }

    // Sem membership usavel: nunca entra (acesso cross-tenant so pelo console da plataforma).
    throw new UnauthorizedException('Sem acesso a este tenant');
  }

  async getAccessibleTenants(userId: string) {
    const accessList = await this.prisma.userTenantAccess.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true, logo: true } },
        customRole: { select: { id: true, name: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { tenant: { name: 'asc' } }],
    });

    return accessList.map((a) => ({
      id: a.tenant.id,
      name: a.tenant.name,
      slug: a.tenant.slug,
      logo: a.tenant.logo,
      isHome: a.isPrimary,
      customRole: {
        id: a.customRole.id,
        name: a.customRole.name,
      },
    }));
  }

  /**
   * Gera tokens JWT para um usuario. Usado internamente e pelo PublicLink module.
   */
  async generateTokensForUser(
    user: UserForTokenGeneration,
    rememberMe = false,
    impersonatedBy?: { id: string; name: string },
  ) {
    return this.generateTokens(user, rememberMe, impersonatedBy);
  }

  private async generateTokens(
    user: UserForTokenGeneration,
    rememberMe = false,
    impersonatedBy?: { id: string; name: string },
  ) {
    // permsV: versao das permissoes do cargo no momento do mint. O JwtStrategy
    // rejeita (401) tokens com permsV defasado -> o cliente faz refresh silencioso.
    const roleForV = await this.prisma.customRole.findUnique({
      where: { id: user.customRoleId },
      select: { permsVersion: true },
    });

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      customRoleId: user.customRoleId,
      roleId: user.customRoleId,
      permsV: roleForV?.permsVersion ?? 0,
      ...(impersonatedBy ? { impersonatedBy } : {}),
    };

    const accessToken = this.jwtService.sign(payload);

    // Modelo CLIENTE do segmob: refresh sempre 30 dias (independe de rememberMe).
    const refreshDays = 30;
    const refreshExpiration = new Date();
    refreshExpiration.setDate(refreshExpiration.getDate() + refreshDays);

    // jti unico (como o cliente do segmob) garante que cada refresh token e distinto —
    // sem ele, dois tokens gerados no mesmo segundo ficam identicos e a rotacao/reuse falha.
    const refreshPayload = { ...payload, rememberMe, jti: randomUUID() };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '30d',
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshExpiration,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '1h',
    };
  }
}
