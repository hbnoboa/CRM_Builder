import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SitePublicClient } from './site-public-client';

/**
 * O HTML da pagina para clientes e igual para todo visitante: os dados (blocos,
 * cardapio, acompanhamento pelo ?c=) chegam depois, no navegador, pela API. Entao o
 * servidor monta este HTML uma vez por endereco e guarda por 5 minutos, em vez de
 * montar a cada visita (era o gargalo no teste de carga dos sites).
 */
export const dynamic = 'force-static';
export const revalidate = 300;

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
);

export default function SitePublicPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SitePublicClient />
    </Suspense>
  );
}
