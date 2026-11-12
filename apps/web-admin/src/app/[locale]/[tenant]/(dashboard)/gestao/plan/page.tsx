'use client';

import { useTranslations } from 'next-intl';
import { OwnershipCard, SubscriptionPanel } from '@/components/subscription/subscription-widgets';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';

export default function GestaoPlanPage() {
  const t = useTranslations('gestao.plan');
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <GestaoPageHeader help="module.plan" title={t('title')} subtitle={t('subtitle')} />
      <SubscriptionPanel />
      <OwnershipCard />
    </div>
  );
}
