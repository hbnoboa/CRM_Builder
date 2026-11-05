import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, UpdateMyTenantDto } from './dto/tenant.dto';
import { Status, Prisma, TenantLifecycle } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_ROLE_TEMPLATES, type DefaultRoleKey } from '../../common/utils/default-roles';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { recordLifecycleEvent } from '../../common/utils/tenant-lifecycle-events';

// Slugs que colidem com rotas do web-admin (/{locale}/{slug}/...) ou da API.
export const RESERVED_TENANT_SLUGS = new Set([
  'admin', 'api', 'app', 'p', 'login', 'register', 'signup', 'forgot-password',
  'platform', 'home', 'www', 'dashboard', 'settings', 'profile',
  // paginas publicas do site (pagina inicial)
  'contato', 'solucoes', 'precos', 'invite', 'reset-password', 'security-setup',
]);

/** Campos comerciais definidos na criacao (console da plataforma / cadastro). */
export interface CreateTenantOptions {
  planId?: string | null;
  lifecycle?: TenantLifecycle;
  trialEndsAt?: Date | null;
  /** Quem criou (historico comercial): cadastro self-service ou console. */
  source?: 'signup' | 'console';
  staffId?: string;
}

@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /** Cria os cargos padrao (DEFAULT_ROLE_TEMPLATES) no idioma da requisicao. */
  private async createDefaultRoles(tx: Prisma.TransactionClient, tenantId: string) {
    const created = {} as Record<DefaultRoleKey, { id: string }>;
    for (const tpl of DEFAULT_ROLE_TEMPLATES) {
      created[tpl.key] = await tx.customRole.create({
        data: {
          tenantId,
          name: this.i18n.t(`tenant.roles.${tpl.key}.name`),
          description: this.i18n.t(`tenant.roles.${tpl.key}.description`),
          color: tpl.color,
          rank: tpl.rank,
          isSystem: false,
          isDefault: tpl.isDefault,
          modulePermissions: tpl.modulePermissions,
          permissions: tpl.permissions,
        },
        select: { id: true },
      });
    }
    return created;
  }

  async create(dto: CreateTenantDto, options: CreateTenantOptions = {}) {
    if (RESERVED_TENANT_SLUGS.has(dto.slug)) {
      throw new BadRequestException(`Slug reservado: ${dto.slug}`);
    }

    // Verificar se slug ja existe
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(this.i18n.t('tenant.slugAlreadyExists'));
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      // 1. Criar tenant
      const createdTenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          domain: dto.domain,
          logo: dto.logo,
          planId: options.planId ?? undefined,
          lifecycle: options.lifecycle,
          trialEndsAt: options.trialEndsAt ?? undefined,
        },
      });

      await recordLifecycleEvent(tx, {
        tenantId: createdTenant.id,
        from: null,
        to: createdTenant.lifecycle,
        source: options.source ?? 'console',
        staffId: options.staffId,
      });

      // 2. Cargos padrao (mesmos nomes e niveis em toda empresa)
      const roles = await this.createDefaultRoles(tx, createdTenant.id);

      // 3. Admin inicial = dono da empresa, no cargo Administrador
      if (dto.adminEmail && dto.adminPassword && dto.adminName) {
        const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);

        const createdAdmin = await tx.user.create({
          data: {
            email: dto.adminEmail,
            password: hashedPassword,
            name: dto.adminName,
            status: Status.ACTIVE,
          },
        });

        // Membership home (primaria) — fonte da verdade do vinculo + cargo (#10).
        await tx.userTenantAccess.create({
          data: {
            userId: createdAdmin.id,
            tenantId: createdTenant.id,
            customRoleId: roles.admin.id,
            status: Status.ACTIVE,
            isPrimary: true,
          },
        });

        return tx.tenant.update({ where: { id: createdTenant.id }, data: { ownerId: createdAdmin.id } });
      }

      return createdTenant;
    });

    return tenant;
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userTenantAccess: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(this.i18n.t('tenant.notFound'));
    }

    return tenant;
  }

  /** Nome, logo e tema da empresa, editados pela administracao da propria empresa. */
  async updateMine(tenantId: string, dto: UpdateMyTenantDto) {
    const tenant = await this.findOne(tenantId);
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const theme = { ...((settings.theme ?? {}) as Record<string, unknown>) };
    if (dto.brandColor !== undefined) {
      if (dto.brandColor === null) delete theme.brandColor;
      else theme.brandColor = dto.brandColor.toLowerCase();
    }
    if (dto.darkMode !== undefined) theme.darkMode = dto.darkMode;

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        settings: { ...settings, theme } as Prisma.InputJsonValue,
      },
    });
    return {
      before: { name: tenant.name, logo: tenant.logo, theme: settings.theme ?? null },
      after: { name: updated.name, logo: updated.logo, theme },
      tenant: updated,
    };
  }

  /** O dono passa a empresa para outro membro ativo com acesso total. */
  async transferOwnership(tenantId: string, currentUserId: string, newOwnerId: string) {
    const tenant = await this.findOne(tenantId);
    if (tenant.ownerId !== currentUserId) {
      throw new ForbiddenException('So o dono da empresa pode transferir a propriedade');
    }
    if (newOwnerId === currentUserId) return { ownerId: newOwnerId };
    const membership = await this.prisma.userTenantAccess.findFirst({
      where: {
        tenantId, userId: newOwnerId, deletedAt: null, status: Status.ACTIVE,
        user: { deletedAt: null, status: Status.ACTIVE },
      },
      select: { customRole: { select: { modulePermissions: true } } },
    });
    if (!membership) throw new BadRequestException('O novo dono precisa ser um membro ativo da empresa');
    if (!hasFullTenantAccess(membership.customRole.modulePermissions)) {
      throw new BadRequestException('O novo dono precisa estar num cargo com acesso total (ex.: Administrador)');
    }
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { ownerId: newOwnerId } });
    return { ownerId: newOwnerId };
  }

  // Gestao de tenants (listar/editar/suspender/excluir/estatisticas) vive no console
  // da plataforma (modules/platform); aqui ficam so create() e findOne().
}
