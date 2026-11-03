import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard que valida isolamento multi-tenant
 *
 * Verifica se o usuario esta tentando acessar recursos do seu proprio tenant.
 * Nao ha excecao: acesso cross-tenant so existe no console da plataforma.
 *
 * Uso: @UseGuards(JwtAuthGuard, TenantGuard)
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario nao autenticado');
    }

    // Extrair tenantId da requisicao (params, query ou body)
    const requestTenantId = this.extractTenantId(request);

    // Se nao ha tenantId na requisicao, permitir (sera filtrado no service)
    if (!requestTenantId) {
      return true;
    }

    // Validar que o tenant da requisicao eh o mesmo do usuario
    if (requestTenantId !== user.tenantId) {
      throw new ForbiddenException(
        'Acesso negado: voce nao tem permissao para acessar recursos de outro tenant',
      );
    }

    return true;
  }

  private extractTenantId(request: any): string | null {
    // Verificar em params (ex: /tenants/:tenantId)
    if (request.params?.tenantId) {
      return request.params.tenantId;
    }

    // Verificar em query (ex: ?tenantId=xxx)
    if (request.query?.tenantId) {
      return request.query.tenantId;
    }

    // Verificar em body (ex: { tenantId: "xxx" })
    if (request.body?.tenantId) {
      return request.body.tenantId;
    }

    return null;
  }
}
