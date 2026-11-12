import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  SERVICE_SCOPE_KEY,
  ServiceScopeValue,
  currentServiceScope,
} from './service-scope.constants';

/**
 * Guard GLOBAL de ambiente. Roda antes dos guards de rota (auth/permissao),
 * entao uma rota fora do ambiente responde 404 sem sequer revelar que exige auth.
 *
 * - scope 'all'  -> tudo liberado (monolito dev/local).
 * - rota sem @ServiceScope -> compartilhada (liberada em qualquer scope).
 * - rota marcada com scope diferente do atual -> 404 (some do ambiente).
 */
@Injectable()
export class ServiceScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const routeScope = this.reflector.getAllAndOverride<ServiceScopeValue | undefined>(
      SERVICE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!routeScope) return true; // compartilhada

    const scope = currentServiceScope();
    if (scope === 'all') return true; // monolito

    if (routeScope !== scope) {
      throw new NotFoundException();
    }
    return true;
  }
}
