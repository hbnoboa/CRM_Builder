import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreatePublicLinkDto, UpdatePublicLinkDto, PublicRegisterDto, PublicLoginDto, QueryPublicLinkDto } from './dto/public-link.dto';
import { CurrentUser } from '../../common/types/auth.types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class PublicLinkService {
  private readonly logger = new Logger(PublicLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // ADMIN CRUD (protegido)
  // ═══════════════════════════════════════════════════════════════

  async create(dto: CreatePublicLinkDto, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);

    // Buscar entidade pelo slug
    const entity = await this.prisma.entity.findFirst({
      where: { slug: dto.entitySlug, tenantId },
    });
    if (!entity) {
      throw new NotFoundException(`Entidade "${dto.entitySlug}" nao encontrada`);
    }

    // Resolver ou criar role
    let customRoleId = dto.customRoleId;
    if (!customRoleId) {
      const role = await this.autoCreateRole(tenantId, entity.slug, entity.name);
      customRoleId = role.id;
    } else {
      // Validar que role pertence ao tenant
      const exists = await this.prisma.customRole.findFirst({
        where: { id: customRoleId, tenantId },
      });
      if (!exists) throw new BadRequestException('Role nao encontrada neste tenant');
    }

    // Gerar slug unico
    const slug = crypto.randomBytes(16).toString('base64url');

    const link = await this.prisma.publicLink.create({
      data: {
        tenantId,
        slug,
        entitySlug: entity.slug,
        entityId: entity.id,
        customRoleId,
        name: dto.name,
        description: dto.description,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxUsers: dto.maxUsers,
        createdById: currentUser.id,
      },
      include: {
        entity: { select: { name: true, slug: true } },
        customRole: { select: { id: true, name: true, roleType: true } },
      },
    });

    this.logger.log(`PublicLink criado: ${link.name} (${link.slug}) por ${currentUser.email}`);
    return link;
  }

  async findAll(query: QueryPublicLinkDto, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const where: any = { tenantId };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.entitySlug) {
      where.entitySlug = query.entitySlug;
    }

    const [data, total] = await Promise.all([
      this.prisma.publicLink.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          entity: { select: { name: true, slug: true } },
          customRole: { select: { id: true, name: true } },
        },
      }),
      this.prisma.publicLink.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);
    const link = await this.prisma.publicLink.findFirst({
      where: { id, tenantId },
      include: {
        entity: { select: { name: true, slug: true, fields: true } },
        customRole: { select: { id: true, name: true, roleType: true } },
      },
    });
    if (!link) throw new NotFoundException('Link nao encontrado');
    return link;
  }

  async update(id: string, dto: UpdatePublicLinkDto, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);
    const existing = await this.prisma.publicLink.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Link nao encontrado');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers;

    // Se mudar entitySlug, resolver entidade e possivelmente role
    if (dto.entitySlug && dto.entitySlug !== existing.entitySlug) {
      const entity = await this.prisma.entity.findFirst({
        where: { slug: dto.entitySlug, tenantId },
      });
      if (!entity) throw new NotFoundException(`Entidade "${dto.entitySlug}" nao encontrada`);
      data.entitySlug = entity.slug;
      data.entityId = entity.id;
    }

    if (dto.customRoleId) {
      const roleExists = await this.prisma.customRole.findFirst({
        where: { id: dto.customRoleId, tenantId },
      });
      if (!roleExists) throw new BadRequestException('Role nao encontrada neste tenant');
      data.customRoleId = dto.customRoleId;
    }

    return this.prisma.publicLink.update({
      where: { id },
      data,
      include: {
        entity: { select: { name: true, slug: true } },
        customRole: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);
    const existing = await this.prisma.publicLink.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Link nao encontrado');

    await this.prisma.publicLink.delete({ where: { id } });
    return { message: 'Link removido' };
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC ENDPOINTS (sem auth)
  // ═══════════════════════════════════════════════════════════════

  async getBySlug(slug: string) {
    const link = await this.prisma.publicLink.findUnique({
      where: { slug },
      include: {
        tenant: { select: { name: true, logo: true } },
        entity: { select: { name: true, slug: true } },
      },
    });

    if (!link) throw new NotFoundException('Link nao encontrado');

    this.validateLinkActive(link);

    // Retornar apenas dados publicos (nunca dados sensiveis)
    return {
      name: link.name,
      description: link.description,
      entityName: link.entity.name,
      entitySlug: link.entity.slug,
      tenantName: link.tenant.name,
      tenantLogo: link.tenant.logo,
      settings: link.settings,
    };
  }

  async publicRegister(slug: string, dto: PublicRegisterDto) {
    const link = await this.prisma.publicLink.findUnique({
      where: { slug },
      include: {
        customRole: { select: { id: true, roleType: true, permissions: true } },
        entity: { select: { name: true, slug: true } },
        tenant: { select: { id: true, name: true, status: true } },
      },
    });

    if (!link) throw new NotFoundException('Link nao encontrado');
    this.validateLinkActive(link);

    if (link.tenant.status !== Status.ACTIVE) {
      throw new BadRequestException('Tenant inativo');
    }

    // Fix #2: Verificar maxUsers ANTES de criar usuario
    if (link.maxUsers && link.registrationCount >= link.maxUsers) {
      throw new BadRequestException('Limite de registros atingido para este link');
    }

    // Fix #4: Normalizar email para lowercase
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Normalizar CPF/phone
    const cpf = dto.cpf ? dto.cpf.replace(/\D/g, '') || null : null;
    const cnpj = dto.cnpj ? dto.cnpj.replace(/\D/g, '') || null : null;
    const phone = dto.phone ? dto.phone.replace(/\D/g, '') || null : null;

    // Validar CPF checksum
    if (cpf && !this.validateCpf(cpf)) {
      throw new BadRequestException('CPF invalido');
    }

    // Verificar email unico no tenant
    const existingEmail = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, tenantId: link.tenantId },
    });
    if (existingEmail) throw new ConflictException('Email ja esta em uso');

    // Verificar CPF unico no tenant
    if (cpf) {
      const existingCpf = await this.prisma.user.findFirst({
        where: { cpf, tenantId: link.tenantId },
      });
      if (existingCpf) throw new ConflictException('CPF ja esta em uso');
    }

    // Verificar phone unico no tenant
    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone, tenantId: link.tenantId },
      });
      if (existingPhone) throw new ConflictException('Telefone ja esta em uso');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Criar usuario e incrementar contador em transacao
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          name: dto.name,
          tenantId: link.tenantId,
          customRoleId: link.customRoleId,
          status: Status.ACTIVE,
          cpf,
          cnpj,
          phone,
        },
        include: {
          customRole: { select: { id: true, roleType: true, name: true } },
        },
      });

      // Incrementar contador atomicamente
      await tx.publicLink.update({
        where: { id: link.id },
        data: { registrationCount: { increment: 1 } },
      });

      return created;
    });

    // Gerar tokens
    const tokens = await this.authService.generateTokensForUser({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      customRoleId: user.customRoleId,
      customRole: user.customRole,
    });

    this.logger.log(`Usuario registrado via link publico: ${user.email} (link: ${link.name})`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        customRoleId: user.customRoleId,
        customRole: user.customRole,
      },
    };
  }

  async publicLogin(slug: string, dto: PublicLoginDto) {
    const link = await this.prisma.publicLink.findUnique({
      where: { slug },
      include: {
        customRole: { select: { id: true, roleType: true, permissions: true } },
        entity: { select: { slug: true } },
        tenant: { select: { status: true } },
      },
    });

    if (!link) throw new NotFoundException('Link nao encontrado');
    this.validateLinkActive(link);

    // Fix #5: Verificar status do tenant
    if (link.tenant.status !== Status.ACTIVE) {
      throw new BadRequestException('Tenant inativo');
    }

    // Identificar tipo de login
    const identifier = dto.identifier.trim();
    const cleaned = identifier.replace(/\D/g, '');
    const roleInclude = { customRole: { select: { id: true, roleType: true, name: true, permissions: true, modulePermissions: true, tenantId: true } } };

    let user;

    if (identifier.includes('@')) {
      // Login por email (normalizado para lowercase)
      user = await this.prisma.user.findFirst({
        where: { email: identifier.toLowerCase(), tenantId: link.tenantId, status: Status.ACTIVE },
        include: roleInclude,
      });
    } else {
      // Digitos puros: pode ser CPF (11), telefone (10-11) ou outro
      // Uma unica query com OR cobre todos os casos
      user = await this.prisma.user.findFirst({
        where: {
          tenantId: link.tenantId,
          status: Status.ACTIVE,
          OR: [
            { cpf: cleaned },
            { phone: cleaned },
          ],
        },
        include: roleInclude,
      });
    }

    if (!user) {
      throw new BadRequestException('Credenciais invalidas');
    }

    // Validar senha
    const validPassword = await bcrypt.compare(dto.password, user.password);
    if (!validPassword) {
      throw new BadRequestException('Credenciais invalidas');
    }

    // Acumular permissoes: se a role do usuario nao tem permissao para a entidade do link, adicionar
    await this.accumulatePermissions(user, link.entity.slug);

    // Atualizar ultimo login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Re-buscar usuario com permissoes atualizadas
    const updatedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { customRole: { select: { id: true, roleType: true, name: true } } },
    });

    // Gerar tokens
    const tokens = await this.authService.generateTokensForUser({
      id: updatedUser.id,
      email: updatedUser.email,
      tenantId: updatedUser.tenantId,
      customRoleId: updatedUser.customRoleId,
      customRole: updatedUser.customRole,
    });

    return {
      ...tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        tenantId: updatedUser.tenantId,
        customRoleId: updatedUser.customRoleId,
        customRole: updatedUser.customRole,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async autoCreateRole(tenantId: string, entitySlug: string, entityName: string) {
    const roleName = `Publico - ${entityName}`;

    // Buscar role existente
    const existing = await this.prisma.customRole.findFirst({
      where: { tenantId, name: roleName },
    });
    if (existing) return existing;

    // Criar CUSTOM role com permissoes minimas
    return this.prisma.customRole.create({
      data: {
        tenantId,
        name: roleName,
        description: `Role criada automaticamente para link publico de ${entityName}`,
        roleType: 'CUSTOM',
        isSystem: false,
        permissions: [
          {
            entitySlug,
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: false,
            scope: 'own',
          },
        ],
        modulePermissions: {},
      },
    });
  }

  private async accumulatePermissions(user: any, entitySlug: string) {
    const currentPermissions = (user.customRole.permissions || []) as any[];

    // Verificar se ja tem permissao para esta entidade
    const hasPermission = currentPermissions.some(
      (p: any) => p.entitySlug === entitySlug,
    );

    if (hasPermission) return; // Ja tem acesso

    // Fix #1: Verificar se a role é compartilhada (usada por outros usuarios)
    const roleUserCount = await this.prisma.user.count({
      where: { customRoleId: user.customRoleId },
    });

    const newPermission = {
      entitySlug,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: false,
      scope: 'own',
    };

    if (roleUserCount > 1) {
      // Role compartilhada — clonar para role pessoal
      const clonedRole = await this.prisma.customRole.create({
        data: {
          tenantId: user.customRole.tenantId,
          name: `${user.customRole.name} - ${user.name || user.email}`,
          description: `Role pessoal clonada de "${user.customRole.name}"`,
          roleType: user.customRole.roleType,
          isSystem: false,
          permissions: [...currentPermissions, newPermission],
          modulePermissions: user.customRole.modulePermissions || {},
        },
      });

      // Reatribuir usuario para a role clonada
      await this.prisma.user.update({
        where: { id: user.id },
        data: { customRoleId: clonedRole.id },
      });

      this.logger.log(`Role clonada para ${user.email}: ${clonedRole.name} (role original compartilhada)`);
    } else {
      // Role exclusiva deste usuario — pode atualizar diretamente
      const updatedPermissions = [...currentPermissions, newPermission];

      await this.prisma.customRole.update({
        where: { id: user.customRoleId },
        data: { permissions: updatedPermissions },
      });

      this.logger.log(`Permissao acumulada: ${user.email} agora tem acesso a ${entitySlug}`);
    }
  }

  private validateLinkActive(link: { isActive: boolean; expiresAt: Date | null; maxUsers: number | null; registrationCount: number }) {
    if (!link.isActive) {
      throw new BadRequestException('Este link esta desativado');
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException('Este link expirou');
    }
    // maxUsers so bloqueia registro, nao login
  }

  private validateCpf(cpf: string): boolean {
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // Todos iguais

    // Calcular digitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
  }
}
