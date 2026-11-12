'use client';

import type { CustomDomainBrand } from '@/lib/custom-domain';
import { useBrandFavicon } from '@/lib/use-brand-favicon';

/**
 * Login no dominio proprio da empresa: so a marca dela (logo, nome, cor), sem nada do
 * CRM Builder. O formulario e o mesmo do login normal.
 */
export function BrandedAuthShell({ brand, children }: { brand: CustomDomainBrand; children: React.ReactNode }) {
  const color = brand.brandColor || '#0f172a';
  useBrandFavicon(brand.logo);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10"
      style={{ backgroundImage: `radial-gradient(circle at top, color-mix(in srgb, ${color} 14%, transparent), transparent 60%)` }}>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8" data-testid="branded-login">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt={brand.name} className="h-16 w-auto max-w-[200px] object-contain" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white" style={{ backgroundColor: color }}>
              {brand.name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="text-lg font-semibold">{brand.name}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
