'use client';

import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Shield, Crown, UserCog, Users, User, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SYSTEM_ROLES = [
  {
    key: 'PLATFORM_ADMIN',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    key: 'ADMIN',
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  {
    key: 'MANAGER',
    icon: UserCog,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    key: 'USER',
    icon: User,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    key: 'VIEWER',
    icon: Eye,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
];

export default function PermissionsPage() {
  const t = useTranslations('permissions');
  const tNav = useTranslations('navigation');
  const tRoles = useTranslations('roles');
  const tRoleDesc = useTranslations('roleDescriptions');

  return (
    <div className="max-w-3xl mx-auto mt-8">
      {/* Breadcrumbs */}
      <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{t('title')}</span>
      </nav>

      {/* Back */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="mb-2" aria-label={t('backToDashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>{t('backToDashboard')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <h1 className="text-3xl font-bold mb-6">{t('pageTitle')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('systemRoles')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SYSTEM_ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <div key={role.key} className="border p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${role.bgColor} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${role.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{tRoles(role.key)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {role.key}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tRoleDesc(role.key)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
