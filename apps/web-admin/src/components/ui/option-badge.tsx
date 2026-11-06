import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * Etiqueta de opcao (status, prioridade...) na cor definida na tabela:
 * ponto + fundo claro da cor + texto escurecido (clareado no modo escuro),
 * para qualquer cor manter leitura. Sem cor: etiqueta neutra.
 */
export function OptionBadge({ label, color, className }: { label: string; color?: string | null; className?: string }) {
  if (!color) {
    return (
      <span className={cn('inline-flex max-w-[200px] items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80', className)}>
        <span className="truncate">{label}</span>
      </span>
    );
  }
  return (
    <span
      style={{ '--opt': color } as CSSProperties}
      className={cn(
        'inline-flex max-w-[200px] items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        'bg-[color-mix(in_srgb,var(--opt)_14%,transparent)] text-[color-mix(in_srgb,var(--opt)_72%,black)]',
        'dark:bg-[color-mix(in_srgb,var(--opt)_22%,transparent)] dark:text-[color-mix(in_srgb,var(--opt)_55%,white)]',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--opt)]" />
      <span className="truncate">{label}</span>
    </span>
  );
}
