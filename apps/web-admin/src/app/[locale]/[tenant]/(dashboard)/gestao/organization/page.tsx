'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/stores/tenant-context';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';

export default function GestaoOrganizationPage() {
  const t = useTranslations('settings.org');
  const tPage = useTranslations('gestao.organization');
  const { tenant } = useTenant();
  const brandColor = tenant?.settings?.theme?.brandColor || '#7c3aed';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <GestaoPageHeader title={tPage('title')} subtitle={tPage('subtitle')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('tenantName')}</Label>
            <Input value={tenant?.name || ''} readOnly />
          </div>
          <div className="space-y-2">
            <Label>{t('tenantSlug')}</Label>
            <Input value={tenant?.slug || ''} readOnly />
          </div>
          <div className="space-y-2">
            <Label>{t('brandColor')}</Label>
            <div className="flex items-center gap-3">
              <span className="inline-block h-8 w-8 rounded border" style={{ backgroundColor: brandColor }} />
              <Input value={brandColor} readOnly className="max-w-[160px]" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('readonly')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
