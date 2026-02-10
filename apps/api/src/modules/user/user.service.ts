import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CurrentUser } from '../../common/types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // Helper para determinar o tenantId a ser usado (suporta PLATFORM_ADMIN)
  private getEffectiveTenantId(currentUser: CurrentUser, requestedTenantId?: string): string {
    // PLATFORM_ADMIN pode acessar qualquer tenant
    if (currentUser.role === UserRole.PLATFORM_ADMIN && requestedTenantId) {
      return requestedTenantId;
    }
    return currentUser.tenantId;
  }

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    // Determinar tenantId (PLATFORM_ADMIN pode criar em outro tenant)
    const targetTenantId = this.getEffectiveTenantId(currentUser, dto.tenantId);

    // Verificar se email ja existe no tenant
    const existing = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: targetTenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Email ja esta em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Remove tenantId do dto para evitar duplicacao
    const { tenantId: _, ...userData } = dto;

    const newUser = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        tenantId: targetTenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        createdAt: true,
        customRole: { select: { id: true, name: true, color: true } },
      },
    });

    // Enviar notificacao para o tenant
    this.notificationService.notifyNewUser(
      targetTenantId,
      newUser.name,
      currentUser.name,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    return newUser;
  }

  async findAll(query: QueryUserDto, currentUser: CurrentUser) {
    const { page = 1, limit = 20, search, role, status, tenantId: queryTenantId } = query;
    const skip = (page - 1) * limit;

    // Base filter por tenant (PLATFORM_ADMIN pode filtrar por qualquer tenant ou ver todos)
    const where: Prisma.UserWhereInput = {};
    
    if (currentUser.role === UserRole.PLATFORM_ADMIN) {
      // PLATFORM_ADMIN: se especificou tenantId, filtra; senao, mostra todos
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      // Outros usuarios: apenas seu tenant
      where.tenantId = currentUser.tenantId;
    }

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
          customRoleId: true,
          status: true,
          tenantId: true,
          lastLoginAt: true,
          createdAt: true,
          customRole: { select: { id: true, name: true, color: true } },
          tenant: {
            select: { id: true, name: true, slug: true },
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

  async findOne(id: string, currentUser: CurrentUser) {
    // PLATFORM_ADMIN pode ver usuario de qualquer tenant
    const whereClause: Prisma.UserWhereInput = { id };
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        customRole: {
          select: {
            id: true, name: true, color: true,
            permissions: true, modulePermissions: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
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
    // Verifica se usuario existe (e se tem permissao)
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
        customRoleId: true,
        status: true,
        tenantId: true,
        updatedAt: true,
        customRole: { select: { id: true, name: true, color: true } },
      },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    // Verifica se usuario existe (e se tem permissao)
    await this.findOne(id, currentUser);

    // Nao pode deletar a si mesmo
    if (id === currentUser.id) {
      throw new ForbiddenException('Voce nao pode excluir sua propria conta');
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'Usuario excluido com sucesso' };
  }
}
