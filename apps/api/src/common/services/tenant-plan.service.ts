import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantLifecycle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FeatureKey,
  LimitKey,
  PlanLimits,
  TenantFeatures,
  getEffectiveFeatures,
  getPlanLimits,
} from '../utils/plan-features';

export interface TenantPlanInfo {
  tenantId: string;
  lifecycle: TenantLifecycle;
  trialEndsAt: Date | null;
  plan: { id: string; name: string; slug: string } | null;
  features: TenantFeatures;
  limits: PlanLimits;
}

export function bytesToKb(bytes: number): number {
  return Math.ceil(bytes / 1024);
}

export function kbToMb(kb: number): number {
  return Math.round((kb / 1024) * 10) / 10;
}

// Cache curto em memoria: o interceptor de funcoes roda em toda request.
// Mudancas feitas pelo console chamam invalidate(); em outras instancias o
// valor antigo vale no maximo CACHE_TTL_MS.
const CACHE_TTL_MS = 30_000;

@Injectable()
export class TenantPlanService {
  private cache = new Map<string, { value: TenantPlanInfo; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async getInfo(tenantId: string): Promise<TenantPlanInfo | null> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        lifecycle: true,
        trialEndsAt: true,
        featureOverrides: true,
        plan: { select: { id: true, name: true, slug: true, features: true, limits: true } },
      },
    });
    if (!tenant) return null;

    const value: TenantPlanInfo = {
      tenantId: tenant.id,
      lifecycle: tenant.lifecycle,
      trialEndsAt: tenant.trialEndsAt,
      plan: tenant.plan ? { id: tenant.plan.id, name: tenant.plan.name, slug: tenant.plan.slug } : null,
      features: getEffectiveFeatures(tenant.plan?.features, tenant.featureOverrides),
      limits: getPlanLimits(tenant.plan?.limits),
    };
    this.cache.set(tenantId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  invalidate(tenantId?: string): void {
    if (tenantId) this.cache.delete(tenantId);
    else this.cache.clear();
  }

  async isFeatureEnabled(tenantId: string, feature: FeatureKey): Promise<boolean> {
    const info = await this.getInfo(tenantId);
    return info ? info.features[feature] : true;
  }

  async getUsage(tenantId: string): Promise<Record<LimitKey, number>> {
    const [maxUsers, maxRecords, storageKb] = await Promise.all([
      this.countUsers(tenantId),
      this.countRecords(tenantId),
      this.storageKb(tenantId),
    ]);
    return { maxUsers, maxRecords, maxStorageMb: kbToMb(storageKb) };
  }

  /** Lanca 403 PLAN_LIMIT se adicionar `adding` usuarios estourar o plano. */
  async assertCanAddUsers(tenantId: string, adding = 1): Promise<void> {
    const info = await this.getInfo(tenantId);
    const limit = info?.limits.maxUsers;
    if (limit == null) return;
    const current = await this.countUsers(tenantId);
    if (current + adding > limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        limit: 'maxUsers',
        message: `Limite de usuarios do plano atingido (${limit})`,
      });
    }
  }

  /** Lanca 403 PLAN_LIMIT se adicionar `adding` registros estourar o plano. */
  async assertCanAddRecords(tenantId: string, adding = 1): Promise<void> {
    const info = await this.getInfo(tenantId);
    const limit = info?.limits.maxRecords;
    if (limit == null) return;
    const current = await this.countRecords(tenantId);
    if (current + adding > limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        limit: 'maxRecords',
        message: `Limite de registros do plano atingido (${limit})`,
      });
    }
  }

  /** Lanca 403 PLAN_LIMIT se gravar `bytes` a mais estourar o armazenamento do plano. */
  async assertCanAddStorage(tenantId: string, bytes: number): Promise<void> {
    const info = await this.getInfo(tenantId);
    const limitMb = info?.limits.maxStorageMb;
    if (limitMb == null) return;
    const currentKb = await this.storageKb(tenantId);
    if (currentKb + bytesToKb(bytes) > limitMb * 1024) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        limit: 'maxStorageMb',
        message: `Limite de armazenamento do plano atingido (${limitMb} MB)`,
      });
    }
  }

  /** Soma (bytes > 0) ou subtrai (bytes < 0) do armazenamento usado, sem ficar negativo. */
  async addStorage(tenantId: string, bytes: number): Promise<void> {
    const deltaKb = Math.sign(bytes) * bytesToKb(Math.abs(bytes));
    if (deltaKb === 0) return;
    await this.prisma.$executeRaw`
      UPDATE "Tenant" SET "storageUsedKb" = GREATEST(0, "storageUsedKb" + ${deltaKb})
      WHERE id = ${tenantId}`;
  }

  async setStorageBytes(tenantId: string, bytes: number): Promise<void> {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { storageUsedKb: bytesToKb(bytes) } });
  }

  private async storageKb(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { storageUsedKb: true } });
    return tenant?.storageUsedKb ?? 0;
  }

  // Usuarios de formularios publicos (cargo de um PublicLink) nao ocupam vaga do plano:
  // sao pessoas de fora preenchendo formulario, nao a equipe da empresa.
  private countUsers(tenantId: string): Promise<number> {
    return this.prisma.userTenantAccess.count({
      where: { tenantId, status: 'ACTIVE', deletedAt: null, customRole: { publicLinks: { none: {} } }, user: { isServiceAccount: false } },
    });
  }

  private countRecords(tenantId: string): Promise<number> {
    return this.prisma.entityData.count({ where: { tenantId, deletedAt: null } });
  }
}
