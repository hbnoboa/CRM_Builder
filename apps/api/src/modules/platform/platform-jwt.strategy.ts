import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { PlatformStaffPrincipal } from './platform-permissions';

export const PLATFORM_JWT_AUDIENCE = 'platform';

export interface PlatformJwtPayload {
  sub: string;
  typ: 'platform';
}

/** Segredo do token da equipe. Sem PLATFORM_JWT_SECRET, cai no JWT_SECRET —
 *  a audience diferente ('platform' x 'powersync') ja impede um token valer no outro. */
export function platformJwtSecret(config: ConfigService): string {
  return config.get<string>('PLATFORM_JWT_SECRET') || (config.get<string>('JWT_SECRET') as string);
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: platformJwtSecret(config),
      audience: PLATFORM_JWT_AUDIENCE,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformStaffPrincipal> {
    if (payload.typ !== 'platform') throw new UnauthorizedException();
    // Recarrega a cada request: desativar/rebaixar um staff vale na hora.
    const staff = await this.prisma.platformStaff.findFirst({
      where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!staff) throw new UnauthorizedException('Acesso da equipe revogado');
    return staff;
  }
}

export class PlatformAuthGuard extends AuthGuard('platform-jwt') {}
