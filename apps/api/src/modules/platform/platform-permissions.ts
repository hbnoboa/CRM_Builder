import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformStaffRole } from '@prisma/client';
import type { Request } from 'express';
import { clientIp } from '../../common/utils/client-ip';

/** Staff autenticado no console (req.user nas rotas /platform). */
export interface PlatformStaffPrincipal {
  id: string;
  email: string;
  name: string;
  role: PlatformStaffRole;
}

export interface PlatformRequest extends Request {
  user: PlatformStaffPrincipal;
}

const ALL: PlatformStaffRole[] = ['OWNER', 'SUPPORT', 'FINANCE', 'READONLY'];

// Matriz de permissoes da equipe. Fonte unica: o front recebe a lista do
// proprio staff em /platform/auth/me e so esconde botoes; a API decide.
export const PLATFORM_PERMISSIONS = {
  'overview.read': ALL,
  'tenants.read': ALL,
  'tenants.create': ['OWNER', 'SUPPORT'],
  'tenants.update': ['OWNER', 'SUPPORT'],
  'tenants.lifecycle': ['OWNER', 'FINANCE'],
  'tenants.plan': ['OWNER', 'FINANCE'],
  'tenants.features': ['OWNER', 'SUPPORT'],
  'tenants.impersonate': ['OWNER', 'SUPPORT'],
  'plans.read': ALL,
  'plans.manage': ['OWNER', 'FINANCE'],
  'staff.read': ['OWNER'],
  'staff.manage': ['OWNER'],
  'audit.read': ALL,
} satisfies Record<string, PlatformStaffRole[]>;

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS;

export function platformPermissionsFor(role: PlatformStaffRole): PlatformPermission[] {
  return (Object.keys(PLATFORM_PERMISSIONS) as PlatformPermission[]).filter((p) =>
    (PLATFORM_PERMISSIONS[p] as PlatformStaffRole[]).includes(role),
  );
}

const PLATFORM_PERMISSION_KEY = 'platform_permission';

export const RequirePlatformPermission = (permission: PlatformPermission) =>
  SetMetadata(PLATFORM_PERMISSION_KEY, permission);

@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<PlatformPermission | undefined>(
      PLATFORM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Rota de staff sem permissao declarada = erro de programacao: nega.
    if (!permission) throw new ForbiddenException('Rota da plataforma sem permissao declarada');

    const staff = context.switchToHttp().getRequest<PlatformRequest>().user;
    if (!staff) throw new ForbiddenException();
    if (!(PLATFORM_PERMISSIONS[permission] as PlatformStaffRole[]).includes(staff.role)) {
      throw new ForbiddenException(`Sem permissao: ${permission}`);
    }
    return true;
  }
}

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformStaffPrincipal =>
    ctx.switchToHttp().getRequest<PlatformRequest>().user,
);

export function requestIp(req: Request): string | undefined {
  return clientIp(req);
}
