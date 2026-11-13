'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { RecordPage } from '@/components/data/record-page';

/** Registro em página própria (/data/<tabela>/<id>/edit): abrir, editar e mandar o link (?voltar= tela de origem). */
export default function RecordDetailPage() {
  const { entitySlug, recordId } = useParams<{ entitySlug: string; recordId: string }>();
  return (
    <Suspense>
      <RecordPage entitySlug={entitySlug} recordId={recordId} />
    </Suspense>
  );
}
