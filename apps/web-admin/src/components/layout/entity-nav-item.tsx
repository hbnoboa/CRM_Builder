'use client';

import {
  AlertTriangle, Boxes, Briefcase, Building, Building2, Calendar, CalendarCheck, Camera, Car, CheckSquare, ClipboardCheck,
  ClipboardList, Cog, Cpu, Database, DollarSign, Dog, Factory, FileText, FileWarning, FolderKanban, GraduationCap, Hammer,
  Handshake, Headset, HeartPulse, House, Leaf, LifeBuoy, ListChecks, ListTodo, Mail, MapPin, Megaphone, Package, Phone,
  Receipt, Scissors, ShieldAlert, ShoppingCart, Star, Stethoscope, Store, Tag, Target, Ticket, TicketCheck, Timer, Truck,
  UserCheck, UserRound, Users, Utensils, Wrench, type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { cn } from '@/lib/utils';

/**
 * Icones das tabelas (modelos, assistente de IA e editor). Importados um a um para
 * nao levar a biblioteca inteira para todas as telas.
 */
const ENTITY_ICONS: Record<string, LucideIcon> = {
  AlertTriangle, Boxes, Briefcase, Building, Building2, Calendar, CalendarCheck, Camera, Car, CheckSquare, ClipboardCheck,
  ClipboardList, Cog, Cpu, Database, DollarSign, Dog, Factory, FileText, FileWarning, FolderKanban, GraduationCap, Hammer,
  Handshake, Headset, HeartPulse, House, Leaf, LifeBuoy, ListChecks, ListTodo, Mail, MapPin, Megaphone, Package, Phone,
  Receipt, Scissors, ShieldAlert, ShoppingCart, Star, Stethoscope, Store, Tag, Target, Ticket, TicketCheck, Timer, Truck,
  UserCheck, UserRound, Users, Utensils, Wrench,
};

export function entityIconFor(name?: string | null): LucideIcon {
  return (name && ENTITY_ICONS[name]) || Database;
}

interface EntityNavItemProps {
  href: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  count?: number;
  active: boolean;
  onClick?: () => void;
  /** Barra recolhida: so o icone. */
  compact?: boolean;
  /** Tabela de dentro de outra (ex.: Sinistros dentro de Segurados): recuada e menor. */
  nested?: boolean;
}

/**
 * Tabela no menu: icone na cor da tabela, nome legivel e quantidade de registros.
 * A ativa fica destacada na cor da empresa.
 */
export function EntityNavItem({ href, name, icon, color, count, active, onClick, compact, nested }: EntityNavItemProps) {
  const Icon = entityIconFor(icon);
  const tint = color || 'hsl(var(--primary))';
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      title={compact ? name : undefined}
      className={cn(
        'group flex min-w-0 items-center rounded-lg transition-colors',
        compact ? 'h-10 w-full justify-center' : nested ? 'ml-5 min-h-[38px] gap-2.5 px-2 py-1' : 'min-h-[44px] gap-3 px-2 py-1.5',
        active ? 'bg-primary/10 text-foreground ring-1 ring-inset ring-primary/25' : 'text-foreground/80 hover:bg-muted hover:text-foreground',
      )}
      data-testid="nav-entity"
    >
      <span
        className={cn('flex shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-105', nested ? 'h-6 w-6' : 'h-8 w-8')}
        style={active
          ? { backgroundColor: tint, color: '#fff' }
          : { backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
      >
        <Icon className={nested ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </span>
      {!compact && (
        <>
          <span className={cn('flex-1 truncate', nested ? 'text-[13px]' : 'text-sm', active ? 'font-semibold' : 'font-medium')}>{name}</span>
          {count !== undefined && (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {count}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
