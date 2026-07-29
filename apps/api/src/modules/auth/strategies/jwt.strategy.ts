import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload, CurrentUser } from '../../../common/types/auth.types';
import { hasPlatformAccess } from '../../../common/utils/platform-access';

type RoleSel = {
  id: string;
  name: string;
  isSystem: boolean;
  rank: number;
  permissions: unknown;
  modulePermissions: unknown;
  tenantPermissions: unknown;
};

const ROLE_SELECT = {
  id: true,
  name: true,
  isSystem: true,
  rank: true,
  permissions: true,
  modulePermissions: true,
  tenantPermissions: true,
} as const;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      audience: 'powersync',
      // Necessario para resolver o tenant a partir do contexto da request
      // (header X-Tenant-Id agora; segmento de URL no frontend depois — Modelo B).
      passReqToCallback: true,
    });
  }

  private buildCurrentUser(
    user: { id: string; email: string; name: string },
    tenantId: string,
    customRoleId: string,
    role: RoleSel,
    impersonatedBy?: { id: string; name: string },
  ): CurrentUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId,
      customRoleId,
      ...(impersonatedBy ? { impersonatedBy } : {}),
      customRole: {
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        rank: role.rank,
        permissions: role.permissions as unknown[],
        modulePermissions: role.modulePermissions as Record<string, boolean>,
        tenantPermissions: role.tenantPermissions as Record<string, unknown>,
      },
    };
  }

  async validate(req: Request, payload: JwtPayload): Promise<CurrentUser> {
    // IDENTIDADE GLOBAL (#10): User e so identidade. Tenant + cargo vem das
    // memberships (UserTenantAccess). Carregamos as memberships ativas com os cargos.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        tenantAccess: {
          where: { deletedAt: null, status: 'ACTIVE' },
          select: {
            tenantId: true,
            customRoleId: true,
            isPrimary: true,
            expiresAt: true,
            customRole: { select: ROLE_SELECT },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario nao encontrado ou inativo');
    }

    const memberships = user.tenantAccess;
    const primary = memberships.find((m) => m.isPrimary) ?? memberships[0];

    // Tenant na URL (Modelo B): o front manda X-Tenant-Slug (segmento [tenant]);
    // resolvemos slug -> id no servidor. Fallback: X-Tenant-Id -> token -> primária.
    const headerSlug = req?.headers?.['x-tenant-slug'];
    let slugTenantId: string | undefined;
    if (typeof headerSlug === 'string' && headerSlug) {
      const bySlug = await this.prisma.tenant.findFirst({
        where: { slug: headerSlug, deletedAt: null },
        select: { id: true },
      });
      slugTenantId = bySlug?.id;
    }
    const headerTenant = req?.headers?.['x-tenant-id'];
    const requestedTenantId =
      slugTenantId ||
      (typeof headerTenant === 'string' && headerTenant) ||
      payload.tenantId ||
      primary?.tenantId ||
      undefined;

    if (!requestedTenantId) {
      throw new UnauthorizedException('Tenant nao resolvido');
    }

    // FONTE DA VERDADE: membership do (usuario, tenant solicitado).
    const membership = memberships.find((m) => m.tenantId === requestedTenantId);

    if (membership) {
      if (membership.expiresAt && membership.expiresAt < new Date()) {
        throw new UnauthorizedException('Acesso ao tenant expirado');
      }
      return this.buildCurrentUser(
        user,
        requestedTenantId,
        membership.customRoleId,
        membership.customRole as RoleSel,
        payload.impersonatedBy,
      );
    }

    // Sem membership no tenant solicitado: acesso de PLATAFORMA (cross-tenant)
    // vale se QUALQUER membership do usuario tiver platform.* (equipe SegMob).
    const platformMembership = memberships.find((m) =>
      hasPlatformAccess(m.customRole.modulePermissions),
    );
    if (platformMembership) {
      return this.buildCurrentUser(
        user,
        requestedTenantId,
        platformMembership.customRoleId,
        platformMembership.customRole as RoleSel,
        payload.impersonatedBy,
      );
    }

    throw new UnauthorizedException('Sem acesso a este tenant');
  }
}
