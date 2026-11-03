import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';
import { TenantPlanService } from '../services/tenant-plan.service';
import type { CurrentUser } from '../types';
import type { FeatureKey } from '../utils/plan-features';

/**
 * Bloqueia rotas de funcoes desligadas no plano do tenant (@RequireFeature).
 * E interceptor (nao guard global) porque precisa do request.user, que so
 * existe depois dos guards de rota (JwtAuthGuard).
 * Rotas publicas (sem usuario) nao sao bloqueadas aqui.
 */
@Injectable()
export class TenantFeatureInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantPlan: TenantPlanService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return next.handle();

    const user = context.switchToHttp().getRequest<{ user?: CurrentUser }>().user;
    if (!user?.tenantId) return next.handle();

    return from(this.tenantPlan.isFeatureEnabled(user.tenantId, feature)).pipe(
      switchMap((enabled) => {
        if (!enabled) {
          throw new ForbiddenException({
            code: 'FEATURE_DISABLED',
            feature,
            message: 'Funcao nao disponivel no plano desta empresa',
          });
        }
        return next.handle();
      }),
    );
  }
}
