import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '../utils/plan-features';

export const REQUIRE_FEATURE_KEY = 'require_feature';

/**
 * Marca o controller/rota como pertencente a uma funcao do plano. Se a funcao
 * estiver desligada para o tenant do usuario, o TenantFeatureInterceptor
 * responde 403 FEATURE_DISABLED.
 */
export const RequireFeature = (feature: FeatureKey) => SetMetadata(REQUIRE_FEATURE_KEY, feature);
