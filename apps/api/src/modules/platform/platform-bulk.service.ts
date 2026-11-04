import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantLifecycle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { platformPermissionsFor, type PlatformPermission, type PlatformStaffPrincipal } from './platform-permissions';

export const BULK_ACTIONS = ['plan', 'trial', 'lifecycle'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BULK_MAX = 500;

export interface BulkInput {
  action: BulkAction;
  /** Empresas escolhidas na lista... */
  tenantIds?: string[];
  /** ...ou todas as de um plano ('none' = sem plano). */
  fromPlanId?: string;
  planId?: string | null;
  days?: number;
  lifecycle?: TenantLifecycle;
  trialEndsAt?: string;
  dryRun?: boolean;
}

const PERMISSION: Record<BulkAction, PlatformPermission> = {
  plan: 'tenants.plan',
  trial: 'tenants.lifecycle',
  lifecycle: 'tenants.lifecycle',
};

export interface BulkItem { id: string; name: string; from: string | null; to: string | null }

/**
 * Acoes em massa do console (trocar plano, prorrogar teste, mudar situacao).
 * Primeiro a previa (dryRun: o que muda e o que fica de fora), depois a execucao,
 * empresa a empresa pelas MESMAS operacoes individuais (mesmas regras, auditoria e
 * historico de situacao). Uma empresa que falha nao interrompe as outras.
 */
@Injectable()
export class PlatformBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: PlatformTenantsService,
  ) {}

  async run(actor: PlatformStaffPrincipal, input: BulkInput) {
    if (!platformPermissionsFor(actor.role).includes(PERMISSION[input.action])) {
      throw new ForbiddenException('Sem permissao para esta acao');
    }
    if (!input.tenantIds?.length && !input.fromPlanId) throw new BadRequestException('Escolha as empresas');

    const targets = await this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(input.tenantIds?.length ? { id: { in: input.tenantIds } } : {}),
        ...(input.fromPlanId ? { planId: input.fromPlanId === 'none' ? null : input.fromPlanId } : {}),
      },
      select: { id: true, name: true, planId: true, lifecycle: true, trialEndsAt: true, plan: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: BULK_MAX + 1,
    });
    if (targets.length > BULK_MAX) throw new BadRequestException(`No maximo ${BULK_MAX} empresas por vez`);

    const plans = new Map((await this.prisma.plan.findMany({ select: { id: true, name: true, isActive: true } })).map((p) => [p.id, p]));
    if (input.action === 'plan' && input.planId) {
      const plan = plans.get(input.planId);
      if (!plan) throw new BadRequestException('Plano nao encontrado');
      if (!plan.isActive) throw new BadRequestException('Plano inativo');
    }
    if (input.action === 'trial' && !(Number.isInteger(input.days) && input.days! >= 1 && input.days! <= 365)) {
      throw new BadRequestException('Informe de 1 a 365 dias');
    }
    if (input.action === 'lifecycle' && !input.lifecycle) throw new BadRequestException('Escolha a situacao');

    const change: BulkItem[] = [];
    const skipped: Array<BulkItem & { reason: string }> = [];
    for (const t of targets) {
      if (input.action === 'plan') {
        const to = input.planId ?? null;
        const item = { id: t.id, name: t.name, from: t.plan?.name ?? null, to: to ? plans.get(to)!.name : null };
        if (t.planId === to) skipped.push({ ...item, reason: 'same_plan' });
        else change.push(item);
      } else if (input.action === 'trial') {
        const item = { id: t.id, name: t.name, from: t.trialEndsAt?.toISOString() ?? null, to: null };
        if (t.lifecycle !== 'TRIAL') skipped.push({ ...item, reason: 'not_trial' });
        else {
          const base = t.trialEndsAt && t.trialEndsAt > new Date() ? t.trialEndsAt : new Date();
          change.push({ ...item, to: new Date(base.getTime() + input.days! * 86_400_000).toISOString() });
        }
      } else {
        const item = { id: t.id, name: t.name, from: t.lifecycle, to: input.lifecycle! };
        if (t.lifecycle === input.lifecycle) skipped.push({ ...item, reason: 'same_lifecycle' });
        else change.push(item);
      }
    }

    if (input.dryRun) return { dryRun: true, total: targets.length, change, skipped, failed: [] };

    const done: BulkItem[] = [];
    const failed: Array<BulkItem & { reason: string }> = [];
    for (const item of change) {
      try {
        if (input.action === 'plan') await this.tenants.setPlan(actor, item.id, input.planId ?? null);
        else if (input.action === 'trial') await this.tenants.extendTrial(actor, item.id, input.days!);
        else await this.tenants.setLifecycle(actor, item.id, { lifecycle: input.lifecycle!, trialEndsAt: input.trialEndsAt });
        done.push(item);
      } catch (e) {
        failed.push({ ...item, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    return { dryRun: false, total: targets.length, change: done, skipped, failed };
  }
}
