import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    // Determinar tenantId (PLATFORM_ADMIN pode criar em outro tenant)
    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

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
        customRoleId: true,
        status: true,
        tenantId: true,
        createdAt: true,
        customRole: { select: { id: true, name: true, color: true, roleType: true, isSystem: true } },
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
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;
    const { search, role, status, tenantId: queryTenantId, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    // Base filter por tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const where: Prisma.UserWhereInput = {};

    if (roleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    // Filtros opcionais
    if (role) where.customRole = { roleType: role };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor pagination
    const useCursor = !!cursor;
    let cursorClause: { id: string } | undefined;

    if (useCursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) {
        cursorClause = { id: decodedCursor.id };
      }
    }

    // OrderBy com id como tiebreaker
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    const takeWithExtra = limit + 1;

    const findManyArgs: Prisma.UserFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        customRole: {
          select: { id: true, name: true, color: true, roleType: true, isSystem: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    };

    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skip;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.user.findMany(findManyArgs),
      this.prisma.user.count({ where }),
    ]);

    const hasNextPage = rawData.length > limit;
    const data = hasNextPage ? rawData.slice(0, limit) : rawData;
    const hasPreviousPage = useCursor ? true : page > 1;

    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];

      if (hasNextPage) {
        nextCursor = encodeCursor({
          id: lastItem.id,
          sortField: sortBy,
          sortValue: (lastItem as Record<string, unknown>)[sortBy] as string,
        });
      }

      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({
          id: firstItem.id,
          sortField: sortBy,
          sortValue: (firstItem as Record<string, unknown>)[sortBy] as string,
        });
      }
    }

    return {
      data,
      meta: createPaginationMeta(total, page, limit, {
        hasNextPage,
        hasPreviousPage,
        nextCursor,
        previousCursor,
      }),
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    // PLATFORM_ADMIN pode ver usuario de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.UserWhereInput = { id };
    if (roleType !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = currentUser.tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        customRole: {
          select: {
            id: true, name: true, color: true,
            roleType: true, isSystem: true,
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
        customRoleId: true,
        status: true,
        tenantId: true,
        updatedAt: true,
        customRole: { select: { id: true, name: true, color: true, roleType: true, isSystem: true } },
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
