'use client';

/**
 * Sub-Entity Timeline Widget
 *
 * Exibe sub-entidades em formato de timeline vertical.
 * Ideal para follow-ups, histórico de ações, comentários, atualizações.
 *
 * Config:
 * - subEntitySlug: slug da sub-entidade
 * - parentRecordId: (opcional) filtrar por registro pai
 * - titleField: campo para título do item
 * - descriptionField: campo para descrição
 * - statusField: campo de status para colorir timeline
 * - dateField: campo de data (padrão: createdAt)
 * - limit: quantidade máxima de itens
 * - sortOrder: 'asc' | 'desc' (padrão: desc - mais recentes primeiro)
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Clock,
  Calendar,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Circle,
} from 'lucide-react';
import { useDashboardFilters } from './dashboard-filter-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SubEntityTimelineWidgetProps {
  config: {
    subEntitySlug: string;
    parentRecordId?: string;
    titleField?: string;
    descriptionField?: string;
    statusField?: string;
    dateField?: string;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    title?: string;
  };
}

interface TimelineRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  _parentDisplay?: string;
  _parentEntityName?: string;
  _formatted?: Record<string, string>;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object' && val !== null) {
    if ('label' in (val as Record<string, unknown>)) return String((val as Record<string, unknown>).label);
    if ('value' in (val as Record<string, unknown>)) return String((val as Record<string, unknown>).value);
    if (Array.isArray(val)) return val.map(v => formatValue(v)).join(', ');
    return JSON.stringify(val);
  }
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  return String(val);
}

function getStatusIcon(status: unknown) {
  const statusStr = String(status).toLowerCase();
  if (statusStr.includes('conclu') || statusStr.includes('aprovado')) {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
  if (statusStr.includes('cancel') || statusStr.includes('rejeita')) {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  if (statusStr.includes('pendent') || statusStr.includes('aguard')) {
    return <Clock className="h-4 w-4 text-orange-500" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function getStatusColor(status: unknown): string {
  const statusStr = String(status).toLowerCase();
  if (statusStr.includes('conclu') || statusStr.includes('aprovado')) return 'border-green-500';
  if (statusStr.includes('cancel') || statusStr.includes('rejeita')) return 'border-destructive';
  if (statusStr.includes('pendent') || statusStr.includes('aguard')) return 'border-orange-500';
  return 'border-muted-foreground';
}

function getRelativeTime(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays}d`;

  return past.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function SubEntityTimelineWidget({ config }: SubEntityTimelineWidgetProps) {
  const {
    subEntitySlug,
    parentRecordId,
    titleField,
    descriptionField,
    statusField,
    dateField = 'createdAt',
    limit = 10,
    sortOrder = 'desc',
    title,
  } = config;

  const t = useTranslations('widgets');
  const { tenantId } = useTenant();
  const router = useRouter();
  const { crossFilters } = useDashboardFilters();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimelineRecord[]>([]);
  const [subEntity, setSubEntity] = useState<{ name: string; fields: { slug: string; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // Load sub-entity definition
        const entitiesRes = await api.get('/entities', {
          params: tenantId ? { tenantId } : {},
        });
        const entities = Array.isArray(entitiesRes.data) ? entitiesRes.data : entitiesRes.data?.data || [];
        const found = entities.find((e: { slug: string }) => e.slug === subEntitySlug);

        if (!found) {
          setError('Sub-entidade não encontrada');
          return;
        }

        setSubEntity(found);

        // Load records
        const params: Record<string, unknown> = {
          limit,
          sortBy: dateField,
          sortOrder,
          includeChildren: true, // SEMPRE buscar info do pai para _parentDisplay
        };

        if (parentRecordId) {
          params.parentRecordId = parentRecordId;
        }

        // Apply cross filters from dashboard
        if (crossFilters.length > 0) {
          const apiFilters = crossFilters
            .filter(f => f.fieldSlug.startsWith('parent.'))
            .map(f => ({
              fieldSlug: f.fieldSlug.replace('parent.', ''),
              operator: 'in',
              value: f.values,
              fieldType: 'relation',
            }));

          if (apiFilters.length > 0) {
            params.filters = JSON.stringify(apiFilters);
          }
        }

        const response = await api.get(`/data/${subEntitySlug}`, { params });
        const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setRecords(list);
      } catch (err) {
        console.error('Error loading timeline records:', err);
        setError('Erro ao carregar timeline');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [subEntitySlug, parentRecordId, limit, dateField, sortOrder, tenantId, crossFilters]);

  const handleViewAll = () => {
    const url = parentRecordId
      ? `/data?entity=${subEntitySlug}&parentRecordId=${parentRecordId}`
      : `/data?entity=${subEntitySlug}`;
    router.push(url);
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">{title || 'Timeline'}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">{title || 'Timeline'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Auto-detect fields if not specified
  const effectiveTitleField = titleField || subEntity?.fields?.[0]?.slug || 'id';
  const effectiveDescField = descriptionField || subEntity?.fields?.find(f => f.slug.includes('descr') || f.slug.includes('observ'))?.slug;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">
              {title || `Timeline - ${subEntity?.name || 'Atividades'}`}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {records.length}
            </Badge>
          </div>
          {records.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleViewAll}
            >
              Ver todos
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden pt-0">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade registrada
            </p>
          </div>
        ) : (
          <div className="space-y-0 overflow-y-auto max-h-[500px] pr-2">
            {records.map((record, idx) => {
              const isLast = idx === records.length - 1;
              const status = statusField ? record.data[statusField] : null;
              const titleValue = record._formatted?.[effectiveTitleField] ?? formatValue(record.data[effectiveTitleField]);
              const descValue = effectiveDescField
                ? (record._formatted?.[effectiveDescField] ?? formatValue(record.data[effectiveDescField]))
                : null;
              const dateValue = dateField === 'createdAt' ? record.createdAt : record.data[dateField];

              return (
                <div key={record.id} className="flex gap-3 group">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={cn(
                      "w-8 h-8 rounded-full border-2 flex items-center justify-center bg-card z-10",
                      status ? getStatusColor(status) : "border-muted-foreground"
                    )}>
                      {status ? getStatusIcon(status) : <Circle className="h-4 w-4 fill-current" />}
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-border my-0.5 min-h-[40px]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={cn("flex-1 pb-6", isLast && "pb-2")}>
                    <Card className="group-hover:shadow-md group-hover:border-primary/30 transition-all">
                      <CardContent className="p-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm mb-1 line-clamp-2">
                              {titleValue}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium">
                                {getRelativeTime(String(dateValue))}
                              </span>
                              {record.createdBy && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {record.createdBy.name}
                                  </div>
                                </>
                              )}
                              <span>•</span>
                              <span className="text-muted-foreground/60">
                                {new Date(String(dateValue)).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Status badge */}
                          {status && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {formatValue(status)}
                            </Badge>
                          )}
                        </div>

                        {/* Description */}
                        {descValue && descValue !== '-' && (
                          <p className="text-xs text-muted-foreground line-clamp-3 mt-2 pt-2 border-t">
                            {descValue}
                          </p>
                        )}

                        {/* Parent info - sempre mostra se disponível */}
                        {record._parentDisplay && record._parentEntityName && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 pt-2 border-t">
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium">{record._parentEntityName}:</span>
                            <span className="truncate">{record._parentDisplay}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
