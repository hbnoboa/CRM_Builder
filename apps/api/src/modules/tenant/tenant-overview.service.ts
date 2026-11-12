import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { hasFullTenantAccess } from '../../common/utils/platform-access';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Painel da administracao da empresa: o que precisa de atencao e o que a equipe
 * fez por ultimo. Uso do plano vem de GET /subscription (nao repete aqui).
 */
@Injectable()
export class TenantOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(currentUser: CurrentUser) {
    const tenantId = currentUser.tenantId;
    const since30 = new Date(Date.now() - 30 * DAY_MS);
    const since7 = new Date(Date.now() - 7 * DAY_MS);
    const activeMember = { tenantAccess: { some: { tenantId, deletedAt: null, status: 'ACTIVE' as const } }, isServiceAccount: false, deletedAt: null, status: 'ACTIVE' as const };

    const [neverLoggedIn, inactive30, roles, failed, invites] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...activeMember, lastLoginAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }).then(async (sample) => ({
        sample,
        count: sample.length < 5 ? sample.length : await this.prisma.user.count({ where: { ...activeMember, lastLoginAt: null } }),
      })),
      this.prisma.user.count({ where: { ...activeMember, lastLoginAt: { lt: since30 } } }),
      this.prisma.customRole.findMany({
        where: { tenantId, deletedAt: null, isDefault: false },
        select: { _count: { select: { tenantAccessUsers: { where: { deletedAt: null } }, publicLinks: true } } },
      }),
      Promise.all([
        this.prisma.automationExecution.count({ where: { tenantId, status: 'failed', startedAt: { gte: since7 } } }),
        this.prisma.actionChainExecution.count({ where: { tenantId, status: 'failed', startedAt: { gte: since7 } } }),
        this.prisma.webhookExecution.count({ where: { tenantId, status: { in: ['error', 'timeout'] }, createdAt: { gte: since7 } } }),
        this.prisma.scheduledTaskExecution.count({ where: { tenantId, status: { in: ['error', 'timeout'] }, startedAt: { gte: since7 } } }),
      ]).then((counts) => counts.reduce((a, b) => a + b, 0)),
      this.prisma.invitation.count({ where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);

    return {
      pending: {
        neverLoggedIn,
        inactive30,
        unusedRoles: roles.filter((r) => r._count.tenantAccessUsers === 0 && r._count.publicLinks === 0).length,
        failedRuns7d: failed,
        pendingInvites: invites,
      },
      activity: this.canSeeActivity(currentUser) ? await this.recentActivity(tenantId) : null,
    };
  }

  private canSeeActivity(currentUser: CurrentUser): boolean {
    const mp = currentUser.customRole?.modulePermissions as Record<string, { canRead?: boolean }> | undefined;
    return hasFullTenantAccess(mp) || mp?.logs?.canRead === true;
  }

  private async recentActivity(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      select: { id: true, action: true, resource: true, userId: true, impersonatedByName: true, createdAt: true, newData: true, oldData: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const ids = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    // Nome do item afetado ("Editou tabela Cliente"), sem mandar os dados inteiros para a tela
    const itemName = (o: unknown): string | null => {
      if (!o || typeof o !== 'object') return null;
      const r = o as Record<string, unknown>;
      for (const k of ['name', 'title', 'nome', 'titulo', 'numero']) if (typeof r[k] === 'string' && r[k]) return String(r[k]).slice(0, 60);
      if (r.data && typeof r.data === 'object') {
        const first = Object.values(r.data as Record<string, unknown>).find((v) => typeof v === 'string' && v.length > 0 && v.length < 60);
        if (first) return String(first);
      }
      return null;
    };
    return logs.map(({ userId, newData, oldData, ...log }) => ({
      ...log,
      itemName: itemName(newData) ?? itemName(oldData),
      userName: userId ? names.get(userId) ?? null : null,
    }));
  }
}
