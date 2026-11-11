import type { PrismaService } from '../../prisma/prisma.service';
import { isPlatformHost, normalizeHostname } from '../../modules/site-domains/domain-utils';

/**
 * Dominio proprio de empresa (Site da empresa › Domínio próprio): quem acessa o sistema
 * por ele so entra e so usa ESSA empresa. Aqui: qual empresa e dona do endereco da
 * requisicao (cabecalho Host, que o proxy repassa). Endereco da plataforma = null.
 * Guardado por 60 s para nao ir ao banco a cada requisicao.
 */
const cache = new Map<string, { tenantId: string | null; until: number }>();
const TTL = 60_000;

export function requestHost(req: { headers?: Record<string, unknown> } | undefined): string {
  const raw = req?.headers?.host;
  return typeof raw === 'string' ? raw : '';
}

export async function tenantIdForHost(prisma: PrismaService, rawHost: string): Promise<string | null> {
  const host = normalizeHostname(rawHost);
  if (!host || isPlatformHost(host)) return null;
  const hit = cache.get(host);
  if (hit && hit.until > Date.now()) return hit.tenantId;
  const domain = await prisma.tenantDomain.findUnique({ where: { hostname: host }, select: { tenantId: true, status: true } });
  const tenantId = domain && domain.status !== 'pending_dns' ? domain.tenantId : null;
  cache.set(host, { tenantId, until: Date.now() + TTL });
  return tenantId;
}
