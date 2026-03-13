'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Database } from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { useMyDashboardTemplates } from '@/hooks/use-dashboard-templates';
import { cn } from '@/lib/utils';
import type { EntityField } from '@/types';
import dynamic from 'next/dynamic';

const EntityDashboard = dynamic(
  () => import('@/components/dashboard-widgets/entity-dashboard').then((mod) => mod.EntityDashboard),
  { ssr: false },
);

interface Entity {
  id: string;
  name: string;
  slug: string;
  description?: string;
  fields?: EntityField[];
  settings?: Record<string, unknown>;
  _count?: { data: number };
  _parentEntity?: { name: string; slug: string };
}

function DataPageContent() {
  const t = useTranslations('data');
  const searchParams = useSearchParams();
  const entityParam = searchParams.get('entity');
  const { effectiveTenantId } = useTenant();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);

  // Dashboard template selector
  const { data: myDashboardTemplates } = useMyDashboardTemplates(selectedEntity?.slug);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Restore selected template when entity changes
  useEffect(() => {
    if (selectedEntity?.slug) {
      const saved = localStorage.getItem(`dashboardTemplate:${selectedEntity.slug}`);
      setSelectedTemplateId(saved);
    } else {
      setSelectedTemplateId(null);
    }
  }, [selectedEntity?.slug]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    if (selectedEntity?.slug) {
      localStorage.setItem(`dashboardTemplate:${selectedEntity.slug}`, templateId);
    }
  }, [selectedEntity?.slug]);

  const effectiveTemplateId = useMemo(() => {
    if (!myDashboardTemplates || myDashboardTemplates.length === 0) return undefined;
    if (selectedTemplateId && myDashboardTemplates.some((t) => t.id === selectedTemplateId)) {
      return selectedTemplateId;
    }
    return undefined;
  }, [myDashboardTemplates, selectedTemplateId]);

  // Select entity and load full fields if needed
  const handleEntitySelect = useCallback(async (entity: Entity) => {
    if (!entity.fields) {
      try {
        const res = await api.get(`/entities/${entity.id}`);
        entity = { ...entity, ...res.data };
        setEntities(prev => prev.map(e => (e.id === entity.id ? entity : e)));
      } catch { /* ignore */ }
    }
    setSelectedEntity(entity);
  }, []);

  const fetchEntities = async () => {
    try {
      const params: Record<string, string> = {};
      if (effectiveTenantId) params.tenantId = effectiveTenantId;
      const response = await api.get('/entities', { params });
      const allEntities: Entity[] = Array.isArray(response.data) ? response.data : response.data?.data || [];

      // Identify sub-entity slugs (entities referenced via sub-entity fields)
      const subEntitySlugs = new Set<string>();
      for (const entity of allEntities) {
        if (entity.fields) {
          for (const field of entity.fields) {
            if (field.type === 'sub-entity' && field.subEntitySlug) {
              subEntitySlugs.add(field.subEntitySlug);
            }
          }
        }
      }

      // Filter out sub-entities — show only parent entities
      const list = allEntities.filter(e => !subEntitySlugs.has(e.slug));

      setEntities(list);
      if (list.length > 0) {
        const target = entityParam
          ? list.find((e: Entity) => e.slug === entityParam) || list[0]
          : list[0];
        // Load full entity data if needed
        let fullEntity = target;
        if (!target.fields) {
          try {
            const res = await api.get(`/entities/${target.id}`);
            fullEntity = { ...target, ...res.data };
            setEntities(prev => prev.map(e => (e.id === fullEntity.id ? fullEntity : e)));
          } catch { /* ignore */ }
        }
        setSelectedEntity(fullEntity);
      }
    } catch (error) {
      console.error('Erro ao carregar entidades:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch entities on tenant change
  useEffect(() => {
    setSelectedEntity(null);
    fetchEntities();
  }, [effectiveTenantId]);

  // React to sidebar entity clicks (URL query param changes)
  useEffect(() => {
    if (entityParam && entities.length > 0) {
      const target = entities.find(e => e.slug === entityParam);
      if (target && target.id !== selectedEntity?.id) {
        handleEntitySelect(target);
      }
    }
  }, [entityParam]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {loading && !selectedEntity ? (
        <div className="animate-pulse h-10 bg-muted rounded-lg w-full sm:w-64" />
      ) : !selectedEntity && entities.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center">
            <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{t('noEntitiesCreated')}</p>
            <Link href="/entities/new">
              <Button variant="link" size="sm" data-testid="create-entity-btn">
                {t('createEntity')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {selectedEntity && (
        <>
          {/* Template selector — shown when user has 2+ dashboard templates */}
          {myDashboardTemplates && myDashboardTemplates.length > 1 && (
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {myDashboardTemplates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleTemplateSelect(tmpl.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                    (effectiveTemplateId === tmpl.id || (!effectiveTemplateId && tmpl.id === myDashboardTemplates[0].id))
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground',
                  )}
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          )}
          <EntityDashboard
            entitySlug={selectedEntity.slug}
            entityFields={(selectedEntity.fields || []) as Array<{ slug: string; name: string; label?: string; type: string }>}
            templateId={effectiveTemplateId}
          />
        </>
      )}
    </div>
  );
}

export default function DataPage() {
  return (
    <RequireRole module="data">
      <DataPageContent />
    </RequireRole>
  );
}
