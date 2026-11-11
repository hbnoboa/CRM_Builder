'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SitePageView } from '@/components/site/site-page-view';
import { siteApi, type SitePageData } from '@/lib/site-api';

/** Pagina para clientes da empresa: /p/<empresa>/<pagina> (com ?c= o acompanhamento). */
export function SitePublicClient() {
  const params = useParams<{ slug: string; page: string }>();
  const token = useSearchParams().get('c');
  const [data, setData] = useState<SitePageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    siteApi.page(params.slug, params.page, token)
      .then((d) => {
        setData(d);
        document.title = `${d.page.title} · ${d.tenant.name}`;
      })
      .catch((err: Error) => setError(err.message));
  }, [params.slug, params.page, token]);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-800">Página não encontrada</p>
          <p className="mt-1 text-sm text-slate-500">Confira o endereço ou fale com a empresa que enviou o link.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  return <SitePageView data={data} tenantSlug={params.slug} pageSlug={params.page} token={token} onChanged={load} />;
}
