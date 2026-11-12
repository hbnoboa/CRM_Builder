'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useRouter } from '@/i18n/tenant-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomationTab, FieldRulesSection } from '@/components/entity-automation';
import { DeleteEntityPanel, GlobalFiltersPanel, TableSettingsPanel } from '@/components/entity-editor/entity-settings-panels';
import { RequireRole } from '@/components/auth/require-role';
import { DesktopOnlyEditor } from '@/components/layout/desktop-only-editor';
import { usePermissions } from '@/hooks/use-permissions';
import { useDeleteEntity, entityKeys } from '@/hooks/use-entities';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { Entity, EntityField } from '@/types';

type EditorTab = 'fields' | 'settings' | 'rules' | 'filters' | 'automations' | 'danger';

// Editor de campos React (WYSIWYG, componentes reais, react-grid-layout). GrapeJS removido.
//  default      → variante react-grid-layout (fluida, igual ao dashboard)
//  ?editor=dnd  → variante dnd-kit (alternativa)
const ReactFormBuilderGrid = dynamic(
  () => import('@/components/entity-editor/react-form-builder-grid'),
  { ssr: false, loading: () => <div className="h-screen flex items-center justify-center text-muted-foreground">Carregando editor...</div> },
);
const ReactFormBuilderDnd = dynamic(
  () => import('@/components/entity-editor/react-form-builder'),
  { ssr: false, loading: () => <div className="h-screen flex items-center justify-center text-muted-foreground">Carregando editor...</div> },
);

function EntityEditorWrapper() {
  const params = useParams();
  const searchParams = useSearchParams();
  const editorParam = searchParams.get('editor');
  const router = useRouter();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldsUnsaved, setFieldsUnsaved] = useState(false);
  const queryClient = useQueryClient();
  const { hasModulePermission } = usePermissions();
  const deleteEntity = useDeleteEntity({
    success: 'Tabela excluida com sucesso',
    error: 'Erro ao excluir tabela',
  });

  const canDelete = hasModulePermission('entities', 'canDelete');
  const canUpdate = hasModulePermission('entities', 'canUpdate');
  const canAutomations = hasModulePermission('automations', 'canRead');
  // ?tab=automations (link de Integrações) abre direto na aba.
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<EditorTab>(
    initialTab && ['fields', 'settings', 'rules', 'filters', 'automations', 'danger'].includes(initialTab) ? (initialTab as EditorTab) : 'fields',
  );

  useEffect(() => {
    if (params.id) {
      api.get(`/entities/${params.id}`)
        .then((res) => setEntity(res.data))
        .catch(() => { toast.error('Tabela não encontrada'); router.push('/data'); })
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading || !entity) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // Editor React é o único agora (GrapeJS removido).
  const EditorComponent = editorParam === 'dnd' ? ReactFormBuilderDnd : ReactFormBuilderGrid;

  const tabs: { key: EditorTab; label: string; show: boolean }[] = [
    { key: 'fields', label: 'Campos', show: true },
    { key: 'settings', label: 'Ajustes', show: canUpdate },
    { key: 'rules', label: 'Regras de campo', show: canUpdate },
    { key: 'filters', label: 'Filtro global', show: canUpdate },
    { key: 'automations', label: 'Automações', show: canAutomations },
    { key: 'danger', label: 'Excluir', show: canDelete },
  ];
  const fields = (entity.fields ?? []) as EntityField[];

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex h-10 shrink-0 items-center gap-1 border-b bg-muted/40 px-2" data-testid="entity-editor-tabs">
        {tabs.filter((tb) => tb.show).map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            data-testid={`entity-tab-${tb.key}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent',
              tab === tb.key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground',
            )}
          >
            {tb.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1">
        {/* O editor fica montado (só escondido) para não perder campos ainda não salvos. */}
        <div className={cn('h-full', tab !== 'fields' && 'hidden')}>
          <EditorComponent
            entity={entity}
            onSave={async ({ name, description, fields: nextFields, settings }) => {
              const res = await api.patch(`/entities/${params.id}`, {
                name,
                description,
                fields: nextFields,
                settings,
              });
              setEntity(res.data);
              // Invalidate all entity caches so data pages pick up changes immediately
              queryClient.invalidateQueries({ queryKey: entityKeys.all });
            }}
            onCancel={() => router.back()}
            onDirtyChange={setFieldsUnsaved}
          />
        </div>
        {tab !== 'fields' && (
          <div className="h-full overflow-y-auto bg-muted/30 p-6">
            <div className="mx-auto max-w-4xl space-y-4">
              {tab === 'settings' && (
                <TableSettingsPanel
                  entity={entity}
                  fieldsUnsaved={fieldsUnsaved}
                  onSaved={(updated) => {
                    setEntity((prev) => (prev ? { ...prev, settings: updated.settings } : updated));
                    queryClient.invalidateQueries({ queryKey: entityKeys.all });
                  }}
                />
              )}
              {tab === 'rules' && <FieldRulesSection entityId={entity.id} fields={fields} />}
              {tab === 'filters' && (
                <GlobalFiltersPanel
                  entity={entity}
                  onSaved={(updated) => {
                    setEntity(updated);
                    queryClient.invalidateQueries({ queryKey: entityKeys.all });
                  }}
                />
              )}
              {tab === 'automations' && (
                <AutomationTab
                  entityId={entity.id}
                  fields={fields}
                  entityName={entity.name}
                  statusField={(entity.settings as { statusField?: string } | undefined)?.statusField}
                  titleField={(entity.settings as { titleField?: string } | undefined)?.titleField}
                />
              )}
              {tab === 'danger' && (
                <DeleteEntityPanel
                  entity={entity}
                  onDelete={async () => {
                    await deleteEntity.mutateAsync(entity.id);
                    router.push('/gestao/entities');
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EntityDetailPage() {
  return (
    <RequireRole module="entities" action="canUpdate">
      <DesktopOnlyEditor action="editar tabelas">
        <EntityEditorWrapper />
      </DesktopOnlyEditor>
    </RequireRole>
  );
}
