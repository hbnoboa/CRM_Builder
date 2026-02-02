'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface CustomApiViewerProps {
  apiPath: string;
  params: { key: string; value: string }[];
  displayMode: 'table' | 'list' | 'cards' | 'raw';
  title?: string;
  refreshInterval?: number;
}

interface ApiResponse {
  [key: string]: unknown;
}

export function CustomApiViewer({
  apiPath,
  params,
  displayMode,
  title,
  refreshInterval,
}: CustomApiViewerProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!apiPath) {
      setError('Caminho da API nao configurado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      // Get workspaceId from URL or localStorage
      const workspaceId = typeof window !== 'undefined'
        ? localStorage.getItem('currentWorkspaceId') || window.location.pathname.split('/')[2]
        : '';

      // Build query string from params (safely handle undefined/null)
      const safeParams = Array.isArray(params) ? params : [];
      const queryParams = safeParams
        .filter(p => p && p.key && p.value)
        .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');

      const url = `${apiUrl}/x/${workspaceId}${apiPath}${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('CustomApiViewer error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up refresh interval if configured
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [apiPath, JSON.stringify(params), refreshInterval]);

  if (loading) {
    return (
      <div className="border rounded-lg p-8 bg-muted/30">
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/50 rounded-lg p-6 bg-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">Erro ao carregar API</p>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-background border rounded-md hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border rounded-lg p-6 bg-muted/30">
        <p className="text-center text-muted-foreground">Nenhum dado retornado</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {title && (
        <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <div className="p-4">
        {displayMode === 'raw' && (
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}

        {displayMode === 'table' && renderTable(data)}
        {displayMode === 'list' && renderList(data)}
        {displayMode === 'cards' && renderCards(data)}
      </div>
    </div>
  );
}

function renderTable(data: ApiResponse) {
  // Try to find an array in the response to render as table
  const arrayData = findArrayInData(data);

  if (!arrayData || arrayData.length === 0) {
    return <p className="text-muted-foreground text-center">Nenhum dado para exibir em tabela</p>;
  }

  const columns = Object.keys(arrayData[0] || {}).filter(
    key => typeof arrayData[0][key] !== 'object'
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map(col => (
              <th key={col} className="px-4 py-2 text-left font-medium">
                {formatColumnName(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {arrayData.map((row: Record<string, unknown>, idx: number) => (
            <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
              {columns.map(col => (
                <td key={col} className="px-4 py-2">
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderList(data: ApiResponse) {
  const arrayData = findArrayInData(data);

  if (!arrayData || arrayData.length === 0) {
    return <p className="text-muted-foreground text-center">Nenhum dado para exibir</p>;
  }

  return (
    <ul className="space-y-3">
      {arrayData.map((item: Record<string, unknown>, idx: number) => {
        const title = findTitleField(item);
        const subtitle = findSubtitleField(item);

        return (
          <li key={idx} className="p-3 border rounded-md hover:bg-muted/30">
            <p className="font-medium">{title}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function renderCards(data: ApiResponse) {
  const arrayData = findArrayInData(data);

  if (!arrayData || arrayData.length === 0) {
    return <p className="text-muted-foreground text-center">Nenhum dado para exibir</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {arrayData.map((item: Record<string, unknown>, idx: number) => {
        const title = findTitleField(item);
        const fields = Object.entries(item).filter(
          ([key, val]) => key !== 'id' && typeof val !== 'object'
        ).slice(0, 4);

        return (
          <div key={idx} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h4 className="font-semibold mb-2">{title}</h4>
            <dl className="space-y-1 text-sm">
              {fields.map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-muted-foreground">{formatColumnName(key)}:</dt>
                  <dd className="font-medium">{formatValue(val)}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

// Helper functions
function findArrayInData(data: ApiResponse): Record<string, unknown>[] | null {
  // Check common patterns
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.reclamacoes)) return data.reclamacoes;
  if (Array.isArray(data.clientes)) return data.clientes;

  // Find first array in object
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }

  return null;
}

function findTitleField(item: Record<string, unknown>): string {
  const titleFields = ['titulo', 'title', 'nome', 'name', 'label', 'descricao', 'description'];
  for (const field of titleFields) {
    if (item[field] && typeof item[field] === 'string') {
      return item[field] as string;
    }
  }
  return `Item ${item.id || ''}`;
}

function findSubtitleField(item: Record<string, unknown>): string | null {
  const subtitleFields = ['status', 'email', 'empresa', 'company', 'prioridade', 'priority', 'type', 'tipo'];
  for (const field of subtitleFields) {
    if (item[field] && typeof item[field] === 'string') {
      return item[field] as string;
    }
  }
  return null;
}

function formatColumnName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toLocaleDateString('pt-BR');
  }
  return String(value);
}

// Editor preview component (shown in Puck editor)
export function CustomApiViewerPreview({
  apiPath,
  params,
  displayMode,
  title,
}: CustomApiViewerProps) {
  // Safely handle undefined/null params
  const safeParams = Array.isArray(params) ? params : [];
  const queryString = safeParams
    .filter(p => p && p.key && p.value)
    .map(p => `${p.key}=${p.value}`)
    .join('&');

  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 bg-primary/5">
      <div className="text-center">
        <p className="text-lg font-medium text-primary">
          Custom API Viewer
        </p>
        {title && <p className="text-sm text-muted-foreground mt-1">{title}</p>}
        <div className="mt-4 text-sm text-muted-foreground">
          <p><strong>Endpoint:</strong> /x/[workspaceId]{apiPath || '/[caminho]'}</p>
          {queryString && <p><strong>Params:</strong> {queryString}</p>}
          <p><strong>Modo:</strong> {displayMode}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Os dados serao carregados em tempo de execucao
        </p>
      </div>
    </div>
  );
}
