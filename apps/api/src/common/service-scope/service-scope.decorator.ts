import { SetMetadata } from '@nestjs/common';
import { SERVICE_SCOPE_KEY, ServiceScopeValue } from './service-scope.constants';

/**
 * Marca um controller (ou rota) como pertencente a um ambiente especifico.
 * Sem o decorator, a rota e compartilhada (disponivel em qualquer scope).
 *
 *   @ServiceScope('admin')  // some no container 'user'
 *   @ServiceScope('user')   // some no container 'admin'
 */
export const ServiceScope = (scope: ServiceScopeValue) =>
  SetMetadata(SERVICE_SCOPE_KEY, scope);
