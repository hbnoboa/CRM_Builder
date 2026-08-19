import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionCacheService } from './permission-cache.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto, QueryCustomRoleDto, DataFilterDto } from './dto/custom-role.dto';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { hasPlatformAccess, hasFullTenantAccess } from '../../common/utils/platform-access';
import { assertPermissionsSubset, assertCanActOnRank, assertNotImpersonating } from '../../common/utils/permission-governance';
import { Prisma } from '@prisma/client';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';

export interface ModulePermissionCrud {
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export type NormalizedModulePermissions = Record<string, ModulePermissionCrud>;

/**
 * Normaliza modulePermissions: converte formato boolean antigo para CRUD
 * - true → { canRead: true, canCreate: true, canUpdate: true, canDelete: true }
 * - false → { canRead: false, canCreate: false, canUpdate: false, canDelete: false }
 * - { canRead: true, ... } → mantém como está
 */
function normalizeModulePermissions(mp: Record<string, unknown> | null | undefined): NormalizedModulePermissions {
  if (!mp) return {};

  const result: NormalizedModulePermissions = {};
  for (const [key, value] of Object.entries(mp)) {
    if (typeof value === 'boolean') {
      result[key] = { canRead: value, canCreate: value, canUpdate: value, canDelete: value };
    } else if (value && typeof value === 'object') {
      result[key] = value as ModulePermissionCrud;
    }
  }
  return result;
}

const FULL_CRUD: ModulePermissionCrud = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };

@Injectable()
export class CustomRoleService {
  private readonly logger = new Logger(CustomRoleService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private permissionCache: PermissionCacheService,
  ) {}

  /**
   * Identidade global (#10): o cargo do usuario vem da Membership. Resolve o
   * cargo no tenant dado (ou na membership primaria, se tenant omitido).
   */
  private async resolveMembershipRole(userId: string, tenantId?: string) {
    const sel = { permissions: true, modulePermissions: true } as const;
    if (tenantId) {
      const m = await this.prisma.userTenantAccess.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { tenantId: true, customRoleId: true, status: true, deletedAt: true, customRole: { select: sel } },
      });
      if (m && m.status === 'ACTIVE' && m.deletedAt === null) return m;
    }
    const list = await this.prisma.userTenantAccess.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      select: { tenantId: true, customRoleId: true, status: true, deletedAt: true, customRole: { select: sel } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      take: 1,
    });
    return list[0] ?? null;
  }

  async create(dto: CreateCustomRoleDto, currentUser: CurrentUser, requestedTenantId?: string) {
    assertNotImpersonating(currentUser, 'criar cargo');
    const tenantId = getEffectiveTenantId(currentUser, requestedTenantId);

    // Verificar se nome já existe no tenant
    const existing = await this.prisma.customRole.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Já existe uma role com este nome');
    }

    // Governanca anti-escalada: so concede permissoes que o proprio ator possui.
    assertPermissionsSubset(currentUser.customRole?.modulePermissions, dto.modulePermissions);

    // RANK: numero MENOR = mais poder. Cargo criado deve ser SUBORDINADO ao criador
    // (rank estritamente MAIOR), senao a governanca trava (cargos no mesmo rank nao
    // se gerenciam nem podem ser atribuidos). Plataforma define livremente.
    const isPlatform = hasPlatformAccess(currentUser.customRole?.modulePermissions);
    const actorRank = currentUser.customRole?.rank ?? 999999;
    let rank: number;
    if (dto.rank !== undefined) {
      if (!isPlatform && dto.rank <= actorRank) {
        throw new ForbiddenException(
          `Rank invalido: voce so cria cargos de rank maior que o seu (${actorRank}); rank menor/igual concederia poder igual ou superior.`,
        );
      }
      rank = dto.rank;
    } else {
      rank = isPlatform ? 100 : actorRank + 10;
    }

    const newRole = await this.prisma.customRole.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isSystem: false,
        rank,
        permissions: dto.permissions as unknown as Prisma.InputJsonValue,
        modulePermissions: (dto.modulePermissions || {}) as unknown as Prisma.InputJsonValue,
        isDefault: dto.isDefault || false,
      },
      include: {
        _count: { select: { tenantAccessUsers: true } },
      },
    });

    // Audit log
    this.auditService.log(currentUser, {
      action: 'create',
      resource: 'custom_role',
      resourceId: newRole.id,
      newData: { name: newRole.name, description: newRole.description, color: newRole.color },
      metadata: { name: newRole.name },
    }).catch(() => {});

    return newRole;
  }

  async findAll(query: QueryCustomRoleDto, currentUser: CurrentUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;
    const { search, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const tenantId = getEffectiveTenantId(currentUser, query.tenantId);

    const where: Prisma.CustomRoleWhereInput = { tenantId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

    const orderBy: Prisma.CustomRoleOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    const takeWithExtra = limit + 1;

    const findManyArgs: Prisma.CustomRoleFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      include: {
        _count: { select: { tenantAccessUsers: true } },
      },
    };

    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skip;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.customRole.findMany(findManyArgs),
      this.prisma.customRole.count({ where }),
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
        nextCursor = encodeCursor({ id: lastItem.id, sortField: sortBy });
      }
      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({ id: firstItem.id, sortField: sortBy });
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

  async findOne(id: string, currentUser: CurrentUser, requestedTenantId?: string) {
    const tenantId = getEffectiveTenantId(currentUser, requestedTenantId);

    const role = await this.prisma.customRole.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { tenantAccessUsers: true } },
        // Identidade global (#10): usuarios do cargo vem via membership.
        tenantAccessUsers: {
          take: 10,
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role não encontrada');
    }

    // Mantem o shape `users` esperado pelo frontend.
    const { tenantAccessUsers, ...rest } = role;
    return { ...rest, users: tenantAccessUsers.map((m) => m.user) };
  }

  async update(id: string, dto: UpdateCustomRoleDto, currentUser: CurrentUser, requestedTenantId?: string) {
    assertNotImpersonating(currentUser, 'editar cargo');
    const tenantId = getEffectiveTenantId(currentUser, requestedTenantId);

    const role = await this.findOne(id, currentUser, requestedTenantId);

    // RANK RULE: so edita cargos de rank inferior (numero maior) ao seu.
    assertCanActOnRank(currentUser.customRole?.modulePermissions, currentUser.customRole?.rank ?? 999999, role.rank ?? 0);

    // Proteger roles de sistema: nome nao pode ser alterado
    if (role.isSystem) {
      if (dto.name && dto.name !== role.name) {
        throw new ForbiddenException('Nome de roles do sistema nao pode ser alterado');
      }
    }

    // Verificar conflito de nome
    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.customRole.findFirst({
        where: { tenantId, name: dto.name, id: { not: id }, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException('Ja existe uma role com este nome');
      }
    }

    // Governanca anti-escalada: so concede permissoes que o proprio ator possui.
    if (dto.modulePermissions !== undefined) {
      assertPermissionsSubset(currentUser.customRole?.modulePermissions, dto.modulePermissions);

      // CAPABILITY FLOOR (anti-lockout): nao remover o ultimo acesso de plataforma.
      // Aplica-se a TODOS (inclusive plataforma) — invariante de seguranca.
      const hadPlatform = hasPlatformAccess(role.modulePermissions);
      const willHavePlatform = hasPlatformAccess(dto.modulePermissions);
      if (hadPlatform && !willHavePlatform) {
        const others = await this.countActivePlatformUsers(id);
        if (others === 0) {
          throw new ForbiddenException(
            'Capability floor: nao e possivel remover o ultimo acesso de plataforma (lockout).',
          );
        }
      }
    }

    // RANK: ator nao-plataforma so pode mover um cargo para rank estritamente MAIOR
    // que o seu (nunca igual/abaixo = nao pode criar par ou superior a si).
    if (dto.rank !== undefined) {
      const isPlatform = hasPlatformAccess(currentUser.customRole?.modulePermissions);
      const actorRank = currentUser.customRole?.rank ?? 999999;
      if (!isPlatform && dto.rank <= actorRank) {
        throw new ForbiddenException(
          `Rank invalido: voce so define rank maior que o seu (${actorRank}).`,
        );
      }
    }

    const data: Prisma.CustomRoleUpdateInput = {};
    if (!role.isSystem && dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.rank !== undefined) data.rank = dto.rank;
    if (dto.permissions !== undefined) data.permissions = dto.permissions as unknown as Prisma.InputJsonValue;
    if (dto.modulePermissions !== undefined) data.modulePermissions = (dto.modulePermissions || {}) as unknown as Prisma.InputJsonValue;
    if (dto.tenantPermissions !== undefined) data.tenantPermissions = dto.tenantPermissions as unknown as Prisma.InputJsonValue;

    // Entidades cujo filtro/scope mudou -> precisam recomputar a visibilidade do
    // PowerSync. O enfileiramento vai na MESMA transacao do update (enqueue
    // transacional; um consumidor async recomputa em lotes). Ver VisibilityRecomputeJob.
    const affected = this.affectedEntitySlugs(role.permissions, dto.permissions);

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const r = await tx.customRole.update({
        where: { id },
        data,
        include: {
          _count: { select: { tenantAccessUsers: true } },
        },
      });
      if (affected === '*') {
        await tx.$executeRawUnsafe(
          `INSERT INTO "visibility_recompute" ("tenantId", "entitySlug")
             SELECT $1, slug FROM "Entity" WHERE "tenantId" = $1 AND "deletedAt" IS NULL`,
          tenantId,
        );
      } else {
        for (const slug of affected) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "visibility_recompute" ("tenantId", "entitySlug") VALUES ($1, $2)`,
            tenantId,
            slug,
          );
        }
      }
      return r;
    });

    // Audit log
    this.auditService.log(currentUser, {
      action: 'update',
      resource: 'custom_role',
      resourceId: id,
      oldData: { name: role.name, description: role.description, color: role.color },
      newData: dto as unknown as Record<string, unknown>,
      metadata: { name: updatedRole.name },
    }).catch(() => {});

    // Invalidar cache de permissions: usuarios com essa role vem via membership.
    const memberships = await this.prisma.userTenantAccess.findMany({
      where: { customRoleId: id, deletedAt: null },
      select: { userId: true },
    });

    if (memberships.length > 0) {
      const userIds = memberships.map((m) => m.userId);
      await this.permissionCache.invalidateMultipleUsers(userIds, tenantId);
      this.logger.log(`🗑️ Invalidados caches de ${userIds.length} usuários após update de role ${updatedRole.name}`);
    }

    return updatedRole;
  }

  /**
   * Slugs de entidade cujo filtro/scope de leitura mudou entre as permissoes
   * antiga e nova (added/removed/modified) — sao as que precisam recomputar a
   * visibilidade. Retorna '*' se o coringa mudou (recomputa todas as entidades).
   * [] quando permissions nao foi tocado no update.
   */
  private affectedEntitySlugs(
    oldPerms: unknown,
    newPerms: unknown,
  ): string[] | '*' {
    if (newPerms === undefined) return [];
    const toMap = (arr: unknown): Map<string, string> => {
      const m = new Map<string, string>();
      if (Array.isArray(arr)) {
        for (const p of arr) {
          const slug = (p as { entitySlug?: string })?.entitySlug;
          if (slug) m.set(slug, JSON.stringify(p));
        }
      }
      return m;
    };
    const o = toMap(oldPerms);
    const n = toMap(newPerms);
    const changed: string[] = [];
    for (const slug of new Set([...o.keys(), ...n.keys()])) {
      if (o.get(slug) !== n.get(slug)) changed.push(slug);
    }
    if (changed.includes('*')) return '*';
    return changed;
  }

  async remove(id: string, currentUser: CurrentUser, requestedTenantId?: string) {
    assertNotImpersonating(currentUser, 'excluir cargo');
    const role = await this.findOne(id, currentUser, requestedTenantId);

    // RANK RULE: so exclui cargos de rank inferior (numero maior) ao seu.
    assertCanActOnRank(currentUser.customRole?.modulePermissions, currentUser.customRole?.rank ?? 999999, role.rank ?? 0);

    // Roles de sistema nao podem ser excluidas
    if (role.isSystem) {
      throw new ForbiddenException('Roles do sistema nao podem ser excluidas');
    }

    // Verificar se ha usuarios usando esta role (via membership)
    const usersCount = await this.prisma.userTenantAccess.count({
      where: { customRoleId: id, deletedAt: null },
    });

    if (usersCount > 0) {
      throw new ConflictException(`Esta role esta atribuida a ${usersCount} usuario(s). Reassine-os antes de excluir.`);
    }

    // Soft delete (mantem historico; a listagem ja filtra deletedAt:null).
    await this.prisma.customRole.update({ where: { id }, data: { deletedAt: new Date() } });

    // Audit log
    this.auditService.log(currentUser, {
      action: 'delete',
      resource: 'custom_role',
      resourceId: id,
      oldData: { name: role.name, description: role.description, color: role.color },
      metadata: { name: role.name },
    }).catch(() => {});

    return { message: 'Role excluida com sucesso' };
  }

  async assignToUser(
    roleId: string,
    userId: string,
    currentUser: CurrentUser,
    requestedTenantId?: string,
    expiresAt?: string | null,
  ) {
    assertNotImpersonating(currentUser, 'atribuir cargo');
    const tenantId = getEffectiveTenantId(currentUser, requestedTenantId);

    // #19 item 6: acesso temporario. expiresAt opcional (null/ausente = permanente).
    // Generaliza o tempo-limitado da impersonacao para memberships/grants.
    let expiresAtDate: Date | null = null;
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('expiresAt invalido (use ISO 8601)');
      }
      if (parsed <= new Date()) {
        throw new BadRequestException('expiresAt deve estar no futuro');
      }
      expiresAtDate = parsed;
    }

    // Verificar se a role existe e pertence ao tenant
    const role = await this.prisma.customRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Role não encontrada');

    // Governanca anti-escalada: so atribui cargo cujas permissoes o ator possui
    // e de rank inferior (numero maior) ao seu.
    assertPermissionsSubset(currentUser.customRole?.modulePermissions, role.modulePermissions);
    assertCanActOnRank(currentUser.customRole?.modulePermissions, currentUser.customRole?.rank ?? 999999, role.rank ?? 0);

    // Verificar se o usuário (identidade) existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Membership autoritativa (#10): o cargo do usuario no tenant VIVE aqui.
    // Cria (= adiciona ao tenant) ou atualiza o vinculo. expiresAt opcional.
    await this.prisma.userTenantAccess.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      update: { customRoleId: roleId, deletedAt: null, expiresAt: expiresAtDate },
      create: { userId, tenantId, customRoleId: roleId, status: 'ACTIVE', expiresAt: expiresAtDate },
    });

    const updatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      customRoleId: roleId,
      customRole: { id: role.id, name: role.name, isSystem: role.isSystem },
    };

    // Audit log
    this.auditService.log(currentUser, {
      action: 'update',
      resource: 'custom_role',
      resourceId: roleId,
      newData: { userId, roleName: role.name },
      metadata: { subAction: 'assign_role', userId, userName: user.name },
    }).catch(() => {});

    // Invalidar cache de permissions do usuário (mudou de role)
    await this.permissionCache.invalidateUserPermissions(userId, tenantId);
    this.logger.log(`🗑️ Invalidado cache de permissions do usuário ${user.name} após atribuição de role ${role.name}`);

    return updatedUser;
  }

  async removeFromUser(userId: string, currentUser: CurrentUser, requestedTenantId?: string) {
    const tenantId = getEffectiveTenantId(currentUser, requestedTenantId);

    // Membership do usuario neste tenant (fonte da verdade).
    const membership = await this.prisma.userTenantAccess.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { customRoleId: true },
    });
    if (!membership) throw new NotFoundException('Usuario nao pertence a este tenant');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    // Buscar role default do tenant
    const defaultRole = await this.prisma.customRole.findFirst({
      where: { tenantId, isDefault: true },
    });

    if (!defaultRole) {
      throw new NotFoundException('Tenant sem role default configurada');
    }

    const oldRoleId = membership.customRoleId;

    // Membership autoritativa (#10): volta o vinculo para o cargo default.
    await this.prisma.userTenantAccess.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { customRoleId: defaultRole.id, deletedAt: null },
    });

    const updatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      customRoleId: defaultRole.id,
      customRole: { id: defaultRole.id, name: defaultRole.name, isSystem: defaultRole.isSystem },
    };

    // Audit log
    this.auditService.log(currentUser, {
      action: 'update',
      resource: 'custom_role',
      resourceId: oldRoleId || defaultRole.id,
      oldData: { userId, customRoleId: oldRoleId },
      newData: { userId, customRoleId: defaultRole.id, defaultRoleName: defaultRole.name },
      metadata: { subAction: 'remove_role', userId, userName: user.name },
    }).catch(() => {});

    return updatedUser;
  }

  /**
   * Acha a permissao por entidade em permissions[]. Match EXATO do entitySlug tem
   * prioridade; senao cai no coringa '*' (entrada "todas as tabelas"). Modelo
   * permission-driven: NAO depende mais de roleType (toda role e CUSTOM).
   */
  private findEntityPerm<T extends { entitySlug: string }>(
    permissions: unknown,
    entitySlug: string,
  ): T | null {
    const perms = (permissions || []) as T[];
    if (!Array.isArray(perms)) return null;
    return (
      perms.find((p) => p.entitySlug === entitySlug) ??
      perms.find((p) => p.entitySlug === '*') ??
      null
    );
  }

  /**
   * Verifica se um usuario tem permissao para uma entidade especifica.
   * Decisao por permissao (platform access OU permissions[]/'*'), nunca por roleType.
   */
  async hasEntityPermission(
    userId: string,
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): Promise<boolean> {
    const m = await this.resolveMembershipRole(userId);
    if (!m || !m.customRole) return false;

    // Acesso de plataforma (cross-tenant) ou acesso total ao tenant libera tudo.
    if (
      hasPlatformAccess(m.customRole.modulePermissions) ||
      hasFullTenantAccess(m.customRole.modulePermissions)
    ) {
      return true;
    }

    const entry = this.findEntityPerm<{
      entitySlug: string;
      canCreate?: boolean; canRead?: boolean; canUpdate?: boolean; canDelete?: boolean;
    }>(m.customRole.permissions, entitySlug);
    return !!entry && entry[action] === true;
  }

  /**
   * Retorna o escopo de visibilidade do usuario para uma entidade
   * @returns 'all' | 'own' | null (null = sem acesso)
   */
  async getEntityScope(
    userId: string,
    entitySlug: string,
  ): Promise<'all' | 'own' | null> {
    const m = await this.resolveMembershipRole(userId);
    if (!m || !m.customRole) return null;

    // Acesso de plataforma OU acesso total ao tenant vê tudo.
    if (
      hasPlatformAccess(m.customRole.modulePermissions) ||
      hasFullTenantAccess(m.customRole.modulePermissions)
    ) {
      return 'all';
    }

    const entry = this.findEntityPerm<{
      entitySlug: string; canRead?: boolean; scope?: 'all' | 'own';
    }>(m.customRole.permissions, entitySlug);
    if (!entry || entry.canRead !== true) return null;
    return entry.scope === 'own' ? 'own' : 'all';
  }

  /**
   * Retorna as permissoes por campo para uma entidade.
   * Retorna null se nao houver restricoes (PLATFORM_ADMIN, ADMIN, ou fieldPermissions vazio).
   */
  async getFieldPermissions(
    userId: string,
    entitySlug: string,
  ): Promise<Array<{ fieldSlug: string; canView: boolean; canEdit: boolean }> | null> {
    const m = await this.resolveMembershipRole(userId);
    if (!m || !m.customRole) return null;

    // Acesso de plataforma OU acesso total ao tenant vê todos os campos (sem restrição).
    if (
      hasPlatformAccess(m.customRole.modulePermissions) ||
      hasFullTenantAccess(m.customRole.modulePermissions)
    ) {
      return null;
    }

    const entry = this.findEntityPerm<{
      entitySlug: string;
      fieldPermissions?: Array<{ fieldSlug: string; canView: boolean; canEdit: boolean }>;
    }>(m.customRole.permissions, entitySlug);
    if (!entry?.fieldPermissions || entry.fieldPermissions.length === 0) return null;

    return entry.fieldPermissions;
  }

  /**
   * Retorna as entidades acessiveis (canRead): '*' = TODAS (platform access ou
   * coringa em permissions[]), ou a lista explicita de slugs. Quem chama trata '*'
   * como "sem filtro de slug" (escopo de tenant ja aplicado no caller).
   */
  async getUserAccessibleEntities(userId: string): Promise<'*' | string[]> {
    const m = await this.resolveMembershipRole(userId);
    if (!m || !m.customRole) return [];

    // Acesso de plataforma OU acesso total ao tenant vê todas as entidades.
    if (
      hasPlatformAccess(m.customRole.modulePermissions) ||
      hasFullTenantAccess(m.customRole.modulePermissions)
    ) {
      return '*';
    }

    const permissions = (m.customRole.permissions || []) as Array<{
      entitySlug: string;
      canRead?: boolean;
    }>;
    // Coringa '*' com canRead => todas as tabelas (incl. futuras), por escolha.
    if (permissions.some((p) => p.entitySlug === '*' && p.canRead === true)) return '*';

    return permissions.filter((p) => p.canRead === true).map((p) => p.entitySlug);
  }

  /**
   * Mesma decisao que getUserAccessibleEntities, mas SEMPRE materializa em lista de
   * slugs concreta (resolve '*' para todas as entidades do tenant do usuario).
   * Para endpoints que expoem a lista ao frontend.
   */
  async getAccessibleEntitySlugs(userId: string): Promise<string[]> {
    const accessible = await this.getUserAccessibleEntities(userId);
    if (accessible !== '*') return accessible;
    const m = await this.resolveMembershipRole(userId);
    if (!m) return [];
    const entities = await this.prisma.entity.findMany({
      where: { tenantId: m.tenantId },
      select: { slug: true },
    });
    return entities.map((e) => e.slug);
  }

  /**
   * Retorna as permissoes de modulo do usuario (formato CRUD)
   */
  async getUserModulePermissions(userId: string, tenantId?: string): Promise<NormalizedModulePermissions> {
    // Cargo via membership (do tenant dado, ou primaria).
    const user = await this.resolveMembershipRole(userId, tenantId);
    if (!user || !user.customRole) return {};

    const effectiveTenantId = tenantId || user.tenantId;

    // Tentar buscar do cache
    const cached = await this.permissionCache.getUserPermissions(userId, effectiveTenantId);
    if (cached) {
      return normalizeModulePermissions(cached.modulePermissions as Record<string, unknown>);
    }

    // Cache miss - buscar do banco
    let modulePermissions: NormalizedModulePermissions;

    // Acesso de plataforma OU acesso total ao tenant tem CRUD em tudo. (Módulos futuros
    // são cobertos dinamicamente pelo bypass no guard/hook; aqui é só o retrato de display.)
    if (
      hasPlatformAccess(user.customRole.modulePermissions) ||
      hasFullTenantAccess(user.customRole.modulePermissions)
    ) {
      modulePermissions = {
        dashboard: FULL_CRUD,
        users: FULL_CRUD,
        settings: FULL_CRUD,
        apis: FULL_CRUD,
        pages: FULL_CRUD,
        entities: FULL_CRUD,
        tenants: FULL_CRUD,
      };
    } else {
      // Demais roles: usar modulePermissions configuradas (normalizado de boolean → CRUD)
      modulePermissions = normalizeModulePermissions(user.customRole.modulePermissions as Record<string, unknown>);
    }

    // Salvar no cache
    await this.permissionCache.setUserPermissions(userId, effectiveTenantId, {
      modulePermissions: user.customRole.modulePermissions as Record<string, unknown>,
      entityPermissions: (user.customRole.permissions as any[]) || [],
    });

    return modulePermissions;
  }

  /**
   * Retorna os filtros de dados da role para uma entidade especifica.
   * Fonte unica: permissions[].dataFilters (inline por entidade).
   * PLATFORM_ADMIN/ADMIN retornam [] (sem filtros).
   */
  /** Conta usuarios ativos com acesso de plataforma (platform.crossTenant), excluindo um cargo. */
  private async countActivePlatformUsers(excludeRoleId?: string): Promise<number> {
    // Identidade global (#10): acesso de plataforma vem da membership.
    const rows = await this.prisma.userTenantAccess.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(excludeRoleId ? { customRoleId: { not: excludeRoleId } } : {}),
        customRole: {
          modulePermissions: { path: ['platform', 'crossTenant'], equals: true },
        },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.length;
  }

  getRoleDataFilters(
    customRole: { permissions: unknown; modulePermissions?: unknown },
    entitySlug: string,
  ): DataFilterDto[] {
    // Acesso de plataforma nao tem filtros por role.
    if (hasPlatformAccess(customRole.modulePermissions)) {
      return [];
    }

    const entry = this.findEntityPerm<{
      entitySlug: string; dataFilters?: DataFilterDto[];
    }>(customRole.permissions, entitySlug);
    return entry?.dataFilters?.length ? [...entry.dataFilters] : [];
  }
}
