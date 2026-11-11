'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Building2, Globe, UserSearch, ChartColumn, Gauge, Handshake, LifeBuoy, Megaphone, KeyRound, Layers, Loader2, LogOut, Menu, ScrollText, ShieldCheck, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPlatformToken, setPlatformToken } from '@/lib/platform-api';
import { getErrorMessage } from '@/lib/get-error-message';
import { platformKeys, usePlatformChangePassword, usePlatformMe } from '@/hooks/use-platform';
import { cn } from '@/lib/utils';
import { useConsoleTicketCounts } from '@/components/support/console-support-api';

const NAV = [
  { key: 'overview', href: '/admin', icon: Gauge, permission: 'overview.read' },
  { key: 'metrics', href: '/admin/metrics', icon: ChartColumn, permission: 'metrics.read' },
  { key: 'people', href: '/admin/people', icon: UserSearch, permission: 'users.read' },
  { key: 'tenants', href: '/admin/tenants', icon: Building2, permission: 'tenants.read' },
  { key: 'plans', href: '/admin/plans', icon: Layers, permission: 'plans.read' },
  { key: 'staff', href: '/admin/staff', icon: Users, permission: 'staff.read' },
  { key: 'support', href: '/admin/support', icon: LifeBuoy, permission: 'support.read' },
  { key: 'leads', href: '/admin/leads', icon: Handshake, permission: 'support.read' },
  { key: 'domains', href: '/admin/domains', icon: Globe, permission: 'domains.read' },
  { key: 'announcements', href: '/admin/announcements', icon: Megaphone, permission: 'announcements.read' },
  { key: 'health', href: '/admin/health', icon: Activity, permission: 'health.read' },
  { key: 'audit', href: '/admin/audit', icon: ScrollText, permission: 'audit.read' },
] as const;

export default function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('platform');
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { data: staff, isError } = usePlatformMe();
  const { data: supportCounts } = useConsoleTicketCounts(!!staff?.permissions.includes('support.read'));

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && (!getPlatformToken() || isError)) router.replace('/admin/login');
  }, [mounted, isError, router]);
  useEffect(() => setMenuOpen(false), [pathname]);

  const logout = () => {
    setPlatformToken(null);
    queryClient.removeQueries({ queryKey: platformKeys.all });
    router.replace('/admin/login');
  };

  if (!mounted || !staff) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nav = NAV.filter((item) => staff.permissions.includes(item.permission));
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive(item.href) ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'hover:bg-muted',
          )}
        >
          <item.icon className="h-4 w-4" />
          {t(`nav.${item.key}`)}
          {item.key === 'support' && (supportCounts?.open ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white" data-testid="nav-support-count">
              {supportCounts!.open}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
        <button type="button" className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="menu">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5" />
          <span>{t('brand')}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right text-xs leading-tight sm:block">
            <div className="font-medium">{staff.name}</div>
            <div className="text-muted-foreground">{t(`roles.${staff.role}`)}</div>
          </div>
          <Button variant="ghost" size="icon" title={t('account.changePassword')} onClick={() => setPasswordOpen(true)}>
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t('account.logout')} onClick={logout} data-testid="platform-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r bg-background md:block md:min-h-[calc(100vh-3.5rem)]">{sidebar}</aside>
        {menuOpen && <aside className="fixed inset-x-0 top-14 z-30 border-b bg-background md:hidden">{sidebar}</aside>}
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('platform.account');
  const change = usePlatformChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      toast.success(t('passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('currentPassword')}</Label>
            <Input id="current-password" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input id="new-password" type="password" required minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('passwordRule')}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
