import { cn } from '@/lib/utils';

/**
 * Estado vazio: icone, titulo (o que acontece), descricao (por que / o que fazer)
 * e uma acao principal. Nunca beco sem saida. `message` mantem o uso antigo.
 */
export function EmptyState({
  message,
  title,
  description,
  icon,
  action,
  className,
}: {
  message?: string;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  if (message && !title) {
    return (
      <div className={cn('flex h-32 flex-col items-center justify-center text-muted-foreground', className)}>
        <span className="text-lg">{message}</span>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)} data-testid="empty-state">
      {icon && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-nav-active text-nav-active-foreground">
          {icon}
        </span>
      )}
      {title && <p className="text-sm font-semibold">{title}</p>}
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
