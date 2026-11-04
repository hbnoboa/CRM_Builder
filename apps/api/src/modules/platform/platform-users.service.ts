import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PlatformAuditService } from './platform-audit.service';
import type { PlatformStaffPrincipal } from './platform-permissions';

const USER_SELECT = {
  id: true, name: true, email: true, phone: true, cpf: true, status: true, lastLoginAt: true, createdAt: true, mfaEnabledAt: true,
  tenantAccess: {
    select: {
      status: true, deletedAt: true, createdAt: true,
      customRole: { select: { name: true } },
      tenant: { select: { id: true, name: true, slug: true, lifecycle: true, ownerId: true, deletedAt: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/**
 * Busca global de pessoas no console (todas as empresas) e acoes de suporte na
 * conta: link de nova senha, desconectar de todos os aparelhos, desligar as duas
 * etapas. Tudo auditado no console.
 */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: PlatformAuditService,
  ) {}

  private shape(u: UserRow, activeSessions: number) {
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone, cpf: u.cpf, status: u.status,
      lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, mfaEnabled: !!u.mfaEnabledAt, activeSessions,
      memberships: u.tenantAccess
        .filter((m) => !m.tenant.deletedAt)
        .map((m) => ({
          tenant: { id: m.tenant.id, name: m.tenant.name, slug: m.tenant.slug, lifecycle: m.tenant.lifecycle },
          role: m.customRole.name,
          status: m.deletedAt ? 'REMOVED' : m.status,
          isOwner: m.tenant.ownerId === u.id,
          since: m.createdAt,
        })),
    };
  }

  private async sessionCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.prisma.userSession.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, revokedAt: null, refreshTokens: { some: { expiresAt: { gt: new Date() } } } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.userId, r._count._all]));
  }

  async search(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    const digits = term.replace(/\D/g, '');
    const users = await this.prisma.user.findMany({
      where: {
        isServiceAccount: false,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { cpf: { contains: digits } }] : []),
          { id: term },
        ],
      },
      select: USER_SELECT,
      orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      take: 30,
    });
    const sessions = await this.sessionCounts(users.map((u) => u.id));
    return users.map((u) => this.shape(u, sessions.get(u.id) ?? 0));
  }

  async detail(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, isServiceAccount: false }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Pessoa nao encontrada');
    const [sessions, actions] = await Promise.all([
      this.prisma.userSession.findMany({
        where: { userId: id, revokedAt: null, refreshTokens: { some: { expiresAt: { gt: new Date() } } } },
        select: { id: true, ip: true, userAgent: true, label: true, createdAt: true, lastUsedAt: true },
        orderBy: { lastUsedAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { userId: id },
        select: { createdAt: true, action: true, resource: true, resourceId: true, tenantId: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { ...this.shape(user, sessions.length), sessions, recentActions: actions };
  }

  private async active(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, isServiceAccount: false }, select: { id: true, email: true, name: true, status: true, mfaEnabledAt: true } });
    if (!user) throw new NotFoundException('Pessoa nao encontrada');
    return user;
  }

  async sendPasswordReset(staff: PlatformStaffPrincipal, id: string) {
    const user = await this.active(id);
    if (user.status !== Status.ACTIVE) throw new BadRequestException('A conta esta inativa');
    await this.auth.forgotPassword({ email: user.email });
    await this.audit.log(staff, { action: 'user.password_reset_sent', targetType: 'user', targetId: id, metadata: { email: user.email } });
    return { success: true };
  }

  async logoutEverywhere(staff: PlatformStaffPrincipal, id: string) {
    const user = await this.active(id);
    const result = await this.auth.revokeSessions(user.id);
    await this.audit.log(staff, { action: 'user.sessions_revoked', targetType: 'user', targetId: id, metadata: { email: user.email } });
    return result;
  }

  async resetMfa(staff: PlatformStaffPrincipal, id: string) {
    const user = await this.active(id);
    if (!user.mfaEnabledAt) throw new BadRequestException('A verificacao em duas etapas ja esta desligada');
    await this.prisma.user.update({
      where: { id },
      data: { mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [] },
    });
    // Quem estava logado precisa entrar de novo (e configurar de novo, se a empresa exigir).
    await this.auth.revokeSessions(id);
    await this.audit.log(staff, { action: 'user.mfa_reset', targetType: 'user', targetId: id, metadata: { email: user.email } });
    return { success: true };
  }
}
