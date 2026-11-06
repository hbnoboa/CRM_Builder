'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import { ApiKeysPanel } from '@/components/integrations/api-keys-panel';
import { WebhooksPanel } from '@/components/integrations/webhooks-panel';
import { AutomationsPanel } from '@/components/integrations/automations-panel';
import { useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { usePermissions } from '@/hooks/use-permissions';

/** Integracoes da empresa: chaves de API, webhooks e o indice das automacoes. */
export default function GestaoIntegrationsPage() {
  const t = useTranslations('gestao.integrations');
  const { hasModulePermission, hasModuleAccess } = usePermissions();
  const features = useTenantFeatures();

  const tabs = [
    hasModulePermission('apis', 'canRead') && 'keys',
    hasModuleAccess('automations') && features.webhooks && 'webhooks',
    hasModuleAccess('automations') && features.automations && 'automations',
  ].filter((x): x is string => !!x);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GestaoPageHeader help="module.integrations" title={t('title')} subtitle={t('subtitle')} />
      {tabs.length > 0 && (
        <Tabs defaultValue={tabs[0]}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} data-testid={`integrations-tab-${tab}`}>{t(`tabs.${tab}`)}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="keys"><ApiKeysPanel /></TabsContent>
          <TabsContent value="webhooks"><WebhooksPanel /></TabsContent>
          <TabsContent value="automations"><AutomationsPanel /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
