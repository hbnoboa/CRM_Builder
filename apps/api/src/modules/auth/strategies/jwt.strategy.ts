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

    // Validar que tenantId do token corresponde ao do usuario (defense-in-depth)
    if (payload.tenantId && payload.tenantId !== user.tenantId) {
      throw new UnauthorizedException('Token tenant mismatch');
    }

    if (!user.customRole || !user.customRoleId) {
      throw new UnauthorizedException('Usuario sem role definida');
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
