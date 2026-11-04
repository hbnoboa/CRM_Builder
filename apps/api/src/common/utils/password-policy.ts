import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

/** Politica de senha e de acesso da empresa (Tenant.settings.security). */
export interface TenantSecurity {
  requireMfa: boolean;
  passwordMinLength: number;
  passwordRequireSymbol: boolean;
}

export const DEFAULT_SECURITY: TenantSecurity = { requireMfa: false, passwordMinLength: 8, passwordRequireSymbol: false };

export function securityOf(settings: unknown): TenantSecurity {
  const raw = ((settings ?? {}) as { security?: Partial<TenantSecurity> }).security ?? {};
  return {
    requireMfa: raw.requireMfa === true,
    passwordMinLength: Math.min(64, Math.max(8, Number(raw.passwordMinLength) || 8)),
    passwordRequireSymbol: raw.passwordRequireSymbol === true,
  };
}

/** Regra base (todas as empresas) + a politica mais rigida entre as empresas informadas. */
export async function assertPasswordPolicy(prisma: PrismaService, tenantIds: string[], password: string): Promise<void> {
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { settings: true } })
    : [];
  const policy = tenants.map((t) => securityOf(t.settings)).reduce(
    (acc, p) => ({
      ...acc,
      passwordMinLength: Math.max(acc.passwordMinLength, p.passwordMinLength),
      passwordRequireSymbol: acc.passwordRequireSymbol || p.passwordRequireSymbol,
    }),
    DEFAULT_SECURITY,
  );
  const problems: string[] = [];
  if (password.length < policy.passwordMinLength) problems.push(`no minimo ${policy.passwordMinLength} caracteres`);
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push('letras maiusculas e minusculas');
  if (!/\d/.test(password)) problems.push('um numero');
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) problems.push('um simbolo (ex.: ! @ #)');
  if (problems.length) {
    throw new BadRequestException({ code: 'PASSWORD_POLICY', message: `A senha precisa ter ${problems.join(', ')}.` });
  }
}
