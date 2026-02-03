'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Render } from '@measured/puck';
import { puckConfig } from '@/lib/puck-config';
import type { Data } from '@measured/puck';
import '@measured/puck/puck.css';

interface PageData {
  title: string;
  content: Data;
  isPublished?: boolean;
}

// Estrutura valida minima para o Puck
const emptyPuckData: Data = {
  content: [],
  root: { props: {} },
};

// Valida e normaliza o conteudo do Puck
function normalizePuckContent(content: unknown): Data {
  // Se for null/undefined, retorna estrutura vazia
  if (!content) {
    return emptyPuckData;
  }

  // Se for string, tenta fazer parse
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return emptyPuckData;
    }
  }

  // Se nao for objeto, retorna vazio
  if (typeof content !== 'object') {
    return emptyPuckData;
  }

  const data = content as Record<string, unknown>;

  // Garante que tem a estrutura minima
  return {
    content: Array.isArray(data.content) ? data.content : [],
    root: data.root && typeof data.root === 'object' ? data.root : { props: {} },
    zones: data.zones && typeof data.zones === 'object' ? data.zones : undefined,
  } as Data;
}

export default function PublicPreviewPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const slug = params.slug as string;

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Atualiza o titulo da pagina
  useEffect(() => {
    if (pageData?.title) {
      document.title = pageData.title;
    }
  }, [pageData?.title]);

  // Busca os dados da pagina
  useEffect(() => {
    const fetchPage = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

        // Tenta primeiro o endpoint autenticado (permite paginas nao publicadas)
        if (token) {
          const authResponse = await fetch(`${apiUrl}/pages/preview/${organizationId}/${slug}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (authResponse.ok) {
            const data = await authResponse.json();
            setPageData({
              ...data,
              content: normalizePuckContent(data.content),
            });
            return;
          }
        }

        // Fallback para endpoint publico (apenas paginas publicadas)
        const response = await fetch(`${apiUrl}/public/pages/${organizationId}/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Pagina nao encontrada');
          } else if (response.status === 401) {
            setError('Pagina nao publicada. Faca login para visualizar.');
          } else {
            setError('Erro ao carregar pagina');
          }
          return;
        }

        const data = await response.json();
        setPageData({
          ...data,
          content: normalizePuckContent(data.content),
        });
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Erro ao conectar com o servidor');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [organizationId, slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-muted-foreground mb-4">404</h1>
          <p className="text-lg text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Pagina sem conteudo</p>
        </div>
      </div>
    );
  }

  // Verifica se a pagina tem conteudo
  const hasContent = pageData.content?.content && pageData.content.content.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Draft indicator */}
      {pageData.isPublished === false && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 text-center py-2 text-sm font-medium z-50">
          Modo Preview - Esta pagina ainda nao foi publicada
        </div>
      )}

      {/* Rendered Puck Content */}
      <div className={pageData.isPublished === false ? 'pt-10' : ''}>
        {hasContent ? (
          <Render config={puckConfig} data={pageData.content} />
        ) : (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <p className="text-lg text-muted-foreground">Esta pagina ainda nao tem conteudo.</p>
              <p className="text-sm text-muted-foreground mt-2">Adicione componentes no editor para visualizar.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
