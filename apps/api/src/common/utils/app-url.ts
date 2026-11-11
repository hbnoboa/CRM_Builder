/** Endereco publico do web-admin, para links em e-mails (convite, nova senha). */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const firstOrigin = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  return (firstOrigin && firstOrigin !== '*' ? firstOrigin : 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Endereco para links de uma empresa (convite, nova senha): o dominio proprio principal
 * dela, se estiver conectado (Site da empresa › Domínio próprio); senao, o da plataforma.
 */
export async function tenantAppUrl(
  prisma: { tenantDomain: { findFirst: (args: object) => Promise<{ hostname: string } | null> } },
  tenantId: string,
): Promise<string> {
  const d = await prisma.tenantDomain.findFirst({ where: { tenantId, isPrimary: true, status: 'active' }, select: { hostname: true } });
  return d ? `https://${d.hostname}` : appUrl();
}
