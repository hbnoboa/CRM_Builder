import type { CSSProperties } from 'react';
import { LayoutTemplate, LifeBuoy, ShieldAlert, Target, Truck, Wrench, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { ShieldAlert, Truck, Wrench, Target, LifeBuoy };

/** Icone do modelo de solucao (nome lucide vindo do catalogo). */
export function SolutionIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const Icon = ICONS[name] ?? LayoutTemplate;
  return <Icon className={className} style={style} aria-hidden="true" />;
}
