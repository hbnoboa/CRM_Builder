'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { PowerSyncDatabase } from '@powersync/web';
import { ArrowLeft, CloudOff, Loader2, Plus, RefreshCw, Search, Trash2, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { connectOffline, offlineEnabled, openOfflineDb } from '@/lib/offline/offline-db';
import type { OfflineConnector } from '@/lib/offline/connector';
import { readOfflineProfile, type OfflineProfile } from '@/lib/offline/profile';
import { can, fieldRules, type OfflineRole } from '@/lib/offline/permissions';
import { useLocalQuery, useOfflineStatus } from '@/lib/offline/hooks';

type Field = { slug: string; name?: string; label?: string; type: string; required?: boolean; options?: Array<string | { value: string; label?: string }>; subEntitySlug?: string };
type EntityRow = { id: string; name: string; namePlural: string | null; slug: string; fields: string | null; settings: string | null };
type RecordRow = { id: string; data: string | null; createdAt: string | null; parentRecordId: string | null };

/** Tipos que da para editar sem internet; o resto aparece so para leitura. */
const EDITABLE = new Set(['text', 'textarea', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'number', 'currency', 'percentage', 'date', 'datetime', 'time', 'select', 'boolean', 'checkbox']);
const NOT_DATA = new Set(['section-title', 'divider', 'sub-entity', 'hidden', 'action-button']);
const PAGE = 50;

const parseJson = <T,>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};
const fieldLabel = (f: Field) => f.label || f.name || f.slug;
const optionValue = (o: string | { value: string; label?: string }) => (typeof o === 'string' ? o : o.value);
const optionLabel = (o: string | { value: string; label?: string }) => (typeof o === 'string' ? o : o.label || o.value);

function display(value: unknown, yes: string, no: string): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? yes : no;
  if (Array.isArray(value)) return value.map((v) => display(v, yes, no)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const o = value as { label?: unknown; value?: unknown; name?: unknown };
    return String(o.label ?? o.value ?? o.name ?? '');
  }
  return String(value);
}

function titleOf(entity: EntityRow, fields: Field[], data: Record<string, unknown>, yes: string, no: string): string {
  const titleField = parseJson<{ titleField?: string }>(entity.settings, {}).titleField
    || fields.find((f) => ['text', 'email', 'cpf', 'cnpj'].includes(f.type))?.slug;
  return (titleField && display(data[titleField], yes, no)) || '';
}

type View = { kind: 'tables' } | { kind: 'records'; entityId: string } | { kind: 'form'; entityId: string; recordId: string | null };

/**
 * Modo sem internet: tabelas e registros do banco local do aparelho. Alteracoes ficam na
 * fila e sobem sozinhas quando a internet volta (mesmas regras da API).
 */
export function CampoApp({ slug, locale }: { slug: string; locale: string }) {
  const t = useTranslations('offline');
  const [profile, setProfile] = useState<OfflineProfile | null | undefined>(undefined);
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [connector, setConnector] = useState<OfflineConnector | null>(null);
  const [online, setOnline] = useState(true);
  const [view, setView] = useState<View>({ kind: 'tables' });

  useEffect(() => {
    const p = readOfflineProfile(slug);
    setProfile(p && offlineEnabled(p.tenantId, p.userId) ? p : null);
    setOnline(navigator.onLine);
  }, [slug]);

  // Abre o banco local; com internet, sincroniza (baixa e envia a fila)
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const start = async () => {
      const handle = navigator.onLine
        ? await connectOffline(profile.tenantId, profile.userId).catch(() => openOfflineDb(profile.tenantId, profile.userId))
        : await openOfflineDb(profile.tenantId, profile.userId);
      if (!cancelled) { setDb(handle.db); setConnector(handle.connector); }
    };
    void start();
    const goOnline = () => { setOnline(true); void connectOffline(profile.tenantId, profile.userId).catch(() => undefined); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { cancelled = true; window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [profile]);

  const { status, pending } = useOfflineStatus(db);
  const roles = useLocalQuery<OfflineRole & { id: string }>(db, 'SELECT id, permissions, modulePermissions FROM CustomRole WHERE id = ?', [profile?.roleId ?? '']);
  const role: OfflineRole | null = roles.data[0] ?? profile?.role ?? null;

  if (profile === undefined) return null;
  if (profile === null) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <CloudOff className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t('notEnabledTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('notEnabledHint')}</p>
        <Button asChild variant="outline"><a href={`/${locale}/${slug}/settings?tab=offline`}>{t('openSettings')}</a></Button>
      </div>
    );
  }

  const syncing = status?.dataFlowStatus?.downloading || status?.dataFlowStatus?.uploading;
  const neverSynced = status && !status.hasSynced;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur" style={{ borderTop: `4px solid ${profile.brandColor || '#ea580c'}` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          {view.kind !== 'tables' && (
            <Button variant="ghost" size="icon" aria-label={t('back')} data-testid="campo-back"
              onClick={() => setView(view.kind === 'form' ? { kind: 'records', entityId: view.entityId } : { kind: 'tables' })}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{profile.tenantName}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="campo-status">
              {online ? <Wifi className="h-3.5 w-3.5 text-green-600" /> : <CloudOff className="h-3.5 w-3.5 text-amber-600" />}
              {!online ? t('statusOffline') : syncing ? t('statusSyncing') : neverSynced ? t('statusFirstSync') : t('statusSynced')}
              {pending > 0 && <span className="rounded bg-amber-100 px-1.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100" data-testid="campo-pending">{t('pending', { n: pending })}</span>}
            </p>
          </div>
          {online && (
            <Button variant="outline" size="sm" asChild><a href={`/${locale}/${slug}/home`}>{t('backToSystem')}</a></Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        {connector && connector.rejected.length > 0 && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="campo-rejected">
            {t('rejected', { n: connector.rejected.length })}: {connector.rejected.slice(-3).map((r) => r.message).join('; ')}
          </div>
        )}
        {!db ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t('opening')}</div>
        ) : view.kind === 'tables' ? (
          <TablesView db={db} role={role} onOpen={(entityId) => setView({ kind: 'records', entityId })} />
        ) : view.kind === 'records' ? (
          <RecordsView db={db} role={role} entityId={view.entityId}
            onOpen={(recordId) => setView({ kind: 'form', entityId: view.entityId, recordId })} />
        ) : (
          <RecordForm db={db} role={role} profile={profile} online={online} entityId={view.entityId} recordId={view.recordId}
            onDone={() => setView({ kind: 'records', entityId: view.entityId })} />
        )}
      </main>
    </div>
  );
}

function TablesView({ db, role, onOpen }: { db: PowerSyncDatabase; role: OfflineRole | null; onOpen: (id: string) => void }) {
  const t = useTranslations('offline');
  const entities = useLocalQuery<EntityRow>(db, 'SELECT id, name, namePlural, slug, fields, settings FROM Entity ORDER BY name');
  const counts = useLocalQuery<{ entityId: string; n: number }>(db, 'SELECT entityId, count(*) AS n FROM EntityData GROUP BY entityId');
  const byId = useMemo(() => new Map(counts.data.map((c) => [c.entityId, Number(c.n)])), [counts.data]);
  const visible = entities.data.filter((e) => can(role, e.slug, 'canRead'));
  if (entities.loading) return <p className="py-6 text-sm text-muted-foreground">{t('opening')}</p>;
  if (visible.length === 0) return <p className="py-6 text-sm text-muted-foreground">{t('noTables')}</p>;
  return (
    <ul className="divide-y rounded-lg border" data-testid="campo-tables">
      {visible.map((e) => (
        <li key={e.id}>
          <button type="button" onClick={() => onOpen(e.id)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted">
            <span className="font-medium">{e.namePlural || e.name}</span>
            <span className="text-sm text-muted-foreground">{counts.loading ? '…' : (byId.get(e.id) ?? 0).toLocaleString('pt-BR')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RecordsView({ db, role, entityId, onOpen }: { db: PowerSyncDatabase; role: OfflineRole | null; entityId: string; onOpen: (id: string | null) => void }) {
  const t = useTranslations('offline');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const entity = useLocalQuery<EntityRow>(db, 'SELECT id, name, namePlural, slug, fields, settings FROM Entity WHERE id = ?', [entityId]).data[0];
  const [term, setTerm] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setTerm(search.trim()), 300); // espera parar de digitar
    return () => clearTimeout(id);
  }, [search]);
  // LIKE do SQLite ja ignora maiusculas/minusculas
  const records = useLocalQuery<RecordRow>(db,
    `SELECT id, data, createdAt, parentRecordId FROM EntityData WHERE entityId = ? AND (? = '' OR data LIKE ?) ORDER BY createdAt DESC LIMIT ?`,
    [entityId, term, `%${term}%`, limit]);
  if (!entity) return null;
  const fields = parseJson<Field[]>(entity.fields, []);
  const { hidden } = fieldRules(role, entity.slug);
  const shown = fields.filter((f) => !NOT_DATA.has(f.type) && !hidden.has(f.slug) && f.type !== 'image' && f.type !== 'file');
  const yes = t('yes'); const no = t('no');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-lg font-semibold">{entity.namePlural || entity.name}</h1>
        {can(role, entity.slug, 'canCreate') && (
          <Button size="sm" onClick={() => onOpen(null)} data-testid="campo-new"><Plus className="mr-1 h-4 w-4" />{t('new')}</Button>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} placeholder={t('search')} data-testid="campo-search" />
      </div>
      <ul className="divide-y rounded-lg border" data-testid="campo-records">
        {records.data.map((r) => {
          const data = parseJson<Record<string, unknown>>(r.data, {});
          const title = titleOf(entity, shown, data, yes, no) || t('untitled');
          const extra = shown.slice(0, 4).map((f) => display(data[f.slug], yes, no)).filter((v) => v && v !== title).slice(0, 2);
          return (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)} className="w-full px-4 py-3 text-left hover:bg-muted">
                <span className="block truncate font-medium">{title}</span>
                {extra.length > 0 && <span className="block truncate text-xs text-muted-foreground">{extra.join(' · ')}</span>}
              </button>
            </li>
          );
        })}
        {!records.loading && records.data.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">{t('noRecords')}</li>}
      </ul>
      {records.data.length >= limit && (
        <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>{t('more')}</Button>
      )}
    </div>
  );
}

function FieldInput({ field, value, disabled, onChange, yes, no }: {
  field: Field; value: unknown; disabled: boolean; onChange: (v: unknown) => void; yes: string; no: string;
}) {
  const id = `campo-${field.slug}`;
  const str = value === null || value === undefined ? '' : typeof value === 'object' ? display(value, yes, no) : String(value);
  switch (field.type) {
    case 'textarea':
      return <Textarea id={id} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case 'number': case 'currency': case 'percentage':
      return <Input id={id} type="number" inputMode="decimal" value={str} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'date':
      return <Input id={id} type="date" value={str.slice(0, 10)} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />;
    case 'datetime':
      return <Input id={id} type="datetime-local" value={str ? str.slice(0, 16) : ''} disabled={disabled}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
    case 'time':
      return <Input id={id} type="time" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />;
    case 'boolean': case 'checkbox':
      return <Switch id={id} checked={value === true || value === 'true'} disabled={disabled} onCheckedChange={(v) => onChange(v)} />;
    case 'select': {
      const current = value && typeof value === 'object' ? String((value as { value?: unknown }).value ?? '') : str;
      return (
        <select id={id} value={current} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="" />
          {(field.options ?? []).map((o) => <option key={optionValue(o)} value={optionValue(o)}>{optionLabel(o)}</option>)}
        </select>
      );
    }
    default:
      return <Input id={id} type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
        value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
}

function RecordForm({ db, role, profile, online, entityId, recordId, onDone }: {
  db: PowerSyncDatabase; role: OfflineRole | null; profile: OfflineProfile; online: boolean;
  entityId: string; recordId: string | null; onDone: () => void;
}) {
  const t = useTranslations('offline');
  const yes = t('yes'); const no = t('no');
  const entity = useLocalQuery<EntityRow>(db, 'SELECT id, name, namePlural, slug, fields, settings FROM Entity WHERE id = ?', [entityId]).data[0];
  const record = useLocalQuery<RecordRow>(db, 'SELECT id, data, createdAt, parentRecordId FROM EntityData WHERE id = ?', [recordId ?? '']).data[0];
  // Tabela-filha: quem e a tabela-pai (campo sub-entity que aponta para esta)
  const allEntities = useLocalQuery<EntityRow>(db, 'SELECT id, name, namePlural, slug, fields, settings FROM Entity');
  const parentEntity = useMemo(() => entity && allEntities.data.find((e) =>
    parseJson<Field[]>(e.fields, []).some((f) => f.type === 'sub-entity' && f.subEntitySlug === entity.slug)), [allEntities.data, entity]);
  const parents = useLocalQuery<RecordRow>(db,
    'SELECT id, data, createdAt, parentRecordId FROM EntityData WHERE entityId = ? ORDER BY createdAt DESC LIMIT 300', [parentEntity?.id ?? '']);
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recordId && !record) return;
    setValues(record ? parseJson<Record<string, unknown>>(record.data, {}) : {});
    setParentId(record?.parentRecordId ?? '');
  }, [record, recordId]);

  const save = useCallback(async () => {
    if (!entity || !values) return;
    const fields = parseJson<Field[]>(entity.fields, []);
    const { hidden } = fieldRules(role, entity.slug);
    const missing = fields.filter((f) => f.required && EDITABLE.has(f.type) && !hidden.has(f.slug)
      && (values[f.slug] === undefined || values[f.slug] === null || values[f.slug] === ''));
    if (missing.length) { toast.error(t('required', { fields: missing.map(fieldLabel).join(', ') })); return; }
    if (!recordId && parentEntity && !parentId) { toast.error(t('chooseParent', { parent: parentEntity.name })); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (recordId) {
        await db.execute('UPDATE EntityData SET data = ?, updatedAt = ?, updatedById = ? WHERE id = ?', [JSON.stringify(values), now, profile.userId, recordId]);
      } else {
        await db.execute(
          'INSERT INTO EntityData (id, tenantId, entityId, data, parentRecordId, createdById, updatedById, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), profile.tenantId, entity.id, JSON.stringify(values), parentId || null, profile.userId, profile.userId, now, now]);
      }
      toast.success(online ? t('savedOnline') : t('savedOffline'));
      onDone();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [db, entity, values, role, recordId, parentEntity, parentId, profile, online, onDone, t]);

  const remove = async () => {
    if (!recordId || !window.confirm(t('confirmDelete'))) return;
    await db.execute('DELETE FROM EntityData WHERE id = ?', [recordId]);
    toast.success(online ? t('deletedOnline') : t('deletedOffline'));
    onDone();
  };

  if (!entity || !values) return null;
  const fields = parseJson<Field[]>(entity.fields, []);
  const { hidden, readOnly } = fieldRules(role, entity.slug);
  const canWrite = recordId ? can(role, entity.slug, 'canUpdate') : can(role, entity.slug, 'canCreate');
  const parentFields = parseJson<Field[]>(parentEntity?.fields, []);

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }} data-testid="campo-form">
      <h1 className="text-lg font-semibold">{recordId ? titleOf(entity, fields, values, yes, no) || entity.name : t('newOf', { name: entity.name })}</h1>
      {!recordId && parentEntity && (
        <div className="space-y-1.5">
          <Label htmlFor="campo-parent">{parentEntity.name}</Label>
          <select id="campo-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} data-testid="campo-parent"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="" />
            {parents.data.map((p) => (
              <option key={p.id} value={p.id}>{titleOf(parentEntity, parentFields, parseJson(p.data, {}), yes, no) || p.id}</option>
            ))}
          </select>
        </div>
      )}
      {fields.filter((f) => !NOT_DATA.has(f.type) && !hidden.has(f.slug)).map((f) => {
        const editable = EDITABLE.has(f.type);
        return (
          <div key={f.slug} className="space-y-1.5">
            <Label htmlFor={`campo-${f.slug}`}>{fieldLabel(f)}{f.required && editable ? ' *' : ''}</Label>
            {editable ? (
              <FieldInput field={f} value={values[f.slug]} disabled={!canWrite || readOnly.has(f.slug)} yes={yes} no={no}
                onChange={(v) => setValues((cur) => ({ ...(cur ?? {}), [f.slug]: v }))} />
            ) : (
              <p className={cn('rounded-md border bg-muted/40 px-3 py-2 text-sm', !display(values[f.slug], yes, no) && 'text-muted-foreground')}>
                {display(values[f.slug], yes, no) || t('onlyOnline')}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2 pt-2">
        {canWrite && (
          <Button type="submit" disabled={saving} data-testid="campo-save">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('save')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onDone}>{t('cancel')}</Button>
        <span className="flex-1" />
        {recordId && can(role, entity.slug, 'canDelete') && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => void remove()} data-testid="campo-delete">
            <Trash2 className="mr-1 h-4 w-4" />{t('delete')}
          </Button>
        )}
      </div>
      {!online && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5" />{t('willSync')}</p>}
    </form>
  );
}
