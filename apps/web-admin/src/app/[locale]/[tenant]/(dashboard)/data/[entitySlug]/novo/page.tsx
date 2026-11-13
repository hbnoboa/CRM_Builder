'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { RecordPage } from '@/components/data/record-page';

/** Novo registro em página própria (?pai= dentro de outro registro, ?voltar= tela de origem). */
export default function NewRecordPage() {
  const { entitySlug } = useParams<{ entitySlug: string }>();
  return (
    <Suspense>
      <RecordPage entitySlug={entitySlug} />
    </Suspense>
  );
}
