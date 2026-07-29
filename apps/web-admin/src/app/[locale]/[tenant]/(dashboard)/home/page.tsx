'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/tenant-navigation';
import {
  Database,
  TableProperties,
  Users,
  Shield,
  FileText,
  BarChart3,
  Link2,
  ScrollText,
  Building2,
  LineChart,
  Settings as SettingsIcon,
  CircleDot,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HomeCard {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  show: boolean;
  tone: 'primary' | 'neutral';
}

export default function HomePage() {
  const t = useTranslations('home');
  const { user } = useAuthStore();
  const { hasModuleAccess, hasModulePermission } = usePermissions();

  const firstName = (user?.name || '').split(' ')[0] || user?.name || '';

  const cards: HomeCard[] = [
    // Operação (usuário) — primeiro, pois é o dia a dia
    { key: 'records', title: t('records'), desc: t('recordsDesc'), href: '/data', icon: <Database className="h-6 w-6" />, show: hasModuleAccess('data'), tone: 'primary' },
    { key: 'reports', title: t('reports'), desc: t('reportsDesc'), href: '/dashboard', icon: <LineChart className="h-6 w-6" />, show: hasModuleAccess('dashboard'), tone: 'neutral' },
    // Criação/gestão (admin)
    { key: 'newTable', title: t('newTable'), desc: t('newTableDesc'), href: '/entities/new', icon: <TableProperties className="h-6 w-6" />, show: hasModulePermission('entities', 'canCreate'), tone: 'neutral' },
    { key: 'users', title: t('users'), desc: t('usersDesc'), href: '/users', icon: <Users className="h-6 w-6" />, show: hasModuleAccess('users'), tone: 'neutral' },
    { key: 'roles', title: t('roles'), desc: t('rolesDesc'), href: '/roles', icon: <Shield className="h-6 w-6" />, show: hasModuleAccess('roles'), tone: 'neutral' },
    { key: 'pdf', title: t('pdf'), desc: t('pdfDesc'), href: '/pdf-templates', icon: <FileText className="h-6 w-6" />, show: hasModuleAccess('pdfTemplates'), tone: 'neutral' },
    { key: 'dashboards', title: t('dashboards'), desc: t('dashboardsDesc'), href: '/dashboard-templates', icon: <BarChart3 className="h-6 w-6" />, show: hasModuleAccess('dashboardTemplates'), tone: 'neutral' },
    { key: 'publicLinks', title: t('publicLinks'), desc: t('publicLinksDesc'), href: '/public-links', icon: <Link2 className="h-6 w-6" />, show: hasModuleAccess('publicLinks'), tone: 'neutral' },
    { key: 'logs', title: t('logs'), desc: t('logsDesc'), href: '/audit-logs', icon: <ScrollText className="h-6 w-6" />, show: hasModuleAccess('auditLogs'), tone: 'neutral' },
    { key: 'tenants', title: t('tenants'), desc: t('tenantsDesc'), href: '/tenants', icon: <Building2 className="h-6 w-6" />, show: hasModuleAccess('tenants'), tone: 'neutral' },
    // Conta (todos)
    { key: 'settings', title: t('settings'), desc: t('settingsDesc'), href: '/settings', icon: <SettingsIcon className="h-6 w-6" />, show: true, tone: 'neutral' },
  ];

  const visible = cards.filter((c) => c.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t('greeting', { name: firstName })}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CircleDot className="h-8 w-8 mx-auto mb-3 opacity-50" />
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4" data-testid="home-cards">
          {visible.map((c) => (
            <Link key={c.key} href={c.href} data-testid={`home-card-${c.key}`}>
              <Card className={cn('h-full transition-all hover:shadow-md hover:border-primary/40', c.tone === 'primary' && 'border-primary/50 bg-primary/5')}>
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={cn('rounded-lg p-2.5 flex-shrink-0', c.tone === 'primary' ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground/70')}>
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">{c.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
