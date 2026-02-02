import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any, currentUser: any) {
    // Verificar se slug já existe no tenant
    const existing = await this.prisma.organization.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException('Slug já está em uso');
    }

    return this.prisma.organization.create({
      data: {
        ...dto,
        tenantId: currentUser.tenantId,
      },
    });
  }

  async findAll(currentUser: any) {
    return this.prisma.organization.findMany({
      where: { tenantId: currentUser.tenantId },
      include: {
        _count: {
          select: {
            users: true,
            workspaces: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: any) {
    const org = await this.prisma.organization.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        workspaces: true,
        _count: {
          select: {
            users: true,
            workspaces: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organização não encontrada');
    }

    return org;
  }

  async update(id: string, dto: any, currentUser: any) {
    await this.findOne(id, currentUser);

    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, currentUser: any) {
    await this.findOne(id, currentUser);

    await this.prisma.organization.delete({ where: { id } });

    return { message: 'Organização excluída com sucesso' };
  }
}
