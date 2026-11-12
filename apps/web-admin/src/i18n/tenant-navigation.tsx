'use client';

/**
 * Navegação ciente de tenant (#15 robusto): envolve o next-intl navigation e
 * prefixa automaticamente o segmento [tenant] da URL atual. Assim os componentes
 * do dashboard mantêm `href="/users"` e viram `/{locale}/{tenant}/users` sem editar
 * cada link — basta trocar o import de `@/i18n/navigation` para este módulo.
 */
import { forwardRef } from 'react';
import { useParams } from 'next/navigation';
import * as intlNav from '@/i18n/navigation';

type IntlLinkProps = React.ComponentProps<typeof intlNav.Link>;

function useTenant(): string | undefined {
  const params = useParams();
  const t = params?.tenant;
  return typeof t === 'string' ? t : Array.isArray(t) ? t[0] : undefined;
}

// Rotas FORA do escopo de tenant (auth/público) não recebem o prefixo.
const NON_TENANT_PREFIXES = ['/login', '/register', '/forgot-password', '/p'];

function prefixHref(href: string, tenant: string | undefined): string {
  if (!tenant) return href;
  if (typeof href !== 'string' || !href.startsWith('/')) return href;
  if (NON_TENANT_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`))) return href;
  if (href === `/${tenant}` || href.startsWith(`/${tenant}/`)) return href; // já prefixado
  return `/${tenant}${href}`;
}

export const Link = forwardRef<HTMLAnchorElement, IntlLinkProps>(function TenantLink(
  { href, ...props },
  ref,
) {
  const tenant = useTenant();
  const finalHref = typeof href === 'string' ? prefixHref(href, tenant) : href;
  return <intlNav.Link ref={ref} href={finalHref} {...props} />;
});

export function useRouter() {
  const router = intlNav.useRouter();
  const tenant = useTenant();
  return {
    ...router,
    push: (href: string, ...rest: unknown[]) => (router.push as (h: string, ...r: unknown[]) => void)(prefixHref(href, tenant), ...rest),
    replace: (href: string, ...rest: unknown[]) => (router.replace as (h: string, ...r: unknown[]) => void)(prefixHref(href, tenant), ...rest),
  };
}

/** Retorna o pathname SEM o prefixo do tenant (para detecção de link ativo igual antes). */
export function usePathname(): string {
  const pathname = intlNav.usePathname();
  const tenant = useTenant();
  if (tenant && (pathname === `/${tenant}` || pathname.startsWith(`/${tenant}/`))) {
    return pathname.slice(`/${tenant}`.length) || '/';
  }
  return pathname;
}

export const redirect = intlNav.redirect;
