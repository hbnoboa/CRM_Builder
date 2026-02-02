import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any, currentUser: any) {
    // Gerar slug se não fornecido
    const slug = dto.slug || dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Verificar se slug já existe no tenant
    const existing = await this.prisma.role.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        slug,
      },
    });

    if (existing) {
      throw new ConflictException('Slug já está em uso');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        tenantId: currentUser.tenantId,
        permissions: dto.permissions || [],
        isSystem: dto.isSystem || false,
      },
    });
  }

  async findAll(currentUser: any) {
    return this.prisma.role.findMany({
      where: { tenantId: currentUser.tenantId },
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: any) {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role não encontrada');
    }

    return role;
  }

  async update(id: string, dto: any, currentUser: any) {
    const role = await this.findOne(id, currentUser);

    if (role.isSystem) {
      throw new BadRequestException('Roles do sistema não podem ser editadas');
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, currentUser: any) {
    const role = await this.findOne(id, currentUser);

    if (role.isSystem) {
      throw new BadRequestException('Roles do sistema não podem ser excluídas');
    }

    await this.prisma.role.delete({ where: { id } });

    return { message: 'Role excluída com sucesso' };
  }

  async assignToUser(userId: string, roleId: string, currentUser: any) {
    // Verificar se role existe
    await this.findOne(roleId, currentUser);

    // Verificar se já está atribuída
    const existing = await this.prisma.userRole_.findUnique({
      where: {
        userId_roleId: { userId, roleId },
      },
    });

    if (existing) {
      throw new ConflictException('Role já atribuída a este usuário');
    }

    return this.prisma.userRole_.create({
      data: { userId, roleId },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async removeFromUser(userId: string, roleId: string, currentUser: any) {
    await this.findOne(roleId, currentUser);

    await this.prisma.userRole_.delete({
      where: {
        userId_roleId: { userId, roleId },
      },
    });

    return { message: 'Role removida do usuário' };
  }

  async getUserRoles(userId: string, currentUser: any) {
    return this.prisma.userRole_.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });
  }
}
