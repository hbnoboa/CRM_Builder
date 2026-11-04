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
import { assertPasswordPolicy } from '../../common/utils/password-policy';
import { verifyTotp } from '../../common/utils/totp';
import { open as openSecret } from '../../common/utils/secret-box';
import { ClientInfo, forgetSessions, hashRefreshToken } from './session-cache';
import { createHash } from 'crypto';

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
  /** Dias de teste do cadastro self-service (SIGNUP_TRIAL_DAYS, padrao 14). */
  private signupTrialDays(): number {
    const days = parseInt(this.configService.get<string>('SIGNUP_TRIAL_DAYS') || '14', 10);
    return Number.isFinite(days) && days > 0 ? days : 14;
  }

  signupInfo() {
    return { trialDays: this.signupTrialDays() };
  }

  async register(dto: RegisterDto, client: ClientInfo = {}) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('Email ja esta em uso');
    }

    const slug = await this.uniqueTenantSlug(dto.tenantName);
    const plan = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });
    const trialDays = this.signupTrialDays();
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    await this.tenantService.create(
      {
        name: dto.tenantName,
        slug,
        adminName: dto.name,
        adminEmail: dto.email,
        adminPassword: dto.password,
      },
      { planId: plan?.id ?? null, lifecycle: TenantLifecycle.TRIAL, trialEndsAt, source: 'signup' },
    );

    this.logger.log(`Cadastro self-service: ${dto.email} -> tenant ${slug} (trial ${trialDays}d)`);
    return this.login({ email: dto.email, password: dto.password }, client);
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

  async login(dto: LoginDto, client: ClientInfo = {}) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, status: Status.ACTIVE, isServiceAccount: false },
      select: { id: true, email: true, name: true, avatar: true, password: true, mfaEnabledAt: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    // Verificacao em duas etapas: a senha so libera o segundo passo (5 minutos).
    if (user.mfaEnabledAt) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, rememberMe: !!dto.rememberMe },
        { audience: 'mfa', expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }

    return this.completeLogin(user, !!dto.rememberMe, client);
  }

  /** Segundo passo do login: codigo do app autenticador ou de recuperacao. */
  async loginWithMfa(dto: { mfaToken: string; code: string }, client: ClientInfo = {}) {
    let payload: { sub: string; rememberMe?: boolean };
    try {
      payload = this.jwtService.verify(dto.mfaToken, { audience: 'mfa' });
    } catch {
      throw new UnauthorizedException('Etapa de verificacao expirada. Entre de novo.');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: Status.ACTIVE, isServiceAccount: false },
      select: { id: true, email: true, name: true, avatar: true, mfaSecret: true, mfaRecoveryCodes: true },
    });
    if (!user?.mfaSecret) throw new UnauthorizedException('Etapa de verificacao expirada. Entre de novo.');

    const code = dto.code.trim();
    if (!verifyTotp(openSecret(user.mfaSecret), code)) {
      // Codigo de recuperacao: uso unico.
      const hash = createHash('sha256').update(code.toLowerCase().replace(/\s/g, '')).digest('hex');
      if (!user.mfaRecoveryCodes.includes(hash)) throw new UnauthorizedException('Codigo invalido');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaRecoveryCodes: user.mfaRecoveryCodes.filter((h) => h !== hash) },
      });
      this.logger.log(`Codigo de recuperacao usado: ${user.email}`);
    }
    return this.completeLogin(user, !!payload.rememberMe, client);
  }

  private async completeLogin(
    user: { id: string; email: string; name: string; avatar: string | null },
    rememberMe: boolean,
    client: ClientInfo,
  ) {
    // Tenant + cargo vem da membership home.
    const membership = await this.loadPrimaryMembership(user.id);
    if (!membership) {
      throw new UnauthorizedException('Usuario sem acesso a nenhum tenant');
    }
    if (membership.tenant.status !== Status.ACTIVE) {
      throw new UnauthorizedException('Tenant suspenso ou inativo');
    }

    const tokens = await this.generateTokens(
      {
        id: user.id,
        email: user.email,
        tenantId: membership.tenantId,
        customRoleId: membership.customRoleId,
      },
      rememberMe,
      undefined,
      { client },
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

    this.logger.log(`Login: ${user.email}${rememberMe ? ' (remember me)' : ''}`);

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

  async refreshToken(dto: RefreshTokenDto, client: ClientInfo = {}) {
    try {
      this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Rotacao de uso unico (como o portal do CLIENTE do segmob): o refresh token e
      // revogado imediatamente e um novo e emitido. A robustez contra logout vem do
      // frontend (single-flight unico: interceptor + ensureAuth nunca disparam 2 refresh).
      const storedToken = await this.prisma.$transaction(async (tx) => {
        // Guardado com hash; tokens de antes do hash guardavam o token puro.
        const token = await tx.refreshToken.findFirst({
          where: { token: { in: [hashRefreshToken(dto.refreshToken), dto.refreshToken] } },
          include: {
            user: { select: { id: true, email: true, status: true } },
            session: { select: { id: true, revokedAt: true } },
          },
        });

        if (!token || token.expiresAt < new Date()) {
          throw new UnauthorizedException('Refresh token invalido ou expirado');
        }
        // Sessao encerrada de proposito (sair, sair de todos, admin desconectou):
        // codigo proprio para o app nao tentar entrar de novo sozinho.
        if (token.session?.revokedAt) throw new UnauthorizedException('SESSION_REVOKED');

        // Uso unico: se outro refresh ja consumiu este token, este falha.
        const { count } = await tx.refreshToken.deleteMany({ where: { id: token.id } });
        if (count === 0) throw new UnauthorizedException('Refresh token invalido ou expirado');
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
        // Mesma sessao (aparelho): so o refresh token gira.
        { id: storedToken.sessionId ?? undefined, client },
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

  /** Encerra so a sessao deste aparelho (os outros continuam logados). */
  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.userSession.updateMany({ where: { id: sessionId, userId }, data: { revokedAt: new Date() } });
      forgetSessions([sessionId]);
    } else {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    return { message: 'Logout realizado com sucesso' };
  }

  /** Encerra sessoes do usuario (todas, ou todas menos `keepSessionId`). */
  async revokeSessions(userId: string, keepSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, ...(keepSessionId && { id: { not: keepSessionId } }) },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    // Os refresh tokens das sessoes encerradas ficam ate vencer: o refresh responde
    // SESSION_REVOKED. Tokens antigos (sem sessao) nao tem como identificar: caem.
    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({ where: { id: { in: ids } }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.deleteMany({ where: { userId, sessionId: null } }),
    ]);
    forgetSessions(ids);
    return { revoked: ids.length };
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
        mfaEnabledAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }
    const { mfaEnabledAt, ...userFields } = user;
    const base = { ...userFields, mfaEnabled: !!mfaEnabledAt };

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
        ...base,
        tenantId: membership!.tenantId,
        tenant: membership!.tenant,
        customRoleId: membership!.customRoleId,
        customRole: membership!.customRole,
        hasMultipleTenants: accessCount > 1,
      };
    }

    // Fallback: home.
    return {
      ...base,
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

  async changePassword(userId: string, dto: ChangePasswordDto, sessionId?: string) {
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
    await assertPasswordPolicy(this.prisma, await this.activeTenantIds(userId), dto.newPassword);

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    // Senha nova: os outros aparelhos precisam entrar de novo.
    await this.revokeSessions(userId, sessionId);

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
    await assertPasswordPolicy(this.prisma, await this.activeTenantIds(user.id), dto.newPassword);

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpires: null },
    });

    await this.revokeSessions(user.id);

    this.logger.log(`Senha resetada: ${user.email}`);
    return { message: 'Senha redefinida com sucesso' };
  }

  async switchTenant(userId: string, targetTenantId: string, sessionId?: string, client: ClientInfo = {}) {
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
      }, false, undefined, { id: sessionId, client }).then((tokens) => ({
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
    client: ClientInfo = {},
  ) {
    return this.generateTokens(user, rememberMe, impersonatedBy, { client });
  }

  /** Empresas em que o usuario tem acesso ativo (para a politica de senha mais rigida). */
  private async activeTenantIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userTenantAccess.findMany({
      where: { userId, status: Status.ACTIVE, deletedAt: null },
      select: { tenantId: true },
    });
    return rows.map((r) => r.tenantId);
  }

  private async generateTokens(
    user: UserForTokenGeneration,
    rememberMe = false,
    impersonatedBy?: { id: string; name: string },
    session: { id?: string; client?: ClientInfo } = {},
  ) {
    // Sessao = aparelho/navegador. Login cria; refresh e troca de empresa mantem.
    const client = session.client ?? {};
    const sessionId = session.id
      ?? (await this.prisma.userSession.create({
        data: {
          userId: user.id,
          ip: client.ip,
          userAgent: client.userAgent?.slice(0, 300),
          label: impersonatedBy ? impersonatedBy.name : null,
        },
        select: { id: true },
      })).id;
    if (session.id) {
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date(), ...(client.ip && { ip: client.ip }), ...(client.userAgent && { userAgent: client.userAgent.slice(0, 300) }) },
      }).catch(() => undefined);
    }

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
      sid: sessionId,
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
        token: hashRefreshToken(refreshToken),
        sessionId,
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
