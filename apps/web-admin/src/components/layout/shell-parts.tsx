'use client';

/**
 * Pecas compartilhadas das molduras do app (principal, operacional e administracao):
 * item de menu, marca da empresa, menu do usuario, busca Ctrl+K e barra do topo.
 * Visual: neutros + cor da empresa so em acento (item ativo em tom suave, nunca bloco).
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  CircleDot, Laptop, LogOut, Menu, Moon, Plus, Search, Settings, Sun, User,
} from 'lucide-react';
import { useRouter } from '@/i18n/tenant-navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from '@/components/ui/command';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { TenantSelector } from '@/components/tenant-selector';
import { cn } from '@/lib/utils';

/** Classes do item de menu lateral (ativo em tom suave da marca). */
export function navItemClass(active: boolean, extra?: string) {
  return cn(
    'group flex items-center gap-3 rounded-md px-2.5 text-sm transition-colors min-h-[42px] lg:min-h-[36px]',
    active
      ? 'bg-nav-active text-nav-active-foreground font-medium'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    extra,
  );
}

/** Rotulo de grupo do menu (ex.: EQUIPE, ESTRUTURA). */
export function NavSectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70', className)}>
      {children}
    </p>
  );
}

/** Logo (ou inicial) e nome da empresa no topo do menu. */
export function SidebarBrand({ subtitle, hideText }: { subtitle?: React.ReactNode; hideText?: boolean }) {
  const { tenant } = useTenant();
  const name = tenant?.name || 'CRM Builder';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {tenant?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tenant.logo} alt={name} className="h-8 w-8 shrink-0 rounded-md object-contain" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          {name[0]?.toUpperCase()}
        </span>
      )}
      {!hideText && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
          {subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </div>
  );
}

/** Avatar com a inicial, no tom da marca. */
export function UserAvatar({ name, className }: { name?: string; className?: string }) {
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100', className)}>
      {(name || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

/** Menu do usuario no topo: perfil, configuracoes, tema e sair. */
export function UserMenu() {
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const themes = [
    { value: 'light', label: tNav('themeLight'), icon: Sun },
    { value: 'dark', label: tNav('themeDark'), icon: Moon },
    { value: 'system', label: tNav('themeSystem'), icon: Laptop },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="user-menu"
        >
          <UserAvatar name={user?.name} />
          <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">{user?.name?.split(' ')[0]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          {user?.customRole && (
            <span className="mt-1.5 inline-block rounded bg-nav-active px-1.5 py-0.5 text-[11px] font-medium text-nav-active-foreground">
              {user.customRole.name}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/profile')}>
          <User className="h-4 w-4" /> {tNav('profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/settings')}>
          <Settings className="h-4 w-4" /> {tNav('settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="pb-1 text-xs font-normal text-muted-foreground">{tNav('theme')}</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md py-1.5 text-[11px] transition-colors',
                theme === value ? 'bg-nav-active text-nav-active-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface CommandTarget {
  label: string;
  href: string;
  icon?: React.ReactNode;
  /** Palavras extras para a busca (ex.: nome antigo da tela). */
  keywords?: string[];
}

/** Busca global Ctrl/Cmd+K: paginas, tabelas e acoes que a pessoa pode usar. */
export function CommandMenu({
  open, onOpenChange, pages, tables, actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: CommandTarget[];
  tables: Array<CommandTarget & { color?: string | null }>;
  actions?: CommandTarget[];
}) {
  const tNav = useTranslations('navigation');
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={tNav('searchPlaceholder')} />
      <CommandList>
        <CommandEmpty>{tNav('noResults')}</CommandEmpty>
        {tables.length > 0 && (
          <CommandGroup heading={tNav('tables')}>
            {tables.map((item) => (
              <CommandItem key={item.href} value={`${item.label} ${(item.keywords || []).join(' ')}`} onSelect={() => go(item.href)}>
                <CircleDot className="text-muted-foreground" style={{ color: item.color || undefined }} />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={tNav('pages')}>
          {pages.map((item) => (
            <CommandItem key={item.href} value={`${item.label} ${(item.keywords || []).join(' ')}`} onSelect={() => go(item.href)}>
              {item.icon}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {actions && actions.length > 0 && (
          <CommandGroup heading={tNav('actions')}>
            {actions.map((item) => (
              <CommandItem key={item.href} value={`${item.label} ${(item.keywords || []).join(' ')}`} onSelect={() => go(item.href)}>
                <Plus className="text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Botao que parece campo de busca (abre o CommandMenu). */
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  const tNav = useTranslations('navigation');
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      data-testid="command-trigger"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{tNav('search')}</span>
      <CommandShortcut className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] tracking-normal sm:inline">
        {isMac ? '⌘' : 'Ctrl'} K
      </CommandShortcut>
    </button>
  );
}

/** Barra do topo: menu (celular), busca, empresa, avisos e usuario. */
export function ShellTopbar({ onOpenSidebar, onOpenSearch, left }: { onOpenSidebar: () => void; onOpenSearch: () => void; left?: React.ReactNode }) {
  return (
    <header className="sticky top-[var(--banner-h,0px)] z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <button
          type="button"
          className="-ml-1 rounded-md p-2 transition-colors hover:bg-muted lg:hidden"
          onClick={onOpenSidebar}
          data-testid="mobile-menu-button"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {left}
        <div className="flex min-w-0 flex-1 justify-start">
          <SearchTrigger onClick={onOpenSearch} />
        </div>
        <TenantSelector />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
