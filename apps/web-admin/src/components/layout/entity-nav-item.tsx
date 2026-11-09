'use client';

import {
  AlertTriangle, Boxes, Briefcase, Building, Building2, Calendar, CalendarCheck, Camera, Car, CheckSquare, ClipboardCheck,
  ClipboardList, Cog, Cpu, Database, DollarSign, Dog, Factory, FileText, FileWarning, FolderKanban, GraduationCap, Hammer,
  Handshake, Headset, HeartPulse, House, Leaf, LifeBuoy, ListChecks, ListTodo, Mail, MapPin, Megaphone, Package, Phone,
  Receipt, Scissors, ShieldAlert, ShoppingCart, Star, Stethoscope, Store, Tag, Target, Ticket, TicketCheck, Timer, Truck,
  UserCheck, UserRound, Users, Utensils, Wrench, type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { navItemClass } from '@/components/layout/shell-parts';
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
  /** Cor da tabela: so no editor e nos graficos; no menu o icone e monocromatico. */
  color?: string | null;
  count?: number;
  active: boolean;
  onClick?: () => void;
  /** Barra recolhida: so o icone. */
  compact?: boolean;
  /** Tabela de dentro de outra (ex.: Sinistros dentro de Segurados): menor, na arvore. */
  nested?: boolean;
}

/**
 * Tabela no menu: icone monocromatico, nome e quantidade de registros discreta.
 * A ativa ganha o filete na cor da empresa (mesmo padrao dos outros itens).
 */
export function EntityNavItem({ href, name, icon, count, active, onClick, compact, nested }: EntityNavItemProps) {
  const Icon = entityIconFor(icon);
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      title={compact ? name : undefined}
      className={cn(
        navItemClass(active, compact ? 'w-full justify-center px-0' : undefined),
        nested && 'min-h-[38px] gap-2.5 text-[13px] lg:min-h-[32px]',
      )}
      data-testid="nav-entity"
    >
      <Icon className={nested ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} />
      {!compact && (
        <>
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {count !== undefined && (
            <span className={cn('text-[11px] font-medium tabular-nums', active ? 'text-foreground/70' : 'text-muted-foreground/80')}>
              {count.toLocaleString('pt-BR')}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
