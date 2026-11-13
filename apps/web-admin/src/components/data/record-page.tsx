'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OptionBadge } from '@/components/ui/option-badge';
import { TrackingLinkButton } from '@/components/site/tracking-link-button';
import { useEntities, useEntityBySlug } from '@/hooks/use-entities';
import { useEntityDataItem } from '@/hooks/use-data';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth-store';
import { ClientPortalButton } from './client-portal-button';
import { RecordFormFields, useRecordHeader } from './record-form-dialog';
import { RecordPageNavContext, recordPath, safeBack, useOpenRecord, type RecordPageNav } from './record-nav';

export { recordPath, useOpenRecord } from './record-nav';

// ─── Página ───────────────────────────────────────────────────────────────────

interface RecordPageProps {
  entitySlug: string;
  /** Sem id: criação. */
  recordId?: string;
}

export function RecordPage({ entitySlug, recordId }: RecordPageProps) {
  const t = useTranslations('data');
  const tp = useTranslations('data.recordPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = !recordId;
  const parentParam = searchParams.get('pai') || undefined;
  const backParam = safeBack(searchParams.get('voltar'));

  const { data: entity, isLoading: entityLoading } = useEntityBySlug(entitySlug);
  const { data: record, isLoading: recordLoading, isError: recordError } = useEntityDataItem(entitySlug, recordId || '');

  // Tabela-pai (a que tem esta como sub-tabela) e registro-pai, para "Dentro de ..." e para voltar
  const { data: allEntities } = useEntities({ limit: 200 });
  const parentEntity = useMemo(() => (allEntities?.data || []).find((e) => (e.fields || []).some(
    (f) => f.type === 'sub-entity' && (f.subEntitySlug === entitySlug || (!!entity && f.subEntityId === entity.id)),
  )), [allEntities, entitySlug, entity]);
  const parentId = (record as { parentRecordId?: string | null } | undefined)?.parentRecordId || parentParam;
  const { data: parentRecord } = useEntityDataItem(parentEntity?.slug || '', parentId || '');
  const parentHeader = useRecordHeader(parentEntity ?? { fields: [] }, parentRecord ? { id: parentRecord.id, data: parentRecord.data } : null);

  // Permissões (mesma regra da tabela): no portal do cliente vale só a da tabela
  const { hasModulePermission, hasEntityPermission } = usePermissions();
  const portal = !!useAuthStore((s) => s.user?.clientPortal);
  const can = (action: 'canCreate' | 'canUpdate') =>
    portal ? hasEntityPermission(entitySlug, action) : hasModulePermission('data', action) || hasEntityPermission(entitySlug, action);
  const readOnly = !isNew && !can('canUpdate');

  // Alteração não salva: pergunta antes de sair pela página e ao fechar a guia
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
  const confirmLeave = useCallback(() => !dirtyRef.current || window.confirm(tp('unsavedLeave')), [tp]);
  const guardLink = useCallback((e: ReactMouseEvent) => { if (!confirmLeave()) e.preventDefault(); }, [confirmLeave]);
  const openRecord = useOpenRecord(confirmLeave);
  const nav = useMemo<RecordPageNav>(() => ({ openRecord }), [openRecord]);

  // Para onde voltar: a tela de origem; senão o registro-pai; senão a lista da tabela
  const fallbackBack = parentEntity && parentId ? recordPath(parentEntity.slug, parentId) : `/data?entity=${entitySlug}`;
  const backHref = backParam || fallbackBack;
  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(backHref);
  }, [confirmLeave, router, backHref]);

  const header = useRecordHeader(entity ?? { fields: [] }, record ? { id: record.id, data: record.data } : null);
  const subEntityField = (entity?.fields || []).find((f) => f.type === 'sub-entity');

  const handleSubmitted = useCallback((saved?: { id: string }) => {
    setDirty(false);
    dirtyRef.current = false;
    // Criou um registro que tem sub-tabela: segue para a página dele, para adicionar os filhos
    if (isNew && saved?.id && subEntityField) {
      toast.success(tp('createdAddChildren', { name: (subEntityField.label || subEntityField.name || '').toLowerCase() }));
      router.replace(recordPath(entitySlug, saved.id, { back: backParam || undefined }));
      return;
    }
    router.push(backHref);
  }, [isNew, subEntityField, tp, router, entitySlug, backParam, backHref]);

  const loading = entityLoading || (!isNew && recordLoading);
  const entityLabel = entity?.namePlural || entity?.name || entitySlug;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const blocked = !entity || (!isNew && (recordError || !record)) || (isNew && !can('canCreate'));
  if (blocked) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(backHref)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />{tp('back')}
        </Button>
        <Card className="p-8 text-center text-muted-foreground" data-testid="record-page-blocked">
          {isNew && entity ? tp('noPermission') : tp('notFound')}
        </Card>
      </div>
    );
  }

  const formRecord = record ? { id: record.id, data: record.data } : null;
  const title = isNew ? t('newRecord') : (header.recordTitle ?? entity.name);

  return (
    <RecordPageNavContext.Provider value={nav}>
      <div className="mx-auto max-w-4xl space-y-4" data-testid="record-page">
        {/* Trilha: Registros › Tabela (› Pai) › Registro */}
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="breadcrumb">
          <Link href="/data" className="hover:text-foreground" onClick={guardLink}>{tp('records')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {parentEntity && parentId ? (
            <>
              <Link href={`/data?entity=${parentEntity.slug}`} className="hover:text-foreground" onClick={guardLink}>
                {parentEntity.namePlural || parentEntity.name}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href={recordPath(parentEntity.slug, parentId)} className="hover:text-foreground" onClick={guardLink}>
                {parentHeader.recordTitle ?? parentEntity.name}
              </Link>
            </>
          ) : (
            <Link href={`/data?entity=${entitySlug}`} className="hover:text-foreground" onClick={guardLink}>
              {entityLabel}
            </Link>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate text-foreground">{title}</span>
        </nav>

        <Card className="overflow-hidden">
          {/* Cabeçalho do registro */}
          <div className="flex items-start gap-3 border-b px-6 py-4">
            <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8 shrink-0" onClick={goBack} aria-label={tp('back')} data-testid="record-page-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span
              className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
              style={header.entityColor ? { backgroundColor: header.entityColor } : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {!isNew && !readOnly ? `${t('editRecord')} · ${entity.name}` : entity.name}
                {parentEntity && parentId && ` · ${tp('inside')} ${parentHeader.recordTitle ?? parentEntity.name}`}
              </p>
              <h1 className="mt-0.5 truncate text-xl font-semibold leading-tight">{title}</h1>
            </div>
            {header.statusOption && <OptionBadge label={header.statusOption.label} color={header.statusOption.color} className="mt-1" />}
            {!isNew && record?.id && <TrackingLinkButton entitySlug={entity.slug} entityName={entity.name} recordId={record.id} />}
            {!isNew && record?.id && <ClientPortalButton entitySlug={entity.slug} recordId={record.id} recordTitle={header.recordTitle} />}
          </div>

          <div className="px-6 pt-5">
            <RecordFormFields
              key={record?.id ?? 'novo'}
              entity={entity as unknown as Parameters<typeof RecordFormFields>[0]['entity']}
              record={formRecord}
              parentRecordId={isNew ? parentParam : undefined}
              readOnly={readOnly}
              onDirtyChange={setDirty}
              onCancel={goBack}
              onSubmitted={handleSubmitted}
            />
          </div>
        </Card>
      </div>
    </RecordPageNavContext.Provider>
  );
}

