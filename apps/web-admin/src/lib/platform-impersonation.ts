// Impersonacao iniciada pelo console da plataforma (/admin).
//
// Usa as mesmas chaves da impersonacao feita dentro do tenant (auth-store):
// a sessao de tenant que ja existir no navegador vai para impersonationBackup,
// o banner aparece via impersonatedBy, e impersonationOrigin diz ao banner que
// "sair" volta para o console em vez de restaurar um admin de tenant.

export const IMPERSONATION_ORIGIN_KEY = 'impersonationOrigin';

export interface PlatformImpersonationOrigin {
  type: 'platform';
  tenantId: string;
}

export function startPlatformImpersonation(
  session: {
    accessToken: string;
    refreshToken: string;
    impersonatedBy: { id: string; name: string };
    user: { tenantId: string; tenant: { slug: string } };
  },
  locale: string,
): void {
  if (!localStorage.getItem('impersonationBackup') && localStorage.getItem('accessToken')) {
    localStorage.setItem(
      'impersonationBackup',
      JSON.stringify({
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        activeTenantId: localStorage.getItem('activeTenantId'),
      }),
    );
  }
  localStorage.setItem('accessToken', session.accessToken);
  localStorage.setItem('refreshToken', session.refreshToken);
  localStorage.setItem('activeTenantId', session.user.tenantId);
  localStorage.setItem('impersonatedBy', JSON.stringify(session.impersonatedBy));
  localStorage.setItem(
    IMPERSONATION_ORIGIN_KEY,
    JSON.stringify({ type: 'platform', tenantId: session.user.tenantId } satisfies PlatformImpersonationOrigin),
  );
  window.location.href = `/${locale}/${session.user.tenant.slug}/home`;
}

export function readImpersonationOrigin(): PlatformImpersonationOrigin | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_ORIGIN_KEY);
    const parsed = raw ? (JSON.parse(raw) as PlatformImpersonationOrigin) : null;
    return parsed?.type === 'platform' ? parsed : null;
  } catch {
    return null;
  }
}
