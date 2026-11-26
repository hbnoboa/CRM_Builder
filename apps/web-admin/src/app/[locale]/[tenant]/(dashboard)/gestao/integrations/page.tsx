'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HelpCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import { ApiKeysPanel } from '@/components/integrations/api-keys-panel';
import { WebhooksPanel } from '@/components/integrations/webhooks-panel';
import { AutomationsPanel } from '@/components/integrations/automations-panel';
import { ConnectedAppsPanel } from '@/components/integrations/connected-apps-panel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { usePermissions } from '@/hooks/use-permissions';

/** Integracoes da empresa: apps conectados, webhooks, chaves de API e o indice das automacoes. */
export default function GestaoIntegrationsPage() {
  const t = useTranslations('gestao.integrations');
  const { hasModulePermission, hasModuleAccess } = usePermissions();
  const features = useTenantFeatures();

  const tabs = [
    hasModulePermission('settings', 'canUpdate') && 'apps',
    hasModuleAccess('automations') && features.webhooks && 'webhooks',
    hasModulePermission('apis', 'canRead') && 'keys',
    hasModuleAccess('automations') && features.automations && 'automations',
  ].filter((x): x is string => !!x);
  const [active, setActive] = useState<string | undefined>(undefined);
  const current = active ?? tabs[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GestaoPageHeader help="module.integrations" title={t('title')} subtitle={t('subtitle')} />
      {tabs.length > 0 && (
        <Tabs value={current} onValueChange={setActive}>
          <TooltipProvider>
            <TabsList className="h-auto flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} data-testid={`integrations-tab-${tab}`}>
                  {/* Dica no texto da aba: no proprio botao ela apagaria o destaque da aba aberta */}
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild><span>{t(`tabs.${tab}`)}</span></TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs whitespace-normal text-left text-xs font-normal leading-relaxed">{t(`tabHints.${tab}`)}</TooltipContent>
                  </Tooltip>
                </TabsTrigger>
              ))}
            </TabsList>
          </TooltipProvider>
          {/* No celular nao ha hover: a explicacao da aba aberta fica visivel */}
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground" data-testid="integrations-tab-hint">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" /> {t(`tabHints.${current}`)}
          </p>
          <TabsContent value="keys"><ApiKeysPanel /></TabsContent>
          <TabsContent value="webhooks"><WebhooksPanel /></TabsContent>
          <TabsContent value="automations"><AutomationsPanel /></TabsContent>
          <TabsContent value="apps"><ConnectedAppsPanel /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
