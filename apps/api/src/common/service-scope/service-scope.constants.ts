/**
 * SERVICE_SCOPE — separacao de ambiente admin x user (#18).
 *
 * O MESMO binario/imagem roda em containers separados; a env SERVICE_SCOPE
 * decide quais rotas cada container expoe:
 *   - 'admin' : ambiente de gestao/criacao (tenants, cargos, usuarios, pdf,
 *               dashboards, automacoes, auditoria, lifecycle...). Container
 *               privado (VPN/IP allowlist), pode ter credencial de DB privilegiada.
 *   - 'user'  : ambiente operacional (dados/registros, sync/PowerSync, formularios
 *               publicos). Container exposto/escalavel; NAO expoe a superficie admin.
 *   - 'all'   : monolito unico (dev/local e deploy single-container). Tudo ligado.
 *
 * Rotas sao classificadas por @ServiceScope(...) (default = compartilhada).
 * Em scope != 'all', rota fora do ambiente responde 404 (esconde a existencia).
 */
export type ServiceScopeValue = 'admin' | 'user' | 'all';

export const SERVICE_SCOPE_KEY = 'service_scope';

export function currentServiceScope(): ServiceScopeValue {
  const v = (process.env.SERVICE_SCOPE || 'all').toLowerCase();
  return v === 'admin' || v === 'user' ? v : 'all';
}
