import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, QueryTenantDto } from './dto/tenant.dto';
import { Status, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Removido: Nao criar roles de sistema automaticamente.
// Apenas PLATFORM_ADMIN é hardcoded (criado no seed para o Platform tenant).
// Todos os outros roles devem ser criados manualmente via interface.

@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async create(dto: CreateTenantDto) {
    // Verificar se slug ja existe
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(this.i18n.t('tenant.slugAlreadyExists'));
    }

    // Criar apenas o tenant (sem roles automaticas)
    const tenant = await this.prisma.$transaction(async (tx) => {
      // 1. Criar tenant
      const createdTenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          domain: dto.domain,
          logo: dto.logo,
        },
      });

      // 2. Se informou dados de admin, criar usuario (mas sem role ainda)
      // IMPORTANTE: PLATFORM_ADMIN precisa criar um role customizado primeiro
      // e depois atribuir ao usuario via PATCH /users/:id
      if (dto.adminEmail && dto.adminPassword && dto.adminName) {
        const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);

        // Criar um role temporário "Admin Inicial" para o primeiro usuário
        const initialRole = await tx.customRole.create({
          data: {
            tenantId: createdTenant.id,
            name: this.i18n.t('tenant.initialRoleName'),
            description: this.i18n.t('tenant.initialRoleDescription'),
            color: '#7c3aed',
            roleType: 'CUSTOM',
            isSystem: false,
            modulePermissions: {
              dashboard: { canRead: true },
            },
            permissions: [],
          },
        });

        await tx.user.create({
          data: {
            tenantId: createdTenant.id,
            email: dto.adminEmail,
            password: hashedPassword,
            name: dto.adminName,
            customRoleId: initialRole.id,
            status: Status.ACTIVE,
          },
        });
      }

      return createdTenant;
    });

    return tenant;
  }

  async findAll(query: QueryTenantDto) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};

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
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(this.i18n.t('tenant.notFound'));
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

    return { message: this.i18n.t('tenant.deletedSuccessfully') };
  }

  async getStats() {
    const [total, active, suspended] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: Status.ACTIVE } }),
      this.prisma.tenant.count({ where: { status: Status.SUSPENDED } }),
    ]);

    return {
      total,
      active,
      suspended,
    };
  }
}
