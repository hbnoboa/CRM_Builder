import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser as CurrentUserType } from '../../common/types';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Visao do PROPRIO tenant sobre o plano: o que esta ligado, limites, uso e
 * situacao do trial. Usado pelo web-admin (pagina de assinatura, banner de
 * trial, menus por funcao e onboarding). Compartilhado entre os scopes.
 */
@ApiTags('Subscription')
@Controller('subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(
    private readonly tenantPlan: TenantPlanService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Plano, funcoes, limites, uso e trial do tenant atual' })
  async get(@CurrentUser() user: CurrentUserType) {
    const info = await this.tenantPlan.getInfo(user.tenantId);
    if (!info) throw new NotFoundException('Tenant nao encontrado');

    const [usage, entities] = await Promise.all([
      this.tenantPlan.getUsage(user.tenantId),
      this.prisma.entity.count({ where: { tenantId: user.tenantId, deletedAt: null } }),
    ]);

    const trialDaysLeft =
      info.lifecycle === 'TRIAL' && info.trialEndsAt
        ? Math.max(0, Math.ceil((info.trialEndsAt.getTime() - Date.now()) / 86_400_000))
        : null;

    return {
      lifecycle: info.lifecycle,
      trialEndsAt: info.trialEndsAt,
      trialDaysLeft,
      plan: info.plan,
      features: info.features,
      limits: info.limits,
      usage: { users: usage.maxUsers, records: usage.maxRecords, entities },
    };
  }
}
