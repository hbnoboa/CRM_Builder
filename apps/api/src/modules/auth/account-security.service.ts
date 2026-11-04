import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../../common/utils/totp';
import { open, seal } from '../../common/utils/secret-box';
import { securityOf, TenantSecurity } from '../../common/utils/password-policy';
import { loadManagedMember } from '../../common/utils/member-governance';
import { forgetSessions } from './session-cache';
import { AuthService } from './auth.service';

const hashCode = (code: string) => createHash('sha256').update(code.toLowerCase().replace(/\s/g, '')).digest('hex');
const ISSUER = 'CRM Builder';

/** Sessoes por aparelho, verificacao em duas etapas e a politica de seguranca da empresa. */
@Injectable()
export class AccountSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  // ── Sessoes (da propria pessoa) ─────────────────────────────────────────

  async listSessions(user: CurrentUser) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId: user.id, revokedAt: null, refreshTokens: { some: { expiresAt: { gt: new Date() } } } },
      select: { id: true, ip: true, userAgent: true, label: true, createdAt: true, lastUsedAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => ({ ...s, current: s.id === user.sessionId }));
  }

  async revokeSession(user: CurrentUser, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({ where: { id: sessionId, userId: user.id, revokedAt: null } });
    if (!session) throw new NotFoundException('Sessao nao encontrada');
    await this.prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    forgetSessions([sessionId]);
    return { success: true };
  }

  revokeOtherSessions(user: CurrentUser) {
    return this.auth.revokeSessions(user.id, user.sessionId);
  }

  // ── Duas etapas ─────────────────────────────────────────────────────────

  async mfaStatus(user: CurrentUser) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { mfaEnabledAt: true, mfaRecoveryCodes: true },
    });
    const policy = await this.policyFor(user.tenantId);
    return { enabled: !!row.mfaEnabledAt, enabledAt: row.mfaEnabledAt, recoveryCodesLeft: row.mfaRecoveryCodes.length, requiredByCompany: policy.requireMfa };
  }

  /** Gera o segredo (ainda nao ativo) e o QR para o app autenticador. */
  async mfaSetup(user: CurrentUser) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, mfaEnabledAt: true } });
    if (row.mfaEnabledAt) throw new BadRequestException('A verificacao em duas etapas ja esta ativa');
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaPendingSecret: seal(secret) } });
    const url = otpauthUrl(secret, row.email, ISSUER);
    return { secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
  }

  async mfaEnable(user: CurrentUser, code: string) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { mfaPendingSecret: true, mfaEnabledAt: true } });
    if (row.mfaEnabledAt) throw new BadRequestException('A verificacao em duas etapas ja esta ativa');
    if (!row.mfaPendingSecret) throw new BadRequestException('Comece pela leitura do QR code');
    const secret = open(row.mfaPendingSecret);
    if (!verifyTotp(secret, code)) throw new BadRequestException('Codigo invalido. Confira o horario do celular e tente de novo.');
    const recoveryCodes = this.newRecoveryCodes();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: row.mfaPendingSecret,
        mfaPendingSecret: null,
        mfaEnabledAt: new Date(),
        mfaRecoveryCodes: recoveryCodes.map(hashCode),
      },
    });
    return { recoveryCodes };
  }

  async mfaDisable(user: CurrentUser, password: string, code: string) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { password: true, mfaSecret: true, mfaRecoveryCodes: true },
    });
    if (!row.mfaSecret) throw new BadRequestException('A verificacao em duas etapas nao esta ativa');
    if (!(await bcrypt.compare(password, row.password))) throw new UnauthorizedException('Senha incorreta');
    if (!this.checkCode(row.mfaSecret, row.mfaRecoveryCodes, code)) throw new UnauthorizedException('Codigo invalido');
    const requiring = await this.prisma.userTenantAccess.findMany({
      where: { userId: user.id, status: Status.ACTIVE, deletedAt: null },
      select: { tenant: { select: { name: true, settings: true } } },
    });
    const blocker = requiring.find((m) => securityOf(m.tenant.settings).requireMfa);
    if (blocker) throw new ForbiddenException(`A empresa ${blocker.tenant.name} exige verificacao em duas etapas`);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [] },
    });
    return { success: true };
  }

  async regenerateRecoveryCodes(user: CurrentUser, code: string) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { mfaSecret: true } });
    if (!row.mfaSecret) throw new BadRequestException('A verificacao em duas etapas nao esta ativa');
    if (!verifyTotp(open(row.mfaSecret), code)) throw new UnauthorizedException('Codigo invalido');
    const recoveryCodes = this.newRecoveryCodes();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: recoveryCodes.map(hashCode) } });
    return { recoveryCodes };
  }

  private checkCode(sealedSecret: string, recovery: string[], code: string): boolean {
    return verifyTotp(open(sealedSecret), code) || recovery.includes(hashCode(code));
  }

  private newRecoveryCodes(): string[] {
    return Array.from({ length: 10 }, () => {
      const raw = randomBytes(5).toString('hex');
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
  }

  // ── Politica da empresa ─────────────────────────────────────────────────

  async policyFor(tenantId: string): Promise<TenantSecurity> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true } });
    return securityOf(tenant.settings);
  }

  async updatePolicy(user: CurrentUser, dto: Partial<TenantSecurity>) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { settings: true } });
    const current = securityOf(tenant.settings);
    const next: TenantSecurity = { ...current, ...dto };
    if (next.requireMfa && !current.requireMfa) {
      // Quem liga a exigencia precisa ja ter ativado (senao se tranca para fora).
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { mfaEnabledAt: true } });
      if (!me.mfaEnabledAt && !user.impersonatedBy) {
        throw new BadRequestException('Ative a verificacao em duas etapas na sua conta antes de exigir da equipe');
      }
    }
    const settings = { ...((tenant.settings ?? {}) as Record<string, unknown>), security: next };
    await this.prisma.tenant.update({ where: { id: user.tenantId }, data: { settings: settings as unknown as Prisma.InputJsonValue } });
    return next;
  }

  /** Equipe com a situacao de seguranca de cada um (duas etapas, ultimo acesso, aparelhos). */
  async members(user: CurrentUser) {
    const rows = await this.prisma.userTenantAccess.findMany({
      where: { tenantId: user.tenantId, deletedAt: null, user: { isServiceAccount: false, deletedAt: null } },
      select: {
        status: true,
        customRole: { select: { name: true } },
        user: {
          select: {
            id: true, name: true, email: true, lastLoginAt: true, mfaEnabledAt: true,
            _count: { select: { sessions: { where: { revokedAt: null, refreshTokens: { some: { expiresAt: { gt: new Date() } } } } } } },
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });
    return rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      role: r.customRole.name,
      active: r.status === Status.ACTIVE,
      lastLoginAt: r.user.lastLoginAt,
      mfaEnabled: !!r.user.mfaEnabledAt,
      activeSessions: r.user._count.sessions,
    }));
  }

  /** Admin desconecta um membro de todos os aparelhos (regra de nivel/dono vale). */
  async logoutMember(user: CurrentUser, userId: string) {
    const target = await loadManagedMember(this.prisma, user, userId);
    if (target.isSelf) throw new BadRequestException('Para sair dos seus aparelhos use as suas configuracoes');
    return this.auth.revokeSessions(userId);
  }
}
