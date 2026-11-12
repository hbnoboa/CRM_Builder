import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CurrentUser } from '../types';

/**
 * Portal do cliente: recursos internos da equipe (chat, chamados de suporte da empresa)
 * nao abrem para quem entra como cliente. Usar depois do JwtAuthGuard.
 */
@Injectable()
export class NoClientPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: CurrentUser }>().user;
    if (user?.clientRecordId) throw new ForbiddenException('Não disponível no portal do cliente');
    return true;
  }
}
