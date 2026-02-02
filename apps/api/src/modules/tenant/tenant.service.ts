import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, QueryTenantDto } from './dto/tenant.dto';
import { UserRole, Status, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    // Verificar se slug já existe
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Slug já está em uso');
    }

    // Criar tenant com admin e organização padrão
    const tenant = await this.prisma.$transaction(async (tx) => {
      // 1. Criar tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          domain: dto.domain,
          logo: dto.logo,
          plan: dto.plan,
        },
      });

      // 2. Criar organização padrão
      const org = await tx.organization.create({
        data: {
          tenantId: tenant.id,
          name: 'Principal',
          slug: 'principal',
        },
      });

      // 3. Criar usuário admin
      const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          organizationId: org.id,
          email: dto.adminEmail,
          password: hashedPassword,
          name: dto.adminName,
          role: UserRole.ADMIN,
          status: Status.ACTIVE,
        },
      });

      return tenant;
    });

    return tenant;
  }

  async findAll(query: QueryTenantDto) {
    const { page = 1, limit = 20, search, plan, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};

    if (plan) where.plan = plan;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              organizations: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        organizations: true,
        _count: {
          select: {
            users: true,
            organizations: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  async suspend(id: string) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: { status: Status.SUSPENDED },
    });
  }

  async activate(id: string) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: { status: Status.ACTIVE },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.tenant.delete({ where: { id } });

    return { message: 'Tenant excluído com sucesso' };
  }

  async getStats() {
    const [total, active, byPlan] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: Status.ACTIVE } }),
      this.prisma.tenant.groupBy({
        by: ['plan'],
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      byPlan: byPlan.reduce((acc, item) => {
        acc[item.plan] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
