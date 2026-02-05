'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw, ChevronLeft, ChevronRight, Pencil, Trash2, Eye, Plus, Search, FileText, LayoutGrid } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

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
  emptyMessage?: string;
  emptyIcon?: string;
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
  emptyMessage,
  emptyIcon,
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
          <p className="text-gray-500 font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">Erro ao carregar dados</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{displayTitle}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {meta.total} {meta.total === 1 ? 'registro' : 'registros'} encontrado{meta.total !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {showSearch && (
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-48 md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </form>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {showAddButton && (
              <button
                onClick={navigateToAdd}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="px-6 py-16">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
              <FileText className="h-10 w-10 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900">
                {emptyMessage || `Nenhum ${entity.name.toLowerCase()} cadastrado`}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Clique em &quot;Adicionar&quot; para criar o primeiro registro
              </p>
            </div>
            {showAddButton && (
              <button
                onClick={navigateToAdd}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar {entity.name}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {displayColumns.map((field) => (
                  <th
                    key={field.slug}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    {field.label || field.name}
                  </th>
                ))}
                {showActions && (
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                    Acoes
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {displayColumns.map((field) => (
                    <td key={field.slug} className="px-6 py-4 text-sm text-gray-700">
                      {formatCellValue(record.data[field.slug], field.type)}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigateToView(record.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => navigateToEdit(record.id)}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          disabled={deleting === record.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Excluir"
                        >
                          {deleting === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {showPagination && meta && meta.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-medium">{((meta.page - 1) * meta.limit) + 1}</span> a{' '}
              <span className="font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span> de{' '}
              <span className="font-medium">{meta.total}</span> registros
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {meta.page} de {meta.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Proximo
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-dashed border-blue-200 p-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <LayoutGrid className="h-8 w-8 text-blue-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-blue-900">
            Tabela de Dados
          </p>
          {title && <p className="text-blue-600 mt-1">{title}</p>}
        </div>
        <div className="bg-white rounded-lg px-4 py-3 text-sm text-gray-600 space-y-1 shadow-sm">
          <p><strong>Entity:</strong> {entitySlug || '[nao configurado]'}</p>
          <p><strong>Colunas:</strong> {columns?.length ? columns.join(', ') : 'automatico'}</p>
          <p><strong>Itens/pagina:</strong> {pageSize || 10}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {showSearch && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Busca</span>}
          {showPagination && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Paginacao</span>}
          {showActions && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Acoes</span>}
          {showAddButton && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Adicionar</span>}
        </div>
        <p className="text-xs text-blue-500 mt-2">
          Dados carregados em tempo de execucao
        </p>
      </div>
    </div>
  );
}
