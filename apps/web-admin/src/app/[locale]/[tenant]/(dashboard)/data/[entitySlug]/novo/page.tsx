'use client';

import { LegacyRecordRedirect } from '@/components/data/legacy-record-redirect';

const toNew = (pathname: string) => pathname.replace(/\/novo\/?$/, '/new');

/** Endereco antigo de criacao: /data/<tabela>/novo -> /data/<tabela>/new */
export default function LegacyNewRecordPage() {
  return <LegacyRecordRedirect to={toNew} />;
}
