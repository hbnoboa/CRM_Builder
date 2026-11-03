import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { sanitizeFeatures, sanitizeLimits } from '../../common/utils/plan-features';
import { CreatePlanDto, UpdatePlanDto } from './dto/platform.dto';
import { PlatformAuditService } from './platform-audit.service';
import type { PlatformStaffPrincipal } from './platform-permissions';

@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPlan: TenantPlanService,
    private readonly audit: PlatformAuditService,
  ) {}

  findAll() {
    return this.prisma.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tenants: { where: { deletedAt: null } } } } },
    });
  }

  async create(actor: PlatformStaffPrincipal, dto: CreatePlanDto) {
    if (await this.prisma.plan.findUnique({ where: { slug: dto.slug } })) {
      throw new ConflictException('Ja existe um plano com esse slug');
    }
    const plan = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.plan.updateMany({ data: { isDefault: false } });
      return tx.plan.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          limits: sanitizeLimits(dto.limits) as Prisma.InputJsonValue,
          features: sanitizeFeatures(dto.features) as Prisma.InputJsonValue,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    });
    await this.audit.log(actor, { action: 'plan.created', targetType: 'plan', targetId: plan.id, metadata: { ...dto } });
    return plan;
  }

  async update(actor: PlatformStaffPrincipal, id: string, dto: UpdatePlanDto) {
    const current = await this.prisma.plan.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Plano nao encontrado');
    if (dto.isActive === false && (dto.isDefault ?? current.isDefault)) {
      throw new BadRequestException('O plano padrao do cadastro nao pode ficar inativo');
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.plan.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      return tx.plan.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.limits !== undefined ? { limits: sanitizeLimits(dto.limits) as Prisma.InputJsonValue } : {}),
          ...(dto.features !== undefined
            ? { features: sanitizeFeatures(dto.features) as Prisma.InputJsonValue }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    });

    // Limites/funcoes do plano mudam o efetivo de todos os tenants dele.
    this.tenantPlan.invalidate();
    await this.audit.log(actor, {
      action: 'plan.updated',
      targetType: 'plan',
      targetId: id,
      metadata: { before: { limits: current.limits, features: current.features }, changes: { ...dto } },
    });
    return plan;
  }
}
