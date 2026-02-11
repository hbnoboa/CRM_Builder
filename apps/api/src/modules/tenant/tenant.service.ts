import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, QueryTenantDto } from './dto/tenant.dto';
import { Status, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Configuracao das roles de sistema que serao criadas por tenant
interface SystemRoleConfig {
  name: string;
  description: string;
  color: string;
  roleType: string;
  isSystem: boolean;
  isDefault?: boolean;
  modulePermissions: Record<string, boolean>;
}

const SYSTEM_ROLES: Record<string, SystemRoleConfig> = {
  ADMIN: {
    name: 'Administrador',
    description: 'Administrador do tenant com acesso completo',
    color: '#7c3aed',
    roleType: 'ADMIN',
    isSystem: true,
    modulePermissions: { dashboard: true, users: true, settings: true, apis: true, pages: true, entities: true },
  },
  MANAGER: {
    name: 'Gerente',
    description: 'Gerente com acesso a dados e equipe',
    color: '#2563eb',
    roleType: 'MANAGER',
    isSystem: true,
    modulePermissions: { dashboard: true, users: true, settings: false, apis: false, pages: false, entities: false },
  },
  USER: {
    name: 'Usuario',
    description: 'Usuario padrao com acesso a dados proprios',
    color: '#059669',
    roleType: 'USER',
    isSystem: true,
    isDefault: true,
    modulePermissions: { dashboard: true, users: false, settings: false, apis: false, pages: false, entities: true },
  },
  VIEWER: {
    name: 'Visualizador',
    description: 'Apenas visualizacao de dados',
    color: '#6b7280',
    roleType: 'VIEWER',
    isSystem: true,
    modulePermissions: { dashboard: true, users: false, settings: false, apis: false, pages: false, entities: false },
  },
};

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    // Verificar se slug ja existe
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Slug ja esta em uso');
    }

    // Criar tenant com roles de sistema e admin
    const tenant = await this.prisma.$transaction(async (tx) => {
      // 1. Criar tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          domain: dto.domain,
          logo: dto.logo,
        },
      });

      // 2. Criar roles de sistema para o tenant
      const createdRoles: Record<string, { id: string }> = {};
      for (const [key, roleConfig] of Object.entries(SYSTEM_ROLES)) {
        const role = await tx.customRole.create({
          data: {
            tenantId: tenant.id,
            name: roleConfig.name,
            description: roleConfig.description,
            color: roleConfig.color,
            roleType: roleConfig.roleType,
            isSystem: roleConfig.isSystem,
            isDefault: roleConfig.isDefault || false,
            modulePermissions: roleConfig.modulePermissions,
            permissions: [],
            tenantPermissions: {},
          },
        });
        createdRoles[key] = role;
      }

      // 3. Criar usuario admin com role ADMIN
      const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          password: hashedPassword,
          name: dto.adminName,
          customRoleId: createdRoles.ADMIN.id,
          status: Status.ACTIVE,
        },
      });

      return tenant;
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
