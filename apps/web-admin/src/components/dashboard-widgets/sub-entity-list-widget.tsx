'use client';

/**
 * Sub-Entity List Widget
 *
 * Exibe registros de uma sub-entidade com filtro opcional por registro pai.
 * Ideal para mostrar follow-ups, documentos, comentários, etc.
 *
 * Config:
 * - entitySlug: slug da entidade principal (pai)
 * - subEntitySlug: slug da sub-entidade a exibir
 * - parentRecordId: (opcional) ID do registro pai para filtrar
 * - displayFields: campos a exibir
 * - groupBy: (opcional) campo para agrupar (ex: status, tipo)
 * - limit: quantidade máxima de registros
 * - showParentInfo: mostrar info do registro pai
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  FileText,
  Calendar,
  User,
  ArrowRight,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SubEntityListWidgetProps {
  config: {
    entitySlug: string;
    subEntitySlug: string;
    parentRecordId?: string;
    displayFields?: string[];
    groupBy?: string;
    limit?: number;
    showParentInfo?: boolean;
    title?: string;
  };
}

interface SubRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string };
  _parentDisplay?: string;
  _parentEntityName?: string;
  _formatted?: Record<string, string>;
}

interface GroupedRecords {
  [key: string]: SubRecord[];
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

function getStatusVariant(status: unknown): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusStr = String(status).toLowerCase();
  if (statusStr.includes('conclu') || statusStr.includes('aprovado')) return 'default';
  if (statusStr.includes('pendent') || statusStr.includes('aguard')) return 'secondary';
  if (statusStr.includes('cancel') || statusStr.includes('rejeita')) return 'destructive';
  return 'outline';
}

export default function SubEntityListWidget({ config }: SubEntityListWidgetProps) {
  const {
    entitySlug,
    subEntitySlug,
    parentRecordId,
    displayFields = [],
    groupBy,
    limit = 10,
    showParentInfo = false,
    title,
  } = config;

  const t = useTranslations('widgets');
  const { tenantId } = useTenant();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<SubRecord[]>([]);
  const [groupedRecords, setGroupedRecords] = useState<GroupedRecords | null>(null);
  const [subEntity, setSubEntity] = useState<{ name: string; fields: { slug: string; name: string; type: string }[] } | null>(null);
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
          includeChildren: showParentInfo,
        };

        if (parentRecordId) {
          params.parentRecordId = parentRecordId;
        }

        const response = await api.get(`/data/${subEntitySlug}`, { params });
        const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setRecords(list);

        // Group records if needed
        if (groupBy) {
          const grouped: GroupedRecords = {};
          list.forEach((record: SubRecord) => {
            const groupValue = formatValue(record.data[groupBy]);
            if (!grouped[groupValue]) {
              grouped[groupValue] = [];
            }
            grouped[groupValue].push(record);
          });
          setGroupedRecords(grouped);
        }
      } catch (err) {
        console.error('Error loading sub-entity records:', err);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [subEntitySlug, parentRecordId, limit, groupBy, showParentInfo, tenantId]);

  const getFieldLabel = (slug: string) => {
    const field = subEntity?.fields?.find(f => f.slug === slug);
    return field?.name || slug;
  };

  const getFieldType = (slug: string) => {
    const field = subEntity?.fields?.find(f => f.slug === slug);
    return field?.type || 'text';
  };

  const handleRecordClick = (recordId: string) => {
    router.push(`/data?entity=${subEntitySlug}&recordId=${recordId}`);
  };

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
          <CardTitle className="text-base">{title || 'Sub-Entidades'}</CardTitle>
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
          <CardTitle className="text-base">{title || 'Sub-Entidades'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-base">
              {title || subEntity?.name || 'Sub-Registros'}
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
            <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum registro encontrado
            </p>
          </div>
        ) : groupedRecords ? (
          // Grouped view
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
            {Object.entries(groupedRecords).map(([group, groupRecords]) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{group}</span>
                  <Badge variant="outline" className="text-xs">
                    {groupRecords.length}
                  </Badge>
                </div>
                <div className="space-y-2 pl-5">
                  {groupRecords.map(record => (
                    <RecordCard
                      key={record.id}
                      record={record}
                      displayFields={displayFields}
                      getFieldLabel={getFieldLabel}
                      getFieldType={getFieldType}
                      showParentInfo={showParentInfo}
                      onClick={() => handleRecordClick(record.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List view
          <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2">
            {records.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                displayFields={displayFields}
                getFieldLabel={getFieldLabel}
                getFieldType={getFieldType}
                showParentInfo={showParentInfo}
                onClick={() => handleRecordClick(record.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RecordCardProps {
  record: SubRecord;
  displayFields: string[];
  getFieldLabel: (slug: string) => string;
  getFieldType: (slug: string) => string;
  showParentInfo: boolean;
  onClick: () => void;
}

function RecordCard({
  record,
  displayFields,
  getFieldLabel,
  getFieldType,
  showParentInfo,
  onClick,
}: RecordCardProps) {
  const primaryField = displayFields[0];
  const primaryValue = record._formatted?.[primaryField] ?? formatValue(record.data[primaryField]);

  return (
    <div
      className="border rounded-lg p-3 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {primaryValue}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(record.createdAt).toLocaleDateString('pt-BR')}
            {record.createdBy && (
              <>
                <span>•</span>
                <User className="h-3 w-3" />
                {record.createdBy.name}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Parent info */}
      {showParentInfo && record._parentDisplay && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 bg-muted/50 rounded px-2 py-1">
          <ArrowRight className="h-3 w-3" />
          <span className="font-medium">{record._parentEntityName}:</span>
          <span className="truncate">{record._parentDisplay}</span>
        </div>
      )}

      {/* Fields */}
      {displayFields.length > 1 && (
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
          {displayFields.slice(1).map(field => {
            const value = record.data[field];
            const formatted = record._formatted?.[field] ?? formatValue(value);
            const fieldType = getFieldType(field);

            return (
              <div key={field} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground truncate">
                  {getFieldLabel(field)}
                </span>
                {fieldType === 'select' && formatted !== '-' ? (
                  <Badge variant={getStatusVariant(value)} className="text-xs w-fit">
                    {formatted}
                  </Badge>
                ) : (
                  <span className="text-xs font-medium truncate">
                    {formatted}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
