'use client';

import { LegacyRecordRedirect } from '@/components/data/legacy-record-redirect';

const toEdit = (pathname: string) => `${pathname.replace(/\/$/, '')}/edit`;

/** Endereco antigo do registro: /data/<tabela>/<id> -> /data/<tabela>/<id>/edit */
export default function LegacyRecordPage() {
  return <LegacyRecordRedirect to={toEdit} />;
}
