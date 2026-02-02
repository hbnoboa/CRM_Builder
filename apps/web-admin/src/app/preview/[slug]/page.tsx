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
  workspaceId: string;
  workspaceName: string;
}

export default function SimplePreviewPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
        const response = await fetch(`${apiUrl}/public/pages/slug/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Pagina nao encontrada');
          } else {
            setError('Erro ao carregar pagina');
          }
          return;
        }

        const data = await response.json();
        setPageData(data);
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Erro ao conectar com o servidor');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

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

  if (!pageData || !pageData.content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Pagina sem conteudo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Title (optional, can be hidden) */}
      {pageData.title && (
        <head>
          <title>{pageData.title}</title>
        </head>
      )}

      {/* Rendered Puck Content */}
      <Render config={puckConfig} data={pageData.content} />
    </div>
  );
}
