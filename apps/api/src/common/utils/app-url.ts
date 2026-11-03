/** Endereco publico do web-admin, para links em e-mails (convite, nova senha). */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const firstOrigin = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  return (firstOrigin && firstOrigin !== '*' ? firstOrigin : 'http://localhost:3000').replace(/\/+$/, '');
}
