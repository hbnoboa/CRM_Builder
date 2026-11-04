import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';

const MEMBER_SELECT = {
  isLeader: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

/**
 * Equipes/departamentos da empresa. Quem participa de uma equipe e cujo cargo tem
 * escopo 'team' numa tabela ve os registros criados pelos colegas. As chaves de
 * visibilidade do celular sao mantidas por triggers (TeamMember/UserTenantAccess).
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    const teams = await this.prisma.team.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, description: true, color: true, createdAt: true,
        members: { select: MEMBER_SELECT, orderBy: [{ isLeader: 'desc' }, { user: { name: 'asc' } }] },
      },
    });
    return teams.map((t) => ({
      ...t,
      members: t.members.map((m) => ({ ...m.user, isLeader: m.isLeader })),
    }));
  }

  private async findOwn(tenantId: string, id: string) {
    const team = await this.prisma.team.findFirst({ where: { id, tenantId } });
    if (!team) throw new NotFoundException('Equipe nao encontrada');
    return team;
  }

  async create(user: CurrentUser, dto: { name: string; description?: string; color?: string }) {
    try {
      const team = await this.prisma.team.create({
        data: { tenantId: user.tenantId, name: dto.name.trim(), description: dto.description?.trim() || null, color: dto.color || null },
      });
      this.audit.log(user, { action: 'create', resource: 'team', resourceId: team.id, newData: { name: team.name } }).catch(() => {});
      return team;
    } catch (e) {
      throw this.nameConflict(e);
    }
  }

  async update(user: CurrentUser, id: string, dto: { name?: string; description?: string | null; color?: string | null }) {
    const before = await this.findOwn(user.tenantId, id);
    try {
      const team = await this.prisma.team.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.color !== undefined ? { color: dto.color || null } : {}),
        },
      });
      this.audit.log(user, { action: 'update', resource: 'team', resourceId: id, oldData: { name: before.name }, newData: { name: team.name } }).catch(() => {});
      return team;
    } catch (e) {
      throw this.nameConflict(e);
    }
  }

  async remove(user: CurrentUser, id: string) {
    const team = await this.findOwn(user.tenantId, id);
    await this.prisma.team.delete({ where: { id } });
    this.audit.log(user, { action: 'delete', resource: 'team', resourceId: id, oldData: { name: team.name } }).catch(() => {});
    return { success: true };
  }

  /** Define a lista completa de membros (e quem lidera). So pessoas ativas da empresa. */
  async setMembers(user: CurrentUser, id: string, members: Array<{ userId: string; isLeader?: boolean }>) {
    await this.findOwn(user.tenantId, id);
    const wanted = new Map(members.map((m) => [m.userId, !!m.isLeader]));
    if (wanted.size > 0) {
      const valid = await this.prisma.userTenantAccess.findMany({
        where: {
          tenantId: user.tenantId, userId: { in: [...wanted.keys()] }, deletedAt: null, status: Status.ACTIVE,
          user: { isServiceAccount: false, deletedAt: null },
        },
        select: { userId: true },
      });
      const ok = new Set(valid.map((v) => v.userId));
      const invalid = [...wanted.keys()].filter((uid) => !ok.has(uid));
      if (invalid.length) throw new BadRequestException('Alguem da lista nao faz parte da empresa');
    }

    const current = await this.prisma.teamMember.findMany({ where: { teamId: id }, select: { userId: true, isLeader: true } });
    const currentMap = new Map(current.map((c) => [c.userId, c.isLeader]));
    const toRemove = current.filter((c) => !wanted.has(c.userId)).map((c) => c.userId);
    const toAdd = [...wanted.entries()].filter(([uid]) => !currentMap.has(uid));
    const toFlag = [...wanted.entries()].filter(([uid, lead]) => currentMap.has(uid) && currentMap.get(uid) !== lead);

    await this.prisma.$transaction([
      this.prisma.teamMember.deleteMany({ where: { teamId: id, userId: { in: toRemove } } }),
      ...toAdd.map(([userId, isLeader]) => this.prisma.teamMember.create({ data: { teamId: id, userId, isLeader } })),
      ...toFlag.map(([userId, isLeader]) => this.prisma.teamMember.update({ where: { teamId_userId: { teamId: id, userId } }, data: { isLeader } })),
    ]);
    this.audit.log(user, {
      action: 'update', resource: 'team', resourceId: id,
      metadata: { added: toAdd.map(([u]) => u), removed: toRemove, leaders: [...wanted.entries()].filter(([, l]) => l).map(([u]) => u) },
    }).catch(() => {});
    return (await this.list(user.tenantId)).find((t) => t.id === id);
  }

  private nameConflict(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Ja existe uma equipe com esse nome');
    }
    return e;
  }
}
