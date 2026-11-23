'use client';

import { useParams } from 'next/navigation';
import { CampoApp } from '@/components/offline/campo-app';

/**
 * Modo sem internet (fora do layout normal da empresa, que precisa da API ao abrir).
 * O service worker guarda esta pagina e abre aqui quando nao ha conexao.
 */
export default function CampoPage() {
  const params = useParams<{ locale: string; tenant: string }>();
  return <CampoApp slug={params.tenant} locale={params.locale} />;
}
