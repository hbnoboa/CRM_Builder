import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload, CurrentUser } from '../../../common/types/auth.types';

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
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        tenantId: true,
        customRoleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
            roleType: true,
            isSystem: true,
            permissions: true,
            modulePermissions: true,
            tenantPermissions: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario nao encontrado ou inativo');
    }

    if (!user.customRole || !user.customRoleId) {
      throw new UnauthorizedException('Usuario sem role definida');
    }

    // Se o tenantId do token e diferente do home tenant, validar via UserTenantAccess
    if (payload.tenantId && payload.tenantId !== user.tenantId) {
      const access = await this.prisma.userTenantAccess.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: payload.tenantId,
          },
        },
        include: {
          customRole: {
            select: {
              id: true,
              name: true,
              roleType: true,
              isSystem: true,
              permissions: true,
              modulePermissions: true,
              tenantPermissions: true,
            },
          },
        },
      });

      if (!access || access.status !== 'ACTIVE') {
        throw new UnauthorizedException('Token tenant mismatch');
      }

      // Verificar expiracao
      if (access.expiresAt && access.expiresAt < new Date()) {
        throw new UnauthorizedException('Acesso ao tenant expirado');
      }

      // Retornar CurrentUser com o tenant e role do acesso
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: payload.tenantId,
        customRoleId: access.customRoleId,
        customRole: {
          id: access.customRole.id,
          name: access.customRole.name,
          roleType: access.customRole.roleType as CurrentUser['customRole']['roleType'],
          isSystem: access.customRole.isSystem,
          permissions: access.customRole.permissions as unknown[],
          modulePermissions: access.customRole.modulePermissions as Record<string, boolean>,
          tenantPermissions: access.customRole.tenantPermissions as Record<string, unknown>,
        },
      };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      customRoleId: user.customRoleId,
      customRole: {
        id: user.customRole.id,
        name: user.customRole.name,
        roleType: user.customRole.roleType as CurrentUser['customRole']['roleType'],
        isSystem: user.customRole.isSystem,
        permissions: user.customRole.permissions as unknown[],
        modulePermissions: user.customRole.modulePermissions as Record<string, boolean>,
        tenantPermissions: user.customRole.tenantPermissions as Record<string, unknown>,
      },
    };
  }
}
