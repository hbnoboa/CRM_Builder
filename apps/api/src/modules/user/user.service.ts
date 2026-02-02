import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { UserRole, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto, currentUser: any) {
    // Verificar se email já existe no tenant
    const existing = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: currentUser.tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Email já está em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        tenantId: currentUser.tenantId,
        organizationId: dto.organizationId || currentUser.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        organizationId: true,
        createdAt: true,
      },
    });
  }

  async findAll(query: QueryUserDto, currentUser: any) {
    const { page = 1, limit = 20, search, role, status, organizationId } = query;
    const skip = (page - 1) * limit;

    // Base filter por tenant
    const where: any = {
      tenantId: currentUser.tenantId,
    };

    // Manager só vê usuários da sua organização
    if (currentUser.role === UserRole.MANAGER) {
      where.organizationId = currentUser.organizationId;
    }

    // Filtros opcionais
    if (role) where.role = role;
    if (status) where.status = status;
    if (organizationId) where.organizationId = organizationId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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

  async findOne(id: string, currentUser: any) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: any) {
    const user = await this.findOne(id, currentUser);

    // Verificar permissão (Manager só edita da equipe)
    if (currentUser.role === UserRole.MANAGER) {
      if (user.organization?.id !== currentUser.organizationId) {
        throw new ForbiddenException('Você só pode editar usuários da sua equipe');
      }
    }

    // Se mudando senha, fazer hash
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, currentUser: any) {
    const user = await this.findOne(id, currentUser);

    // Não pode deletar a si mesmo
    if (id === currentUser.id) {
      throw new ForbiddenException('Você não pode excluir sua própria conta');
    }

    // Verificar permissão
    if (currentUser.role === UserRole.MANAGER) {
      if (user.organization?.id !== currentUser.organizationId) {
        throw new ForbiddenException('Você só pode excluir usuários da sua equipe');
      }
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'Usuário excluído com sucesso' };
  }
}
