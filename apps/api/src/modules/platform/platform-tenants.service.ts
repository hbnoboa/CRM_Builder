import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Status, TenantLifecycle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPlanService, kbToMb } from '../../common/services/tenant-plan.service';
import { UploadService } from '../upload/upload.service';
import { FEATURE_KEYS, getPlanLimits, isFeatureKey } from '../../common/utils/plan-features';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { TenantService } from '../tenant/tenant.service';
import { AuthService } from '../auth/auth.service';
import {
  PlatformCreateTenantDto,
  PlatformQueryTenantsDto,
  PlatformTenantFeaturesDto,
  PlatformTenantLifecycleDto,
  PlatformUpdateTenantDto,
} from './dto/platform.dto';
import { PlatformAuditService } from './platform-audit.service';
import type { PlatformStaffPrincipal } from './platform-permissions';

// Ciclo de vida comercial -> status que de fato libera/bloqueia o acesso.
// PAST_DUE (inadimplente) ainda acessa: e o periodo de tolerancia.
const STATUS_FOR_LIFECYCLE: Record<TenantLifecycle, Status> = {
  TRIAL: Status.ACTIVE,
  ACTIVE: Status.ACTIVE,
  PAST_DUE: Status.ACTIVE,
  SUSPENDED: Status.SUSPENDED,
  CANCELED: Status.INACTIVE,
};

@Injectable()
export class PlatformTenantsService {
  private readonly logger = new Logger(PlatformTenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly tenantPlan: TenantPlanService,
    private readonly authService: AuthService,
    private readonly audit: PlatformAuditService,
    private readonly uploadService: UploadService,
  ) {}

  // ── Leitura ─────────────────────────────────────────────────────────────

  async overview() {
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [byLifecycle, users, trialsEnding, recentSignups] = await Promise.all([
      this.prisma.tenant.groupBy({
        by: ['lifecycle'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.userTenantAccess.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.tenant.findMany({
        where: { deletedAt: null, lifecycle: 'TRIAL', trialEndsAt: { lte: soon } },
        select: { id: true, name: true, slug: true, trialEndsAt: true },
        orderBy: { trialEndsAt: 'asc' },
        take: 10,
      }),
      this.prisma.tenant.findMany({
        where: { deletedAt: null, createdAt: { gte: monthAgo } },
        select: { id: true, name: true, slug: true, lifecycle: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const counts = Object.fromEntries(
      Object.values(TenantLifecycle).map((l) => [l, 0]),
    ) as Record<TenantLifecycle, number>;
    for (const row of byLifecycle) counts[row.lifecycle] = row._count._all;

    return {
      tenants: {
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        byLifecycle: counts,
      },
      activeMemberships: users,
      trialsEnding,
      recentSignups,
    };
  }

  async findAll(query: PlatformQueryTenantsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(100, query.limit ?? 20);
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      ...(query.lifecycle ? { lifecycle: query.lifecycle } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          lifecycle: true,
          trialEndsAt: true,
          createdAt: true,
          storageUsedKb: true,
          plan: { select: { id: true, name: true, limits: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const usage = await this.usageFor(tenants.map((t) => t.id));
    const data = tenants.map(({ storageUsedKb, ...t }) => ({
      ...t,
      plan: t.plan ? { id: t.plan.id, name: t.plan.name } : null,
      limits: getPlanLimits(t.plan?.limits),
      usage: { ...(usage.get(t.id) ?? { users: 0, records: 0, lastLoginAt: null }), storageMb: kbToMb(storageUsedKb) },
    }));

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logo: true,
        status: true,
        lifecycle: true,
        trialEndsAt: true,
        featureOverrides: true,
        storageUsedKb: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, slug: true, features: true, limits: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant nao encontrado');
    const { storageUsedKb, ...tenantData } = tenant;

    this.tenantPlan.invalidate(id);
    const [info, usage, entities] = await Promise.all([
      this.tenantPlan.getInfo(id),
      this.usageFor([id]),
      this.prisma.entity.count({ where: { tenantId: id, deletedAt: null } }),
    ]);

    return {
      ...tenantData,
      features: info?.features,
      limits: info?.limits,
      usage: {
        ...(usage.get(id) ?? { users: 0, records: 0, lastLoginAt: null }),
        entities,
        storageMb: kbToMb(storageUsedKb),
      },
    };
  }

  async findMembers(tenantId: string) {
    await this.assertExists(tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { ownerId: true } });
    const members = await this.prisma.userTenantAccess.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        status: true,
        isPrimary: true,
        user: { select: { id: true, name: true, email: true, status: true, lastLoginAt: true } },
        customRole: { select: { id: true, name: true, rank: true, modulePermissions: true } },
      },
      orderBy: [{ customRole: { rank: 'asc' } }, { user: { name: 'asc' } }],
    });
    return members.map(({ customRole: { modulePermissions, ...role }, ...m }) => ({
      ...m.user,
      membershipStatus: m.status,
      isPrimary: m.isPrimary,
      isOwner: m.user.id === tenant?.ownerId,
      role: { ...role, fullAccess: hasFullTenantAccess(modulePermissions) },
    }));
  }

  // ── Escrita ─────────────────────────────────────────────────────────────

  async create(actor: PlatformStaffPrincipal, dto: PlatformCreateTenantDto) {
    if (dto.planId) await this.assertPlan(dto.planId);
    if (await this.prisma.user.findUnique({ where: { email: dto.adminEmail } })) {
      throw new BadRequestException('Email do administrador ja esta em uso');
    }
    const lifecycle = dto.lifecycle ?? TenantLifecycle.ACTIVE;
    const trialEndsAt = this.resolveTrialEnd(lifecycle, dto.trialEndsAt);

    const tenant = await this.tenantService.create(
      {
        name: dto.name,
        slug: dto.slug,
        adminName: dto.adminName,
        adminEmail: dto.adminEmail,
        adminPassword: dto.adminPassword,
      },
      { planId: dto.planId ?? null, lifecycle, trialEndsAt },
    );
    if (STATUS_FOR_LIFECYCLE[lifecycle] !== Status.ACTIVE) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: STATUS_FOR_LIFECYCLE[lifecycle] },
      });
    }

    await this.audit.log(actor, {
      action: 'tenant.created',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: { name: dto.name, slug: dto.slug, planId: dto.planId, lifecycle, adminEmail: dto.adminEmail },
    });
    return tenant;
  }

  async update(actor: PlatformStaffPrincipal, id: string, dto: PlatformUpdateTenantDto) {
    await this.assertExists(id);
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.domain !== undefined ? { domain: dto.domain || null } : {}),
      },
    });
    await this.audit.log(actor, {
      action: 'tenant.updated',
      targetType: 'tenant',
      targetId: id,
      tenantId: id,
      metadata: { ...dto },
    });
    return tenant;
  }

  async setLifecycle(actor: PlatformStaffPrincipal, id: string, dto: PlatformTenantLifecycleDto) {
    const current = await this.assertExists(id);
    const trialEndsAt = this.resolveTrialEnd(dto.lifecycle, dto.trialEndsAt, current.trialEndsAt);

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        lifecycle: dto.lifecycle,
        status: STATUS_FOR_LIFECYCLE[dto.lifecycle],
        trialEndsAt: dto.lifecycle === 'TRIAL' ? trialEndsAt : current.trialEndsAt,
      },
    });
    this.tenantPlan.invalidate(id);
    await this.audit.log(actor, {
      action: 'tenant.lifecycle_changed',
      targetType: 'tenant',
      targetId: id,
      tenantId: id,
      metadata: { from: current.lifecycle, to: dto.lifecycle, trialEndsAt },
    });
    return tenant;
  }

  async setPlan(actor: PlatformStaffPrincipal, id: string, planId: string | null) {
    const current = await this.assertExists(id);
    if (planId) await this.assertPlan(planId);

    const tenant = await this.prisma.tenant.update({ where: { id }, data: { planId } });
    this.tenantPlan.invalidate(id);
    await this.audit.log(actor, {
      action: 'tenant.plan_changed',
      targetType: 'tenant',
      targetId: id,
      tenantId: id,
      metadata: { from: current.planId, to: planId },
    });
    return tenant;
  }

  async setFeatures(actor: PlatformStaffPrincipal, id: string, dto: PlatformTenantFeaturesDto) {
    const current = await this.assertExists(id);
    const next: Record<string, boolean> = {
      ...((current.featureOverrides as Record<string, boolean> | null) ?? {}),
    };
    for (const [key, value] of Object.entries(dto.overrides)) {
      if (!isFeatureKey(key)) {
        throw new BadRequestException(`Funcao desconhecida: ${key}. Validas: ${FEATURE_KEYS.join(', ')}`);
      }
      if (value === null) delete next[key];
      else if (typeof value === 'boolean') next[key] = value;
      else throw new BadRequestException(`Valor invalido para ${key}: use true, false ou null`);
    }

    await this.prisma.tenant.update({ where: { id }, data: { featureOverrides: next } });
    this.tenantPlan.invalidate(id);
    await this.audit.log(actor, {
      action: 'tenant.features_changed',
      targetType: 'tenant',
      targetId: id,
      tenantId: id,
      metadata: { from: current.featureOverrides, to: next },
    });
    return this.tenantPlan.getInfo(id);
  }

  /**
   * Gera uma sessao do usuario do tenant para a equipe dar suporte. O token
   * carrega impersonatedBy (o staff): a auditoria do tenant registra quem
   * realmente agiu e o web-admin mostra o banner de impersonacao.
   */
  async impersonate(actor: PlatformStaffPrincipal, tenantId: string, userId: string, ip?: string) {
    const tenant = await this.assertExists(tenantId);
    if (tenant.status !== Status.ACTIVE) {
      throw new BadRequestException('Tenant suspenso ou cancelado: reative antes de entrar como usuario');
    }

    const membership = await this.prisma.userTenantAccess.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true, status: true, deletedAt: true } },
        customRole: true,
        tenant: { select: { id: true, name: true, slug: true, status: true, settings: true } },
      },
    });
    const usable =
      membership &&
      !membership.deletedAt &&
      membership.status === 'ACTIVE' &&
      (!membership.expiresAt || membership.expiresAt > new Date()) &&
      membership.user.status === 'ACTIVE' &&
      !membership.user.deletedAt;
    if (!usable) throw new NotFoundException('Usuario sem acesso ativo a este tenant');

    const impersonatedBy = { id: actor.id, name: `${actor.name} (equipe)` };
    const tokens = await this.authService.generateTokensForUser(
      {
        id: membership.user.id,
        email: membership.user.email,
        tenantId,
        customRoleId: membership.customRoleId,
      },
      false,
      impersonatedBy,
    );

    await this.audit.log(actor, {
      action: 'tenant.impersonated',
      targetType: 'user',
      targetId: userId,
      tenantId,
      ip,
      metadata: { email: membership.user.email },
    });
    this.logger.log(`Impersonacao pela equipe: ${actor.email} -> ${membership.user.email}`);

    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        avatar: membership.user.avatar,
        tenantId,
        tenant: membership.tenant,
        customRoleId: membership.customRoleId,
        customRole: membership.customRole,
      },
      impersonatedBy,
      ...tokens,
    };
  }

  /** Recalcula o armazenamento usado a partir dos arquivos reais do tenant. */
  async recomputeStorage(actor: PlatformStaffPrincipal, id: string) {
    await this.assertExists(id);
    const before = (await this.tenantPlan.getUsage(id)).maxStorageMb;
    const bytes = await this.uploadService.recomputeTenantStorage(id);
    const storageMb = kbToMb(Math.ceil(bytes / 1024));
    await this.audit.log(actor, {
      action: 'tenant.storage_recomputed',
      targetType: 'tenant',
      targetId: id,
      tenantId: id,
      metadata: { beforeMb: before, afterMb: storageMb },
    });
    return { storageMb };
  }

  // ── Trial ───────────────────────────────────────────────────────────────

  /** Trial vencido -> suspenso (bloqueia o acesso). Roda todo dia as 04:30. */
  @Cron('30 4 * * *')
  async expireTrials() {
    const expired = await this.prisma.tenant.findMany({
      where: { deletedAt: null, lifecycle: 'TRIAL', trialEndsAt: { lt: new Date() } },
      select: { id: true, slug: true },
    });
    if (expired.length === 0) return;

    await this.prisma.tenant.updateMany({
      where: { id: { in: expired.map((t) => t.id) } },
      data: { lifecycle: 'SUSPENDED', status: Status.SUSPENDED },
    });
    for (const t of expired) this.tenantPlan.invalidate(t.id);
    this.logger.log(`Trials vencidos suspensos: ${expired.map((t) => t.slug).join(', ')}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async usageFor(tenantIds: string[]) {
    const result = new Map<string, { users: number; records: number; lastLoginAt: Date | null }>();
    if (tenantIds.length === 0) return result;

    const [records, members] = await Promise.all([
      this.prisma.entityData.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ tenantId: string; users: bigint; lastLoginAt: Date | null }>>`
        SELECT uta."tenantId", COUNT(*) AS users, MAX(u."lastLoginAt") AS "lastLoginAt"
        FROM "UserTenantAccess" uta
        JOIN "User" u ON u.id = uta."userId"
        WHERE uta."tenantId" = ANY(${tenantIds})
          AND uta."deletedAt" IS NULL
          AND uta.status = 'ACTIVE'
          -- usuarios de formulario publico nao ocupam vaga (mesma regra do TenantPlanService)
          AND NOT EXISTS (SELECT 1 FROM "PublicLink" pl WHERE pl."customRoleId" = uta."customRoleId")
        GROUP BY uta."tenantId"`,
    ]);

    for (const id of tenantIds) result.set(id, { users: 0, records: 0, lastLoginAt: null });
    for (const r of records) result.get(r.tenantId)!.records = r._count._all;
    for (const m of members) {
      const row = result.get(m.tenantId)!;
      row.users = Number(m.users);
      row.lastLoginAt = m.lastLoginAt;
    }
    return result;
  }

  private resolveTrialEnd(lifecycle: TenantLifecycle, input?: string, current?: Date | null): Date | null {
    if (lifecycle !== 'TRIAL') return null;
    if (input) {
      const date = new Date(input);
      if (date <= new Date()) throw new BadRequestException('Fim do trial precisa ser no futuro');
      return date;
    }
    if (current && current > new Date()) return current;
    throw new BadRequestException('Informe a data de fim do trial');
  }

  private async assertExists(id: string) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!tenant) throw new NotFoundException('Tenant nao encontrado');
    return tenant;
  }

  private async assertPlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plano nao encontrado');
    if (!plan.isActive) throw new BadRequestException('Plano inativo');
    return plan;
  }
}
