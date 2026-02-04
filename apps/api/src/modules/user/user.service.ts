import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CurrentUser } from '../../common/types';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    // Verificar se email ja existe no tenant
    const existing = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: currentUser.tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Email ja esta em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        tenantId: currentUser.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findAll(query: QueryUserDto, currentUser: CurrentUser) {
    const { page = 1, limit = 20, search, role, status } = query;
    const skip = (page - 1) * limit;

    // Base filter por tenant
    const where: Prisma.UserWhereInput = {
      tenantId: currentUser.tenantId,
    };

    // Filtros opcionais
    if (role) where.role = role;
    if (status) where.status = status;
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

  async findOne(id: string, currentUser: CurrentUser) {
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
      throw new NotFoundException('Usuario nao encontrado');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

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

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    // Nao pode deletar a si mesmo
    if (id === currentUser.id) {
      throw new ForbiddenException('Voce nao pode excluir sua propria conta');
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'Usuario excluido com sucesso' };
  }
}
