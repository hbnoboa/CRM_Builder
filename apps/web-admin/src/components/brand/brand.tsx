import { cn } from '@/lib/utils';

/** Marca do CRM Builder: blocos montados (o sistema que voce monta). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8', className)}>
      <rect width="32" height="32" rx="8" fill="#ea580c" />
      <rect x="7" y="7" width="8" height="8" rx="2" fill="#fff" />
      <rect x="17" y="7" width="8" height="8" rx="2" fill="#fff" fillOpacity="0.55" />
      <rect x="7" y="17" width="18" height="8" rx="2" fill="#fff" />
    </svg>
  );
}

/** inverted: texto branco (fundo escuro); fixedDark: sempre escuro (paginas publicas de fundo branco). */
export function BrandLogo({ className, inverted = false, fixedDark = false }: { className?: string; inverted?: boolean; fixedDark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark />
      <span className={cn('text-lg font-bold tracking-tight', inverted ? 'text-white' : fixedDark ? 'text-slate-900' : 'text-foreground')}>
        CRM Builder
      </span>
    </span>
  );
}

/** Assinatura "powered by IOS System" com o logo da IOS. */
export function PoweredByIos({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs', inverted ? 'text-white/70' : 'text-slate-500', className)}>
      powered by
      <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-1.5 py-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ios-logo.png" alt="IOS" className="h-3.5 w-auto" />
        <span className="font-semibold text-slate-700">System</span>
      </span>
    </span>
  );
}
