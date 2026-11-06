'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/tenant-navigation';
import { Database } from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { useMyDashboardTemplates } from '@/hooks/use-dashboard-templates';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { RecordFormDialog } from '@/components/data/record-form-dialog';
import type { Entity as FullEntity, EntityField } from '@/types';
import { HelpButton } from '@/components/help/help-button';
import dynamic from 'next/dynamic';

const EntityDashboard = dynamic(
  () => import('@/components/dashboard-widgets/entity-dashboard').then((mod) => mod.EntityDashboard),
  { ssr: false },
);

interface Entity {
  id: string;
  name: string;
  slug: string;
  namePlural?: string;
  description?: string;
  color?: string | null;
  fields?: EntityField[];
  settings?: Record<string, unknown>;
  _count?: { data: number };
  _parentEntity?: { name: string; slug: string };
}

function DataPageContent() {
  const t = useTranslations('data');
  const searchParams = useSearchParams();
  const entityParam = searchParams.get('entity');
  const router = useRouter();
  const { hasModulePermission, hasEntityPermission } = usePermissions();
  // "+ Novo" do inicio (?novo=1): abre o formulario de criacao, qualquer que seja o painel
  const wantsCreate = searchParams.get('novo') === '1';
  const { effectiveTenantId } = useTenant();

  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  // Todas as entidades (incl. sub-entidades), p/ poder abrir uma tabela filha direto via ?entity= (N niveis)
  const allEntitiesRef = useRef<Entity[]>([]);

  // Dashboard template selector
  const { data: myDashboardTemplates } = useMyDashboardTemplates(selectedEntity?.slug);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Restore selected template when entity changes (?painel=<id> abre um painel especifico)
  const painelParam = searchParams.get('painel');
  useEffect(() => {
    if (selectedEntity?.slug) {
      if (painelParam) localStorage.setItem(`dashboardTemplate:${selectedEntity.slug}`, painelParam);
      const saved = painelParam || localStorage.getItem(`dashboardTemplate:${selectedEntity.slug}`);
      setSelectedTemplateId(saved);
    } else {
      setSelectedTemplateId(null);
    }
  }, [selectedEntity?.slug, painelParam]);

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
      const response = await api.get('/entities');
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

      // Filter out sub-entities — show only parent entities (top-level)
      const list = allEntities.filter(e => !subEntitySlugs.has(e.slug));
      allEntitiesRef.current = allEntities;

      // Resolve alvo: prefere top-level por ?entity, mas permite abrir uma sub-entidade
      // diretamente via URL (suporte a N niveis: ex. operacao -> veiculos).
      const target = entityParam
        ? (list.find((e: Entity) => e.slug === entityParam)
           || allEntities.find((e: Entity) => e.slug === entityParam)
           || list[0])
        : list[0];

      // Seletor mostra top-level + a sub-entidade aberta via URL (p/ poder voltar e p/ o efeito de URL achar)
      const selectable = target && !list.some(e => e.id === target.id) ? [...list, target] : list;
      setEntities(selectable);
      if (selectable.length > 0 && target) {
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
      // procura em top-level e, se nao achar, em todas (sub-entidade aberta via URL/sidebar)
      const target = entities.find(e => e.slug === entityParam)
        || allEntitiesRef.current.find(e => e.slug === entityParam);
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
          <EmptyState
            icon={<Database className="h-5 w-5" />}
            title={t('noEntitiesCreated')}
            action={
              <Button asChild size="sm" data-testid="create-entity-btn">
                <Link href="/gestao/entities/new">{t('createEntity')}</Link>
              </Button>
            }
          />
        </Card>
      ) : null}

      {selectedEntity && (
        <>
          {/* Cabecalho da tabela: icone na cor da tabela, nome e descricao */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-nav-active text-nav-active-foreground"
                style={selectedEntity.color ? { backgroundColor: `color-mix(in srgb, ${selectedEntity.color} 14%, transparent)`, color: selectedEntity.color } : undefined}
              >
                <Database className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl" data-testid="data-page-title">
                    {selectedEntity.namePlural || selectedEntity.name}
                  </h1>
                  <HelpButton topic="screen.records" />
                </div>
                {(selectedEntity.description || selectedEntity._parentEntity) && (
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedEntity._parentEntity ? `${selectedEntity._parentEntity.name} › ` : ''}{selectedEntity.description}
                  </p>
                )}
              </div>
            </div>
          </div>

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
          {wantsCreate && selectedEntity.fields && (hasModulePermission('data', 'canCreate') || hasEntityPermission(selectedEntity.slug, 'canCreate')) && (
            <RecordFormDialog
              open
              onOpenChange={(open) => { if (!open) router.replace(`/data?entity=${selectedEntity.slug}`); }}
              entity={selectedEntity as unknown as FullEntity}
            />
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
