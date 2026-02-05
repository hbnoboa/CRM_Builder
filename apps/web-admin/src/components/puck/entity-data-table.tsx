'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight, Pencil, Trash2, Eye, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EntityField {
  slug: string;
  name: string;
  label?: string;
  type: string;
  required?: boolean;
}

interface EntityDataTableProps {
  entitySlug: string;
  title?: string;
  showActions?: boolean;
  showSearch?: boolean;
  showPagination?: boolean;
  showAddButton?: boolean;
  pageSize?: number;
  columns?: string[];
  editPageSlug?: string;
  viewPageSlug?: string;
  addPageSlug?: string;
}

interface EntityDataRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface EntityDataResponse {
  data: EntityDataRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  entity: {
    id: string;
    name: string;
    namePlural: string;
    slug: string;
    fields: EntityField[];
  };
}

export function EntityDataTable({
  entitySlug,
  title,
  showActions = true,
  showSearch = true,
  showPagination = true,
  showAddButton = true,
  pageSize = 10,
  columns = [],
  editPageSlug,
  viewPageSlug,
  addPageSlug,
}: EntityDataTableProps) {
  const router = useRouter();
  const [data, setData] = useState<EntityDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!entitySlug) {
      setError('Entity slug nao configurado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) {
        params.append('search', search);
      }

      const url = `${apiUrl}/data/${entitySlug}?${params.toString()}`;

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
      console.error('EntityDataTable error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [entitySlug, page, pageSize, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) {
      return;
    }

    try {
      setDeleting(id);
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

      const response = await fetch(`${apiUrl}/data/${entitySlug}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao excluir registro');
      }

      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  const navigateToEdit = (id: string) => {
    if (editPageSlug) {
      router.push(`/preview/${editPageSlug}?id=${id}`);
    } else {
      router.push(`/data/${entitySlug}/${id}/edit`);
    }
  };

  const navigateToView = (id: string) => {
    if (viewPageSlug) {
      router.push(`/preview/${viewPageSlug}?id=${id}`);
    } else {
      router.push(`/data/${entitySlug}/${id}`);
    }
  };

  const navigateToAdd = () => {
    if (addPageSlug) {
      router.push(`/preview/${addPageSlug}`);
    } else {
      router.push(`/data/${entitySlug}/new`);
    }
  };

  if (loading && !data) {
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
          <p className="font-medium">Erro ao carregar dados</p>
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
        <p className="text-center text-muted-foreground">Nenhum dado encontrado</p>
      </div>
    );
  }

  const entity = data.entity;
  const records = data.data || [];
  const meta = data.meta;

  // Determine which columns to show
  const displayColumns = columns.length > 0
    ? entity.fields.filter(f => columns.includes(f.slug))
    : entity.fields.filter(f => !['id', 'createdAt', 'updatedAt'].includes(f.slug)).slice(0, 5);

  const displayTitle = title || entity.namePlural || entity.name;

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-lg">{displayTitle}</h3>
        <div className="flex items-center gap-2">
          {showSearch && (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-8 pr-3 py-1.5 text-sm border rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </form>
          )}
          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          {showAddButton && (
            <button
              onClick={navigateToAdd}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {displayColumns.map((field) => (
                <th key={field.slug} className="px-4 py-3 text-left font-medium">
                  {field.label || field.name}
                </th>
              ))}
              {showActions && (
                <th className="px-4 py-3 text-right font-medium w-32">Acoes</th>
              )}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={displayColumns.length + (showActions ? 1 : 0)}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {displayColumns.map((field) => (
                    <td key={field.slug} className="px-4 py-3">
                      {formatCellValue(record.data[field.slug], field.type)}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigateToView(record.id)}
                          className="p-1.5 hover:bg-muted rounded-md transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => navigateToEdit(record.id)}
                          className="p-1.5 hover:bg-muted rounded-md transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          disabled={deleting === record.id}
                          className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                          title="Excluir"
                        >
                          {deleting === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && meta && meta.totalPages > 1 && (
        <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((meta.page - 1) * meta.limit) + 1} - {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">
              Pagina {meta.page} de {meta.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="p-1.5 border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined) return '-';

  switch (fieldType) {
    case 'boolean':
      return value ? 'Sim' : 'Nao';
    case 'date':
      if (typeof value === 'string') {
        return new Date(value).toLocaleDateString('pt-BR');
      }
      return '-';
    case 'datetime':
      if (typeof value === 'string') {
        return new Date(value).toLocaleString('pt-BR');
      }
      return '-';
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value);
    case 'select':
    case 'api-select':
      // Handle select values (could be object with label or plain string)
      if (typeof value === 'object' && value !== null && 'label' in value) {
        return String((value as { label: string }).label);
      }
      return String(value);
    case 'multiselect':
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'object' && v !== null && 'label' in v ? v.label : v).join(', ');
      }
      return String(value);
    case 'relation':
      // Handle relation values
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        return String(obj.name || obj.title || obj.label || obj.id || '-');
      }
      return String(value);
    default:
      if (typeof value === 'string' && value.length > 50) {
        return value.substring(0, 50) + '...';
      }
      return String(value);
  }
}

// Editor preview component (shown in Puck editor)
export function EntityDataTablePreview({
  entitySlug,
  title,
  showActions,
  showSearch,
  showPagination,
  showAddButton,
  pageSize,
  columns,
}: EntityDataTableProps) {
  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 bg-primary/5">
      <div className="text-center">
        <p className="text-lg font-medium text-primary">
          Tabela de Dados
        </p>
        {title && <p className="text-sm text-muted-foreground mt-1">{title}</p>}
        <div className="mt-4 text-sm text-muted-foreground space-y-1">
          <p><strong>Entity:</strong> {entitySlug || '[nao configurado]'}</p>
          <p><strong>Colunas:</strong> {columns?.length ? columns.join(', ') : 'auto'}</p>
          <p><strong>Itens/pagina:</strong> {pageSize || 10}</p>
          <div className="flex justify-center gap-4 mt-2">
            {showSearch && <span className="px-2 py-0.5 bg-muted rounded text-xs">Busca</span>}
            {showPagination && <span className="px-2 py-0.5 bg-muted rounded text-xs">Paginacao</span>}
            {showActions && <span className="px-2 py-0.5 bg-muted rounded text-xs">Acoes</span>}
            {showAddButton && <span className="px-2 py-0.5 bg-muted rounded text-xs">Botao Adicionar</span>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Os dados serao carregados em tempo de execucao
        </p>
      </div>
    </div>
  );
}
