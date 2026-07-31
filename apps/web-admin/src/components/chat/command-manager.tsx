'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Plus, Pencil, Trash2, ArrowLeft, Bot, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface EntityLite {
  id: string;
  slug: string;
  name: string;
  fields?: unknown[];
}
type FieldDef = { slug: string; label?: string; name?: string; type?: string; options?: unknown };
interface RoleLite { id: string; name: string }

interface CommandTpl {
  id: string;
  slug: string;
  description?: string | null;
  targetEntitySlug?: string | null;
  actionType: string;
  actionConfig?: Record<string, unknown> | null;
  execMode: string;
  elevation?: Record<string, unknown> | null;
  visibleToRoleIds?: string[];
  isActive: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entities: EntityLite[];
  roles: RoleLite[];
  onChanged?: () => void;
}

const emptyDraft = (): CommandTpl => ({
  id: '',
  slug: '',
  description: '',
  targetEntitySlug: '',
  actionType: 'create_record',
  actionConfig: {},
  execMode: 'as_user',
  elevation: { requesterRoles: [], requireConfirmation: true },
  visibleToRoleIds: [],
  isActive: true,
});

function fieldsOf(entities: EntityLite[], slug?: string | null) {
  const e = entities.find((x) => x.slug === slug);
  return ((e?.fields || []) as FieldDef[]).map((f) => ({
    slug: f.slug,
    label: f.label || f.name || f.slug,
    type: f.type || 'text',
    options: (f as { options?: unknown }).options,
  }));
}

/** Normaliza options de select para string[] (aceita string[] ou {value,label}[]). */
function optionsOf(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => (typeof o === 'string' ? o : (o as { value?: string; label?: string })?.value ?? (o as { label?: string })?.label))
    .filter((v): v is string => !!v);
}

type FixedRule = { fieldSlug: string; value: unknown };

/** Editor de VALORES FIXOS: campos que o comando sempre define automaticamente
 *  (o usuário não vê nem preenche). Deixa claro que é definido pelo comando. */
function FixedValues({ title, fields, rules, onChange }: {
  title: string;
  fields: Array<{ slug: string; label: string; type: string; options?: unknown }>;
  rules: FixedRule[];
  onChange: (r: FixedRule[]) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">{title}</label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={fields.length === 0}
          onClick={() => onChange([...rules, { fieldSlug: fields[0]?.slug || '', value: '' }])}>
          + valor fixo
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Definido automaticamente pelo comando — o usuário não vê nem edita. (Ex.: sempre marcar concluído = Sim.)</p>
      {rules.map((r, i) => {
        const fd = fields.find((x) => x.slug === r.fieldSlug);
        const type = fd?.type || 'text';
        const opts = optionsOf(fd?.options);
        const upd = (patch: Partial<FixedRule>) => { const a = [...rules]; a[i] = { ...a[i], ...patch }; onChange(a); };
        return (
          <div key={i} className="flex items-center gap-2">
            <Select value={r.fieldSlug} onValueChange={(v) => upd({ fieldSlug: v, value: '' })}>
              <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{fields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">=</span>
            {type === 'boolean' ? (
              <Select value={String(r.value)} onValueChange={(v) => upd({ value: v === 'true' })}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="valor" /></SelectTrigger>
                <SelectContent><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Não</SelectItem></SelectContent>
              </Select>
            ) : opts.length > 0 ? (
              <Select value={String(r.value ?? '')} onValueChange={(v) => upd({ value: v })}>
                <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="valor" /></SelectTrigger>
                <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input className="h-8 flex-1 text-xs" placeholder="valor" value={String(r.value ?? '')} onChange={(e) => upd({ value: e.target.value })} />
            )}
            <button type="button" className="text-muted-foreground hover:text-destructive px-1" onClick={() => onChange(rules.filter((_, j) => j !== i))}>×</button>
          </div>
        );
      })}
    </div>
  );
}

export function CommandManager({ open, onOpenChange, entities, roles, onChanged }: Props) {
  const [list, setList] = useState<CommandTpl[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<CommandTpl | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfTemplates, setPdfTemplates] = useState<Array<{ id: string; name: string }>>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/chat/commands/manage');
      setList(res.data || []);
    } catch {
      toast.error('Não foi possível carregar os comandos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setEditing(null);
      void reload();
      api.get('/pdf')
        .then((r) => setPdfTemplates((r.data?.data || r.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))))
        .catch(() => setPdfTemplates([]));
    }
  }, [open, reload]);

  const entityName = (slug?: string | null) =>
    entities.find((e) => e.slug === slug)?.name || slug || '—';

  const save = async () => {
    if (!editing) return;
    if (!editing.slug.trim()) return toast.error('Informe o nome do comando.');
    if (!editing.targetEntitySlug) return toast.error('Escolha a tabela-alvo.');
    setSaving(true);
    const payload = {
      slug: editing.slug.trim().replace(/^\//, ''),
      description: editing.description || null,
      targetEntitySlug: editing.targetEntitySlug,
      actionType: editing.actionType,
      actionConfig: editing.actionConfig || {},
      execMode: editing.execMode,
      elevation: editing.actionType === 'update_field' ? editing.elevation : null,
      visibleToRoleIds: editing.visibleToRoleIds || [],
      isActive: editing.isActive,
    };
    try {
      if (editing.id) {
        await api.patch(`/chat/commands/${editing.id}`, payload);
        toast.success('Comando atualizado.');
      } else {
        await api.post('/chat/commands', payload);
        toast.success('Comando criado.');
      }
      setEditing(null);
      await reload();
      onChanged?.();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Erro ao salvar o comando.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cmd: CommandTpl) => {
    if (!window.confirm(`Excluir o comando /${cmd.slug}?`)) return;
    try {
      await api.delete(`/chat/commands/${cmd.id}`);
      toast.success('Comando excluído.');
      await reload();
      onChanged?.();
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? (editing.id ? `Editar /${editing.slug}` : 'Novo comando') : 'Comandos do bot'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Defina o que o comando faz quando alguém digita /nome no chat.'
              : 'Comandos que viram formulários no chat (ex.: /avaria) ou ações elevadas do bot (ex.: /reabrir_veiculo).'}
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setEditing(emptyDraft())}>
                <Plus className="h-4 w-4 mr-1" /> Novo comando
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum comando ainda.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {list.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">/{c.slug}</span>
                        {c.execMode === 'as_bot' ? (
                          <Badge variant="secondary" className="gap-1"><Bot className="h-3 w-3" /> bot</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><UserIcon className="h-3 w-3" /> usuário</Badge>
                        )}
                        {!c.isActive && <Badge variant="destructive">inativo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.description || '—'} · {entityName(c.targetEntitySlug)} ·{' '}
                        {({ create_record: 'cria registro', update_record: 'edita registro', query: 'consulta/relatório', update_field: 'altera campo' } as Record<string, string>)[c.actionType] || c.actionType}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditing({ ...c, elevation: c.elevation || { requesterRoles: [], requireConfirmation: true }, visibleToRoleIds: c.visibleToRoleIds || [] })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <CommandForm
            draft={editing}
            setDraft={setEditing}
            entities={entities}
            roles={roles}
            pdfTemplates={pdfTemplates}
            saving={saving}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CommandForm({
  draft, setDraft, entities, roles, pdfTemplates, saving, onSave, onCancel,
}: {
  draft: CommandTpl;
  setDraft: (c: CommandTpl) => void;
  entities: EntityLite[];
  roles: RoleLite[];
  pdfTemplates: Array<{ id: string; name: string }>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (patch: Partial<CommandTpl>) => setDraft({ ...draft, ...patch });
  const cfg = (draft.actionConfig || {}) as Record<string, unknown>;
  const setCfg = (patch: Record<string, unknown>) => set({ actionConfig: { ...cfg, ...patch } });
  const elev = (draft.elevation || {}) as { requesterRoles?: string[]; requireConfirmation?: boolean };
  const setElev = (patch: Record<string, unknown>) => set({ elevation: { ...elev, ...patch } });

  const targetFields = fieldsOf(entities, draft.targetEntitySlug);
  const quickFields = (cfg.quickFields as string[]) || [];
  const heavyFields = (cfg.heavyFields as string[]) || [];

  const parentSlug = (cfg.parentEntitySlug as string) || '';
  const parentFieldsAll = fieldsOf(entities, parentSlug);
  const parentFields = (cfg.parentFields as string[]) || [];
  const parentLabel = entities.find((e) => e.slug === parentSlug)?.name || 'pai';

  // Filtro FIXO do pai na busca (ex.: /avaria só mostra veículos concluido=false).
  type PFilter = { fieldSlug: string; fieldType?: string; operator: string; value: unknown };
  const parentFilter = (cfg.parentFilter as PFilter[]) || [];
  const setParentFilter = (arr: PFilter[]) => setCfg({ parentFilter: arr });
  const opForType = (t?: string) => (['text', 'textarea', 'string'].includes(t || '') ? 'contains' : 'equals');

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="space-y-4">
      <Section n={1} title="Identidade" subtitle="Como o comando aparece no chat quando alguém digita /nome.">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome do comando</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                value={draft.slug}
                disabled={!!draft.id}
                placeholder="avaria"
                onChange={(e) => set({ slug: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
              />
            </div>
            {draft.id && <p className="text-[10px] text-muted-foreground">O nome não pode ser alterado.</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Descrição</label>
            <Input value={draft.description || ''} placeholder="Registrar avaria do veículo" onChange={(e) => set({ description: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section n={2} title="O que o comando faz" subtitle="A ação executada e sobre qual tabela ela age.">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Ação</label>
            <Select value={draft.actionType} onValueChange={(v) => set({ actionType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="create_record">Cria um registro (formulário)</SelectItem>
                <SelectItem value="update_record">Edita um registro (formulário)</SelectItem>
                <SelectItem value="query">Consulta / relatório</SelectItem>
                <SelectItem value="update_field">Altera um campo (via bot)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Executa como</label>
            <Select value={draft.execMode} onValueChange={(v) => set({ execMode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="as_user">Usuário (com as permissões dele)</SelectItem>
                <SelectItem value="as_bot">Bot (teto próprio / ação elevada)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Tabela-alvo</label>
          <Select value={draft.targetEntitySlug || ''} onValueChange={(v) => set({ targetEntitySlug: v, actionConfig: {} })}>
            <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
            <SelectContent>
              {entities.map((e) => <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

      {draft.actionType === 'create_record' && (
        <div className="space-y-4 rounded-md border p-3">
          <FieldPicker
            title="Campos rápidos (sempre visíveis)"
            fields={targetFields}
            selected={quickFields}
            onToggle={(s) => setCfg({ quickFields: toggle(quickFields, s) })}
          />
          <FieldPicker
            title="Campos pesados (opcionais / recolhidos)"
            fields={targetFields.filter((f) => !quickFields.includes(f.slug))}
            selected={heavyFields}
            onToggle={(s) => setCfg({ heavyFields: toggle(heavyFields, s) })}
          />
          <FixedValues
            title="Valores fixos no registro criado"
            fields={targetFields}
            rules={(cfg.fixedValues as FixedRule[]) || []}
            onChange={(r) => setCfg({ fixedValues: r })}
          />
          <div className="space-y-1">
            <label className="text-xs font-medium">Tabela-pai (opcional)</label>
            <Select value={parentSlug || '__none__'} onValueChange={(v) => setCfg({ parentEntitySlug: v === '__none__' ? '' : v, parentFields: [], parentSearchField: '' })}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {entities.filter((e) => e.slug !== draft.targetEntitySlug).map((e) => (
                  <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Ex.: a avaria pertence a um veículo — escolha o veículo por busca.</p>
          </div>
          {parentSlug && (
            <div className="space-y-3 pl-3 border-l-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Campo de busca do pai</label>
                <Select value={(cfg.parentSearchField as string) || ''} onValueChange={(v) => setCfg({ parentSearchField: v })}>
                  <SelectTrigger><SelectValue placeholder="ex.: chassi" /></SelectTrigger>
                  <SelectContent>
                    {parentFieldsAll.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <FieldPicker
                title="Campos do pai editáveis no formulário"
                fields={parentFieldsAll}
                selected={parentFields}
                onToggle={(s) => setCfg({ parentFields: toggle(parentFields, s) })}
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Filtrar {parentLabel} por (opcional)</label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={parentFieldsAll.length === 0}
                    onClick={() => { const f0 = parentFieldsAll[0]; setParentFilter([...parentFilter, { fieldSlug: f0?.slug || '', fieldType: f0?.type, operator: opForType(f0?.type), value: '' }]); }}>
                    + filtro
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Só aparecem na busca os registros que batem (ex.: concluído = Não).</p>
                {parentFilter.map((flt, i) => {
                  const fd = parentFieldsAll.find((x) => x.slug === flt.fieldSlug);
                  const type = fd?.type || 'text';
                  const opts = optionsOf(fd?.options);
                  const update = (patch: Partial<PFilter>) => { const arr = [...parentFilter]; arr[i] = { ...arr[i], ...patch }; setParentFilter(arr); };
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={flt.fieldSlug} onValueChange={(v) => { const nf = parentFieldsAll.find((x) => x.slug === v); update({ fieldSlug: v, fieldType: nf?.type, operator: opForType(nf?.type), value: '' }); }}>
                        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{parentFieldsAll.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>)}</SelectContent>
                      </Select>
                      {type === 'boolean' ? (
                        <Select value={String(flt.value)} onValueChange={(v) => update({ value: v === 'true' })}>
                          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="valor" /></SelectTrigger>
                          <SelectContent><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Não</SelectItem></SelectContent>
                        </Select>
                      ) : opts.length > 0 ? (
                        <Select value={String(flt.value ?? '')} onValueChange={(v) => update({ value: v })}>
                          <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="valor" /></SelectTrigger>
                          <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input className="h-8 flex-1 text-xs" placeholder="valor" value={String(flt.value ?? '')} onChange={(e) => update({ value: e.target.value })} />
                      )}
                      <button type="button" className="text-muted-foreground hover:text-destructive px-1" onClick={() => setParentFilter(parentFilter.filter((_, j) => j !== i))}>×</button>
                    </div>
                  );
                })}
              </div>
              <FixedValues
                title={`Valores fixos no ${parentLabel} (ex.: concluído = Sim ao registrar)`}
                fields={parentFieldsAll}
                rules={(cfg.parentFixed as FixedRule[]) || []}
                onChange={(r) => setCfg({ parentFixed: r })}
              />
            </div>
          )}
        </div>
      )}

      {draft.actionType === 'update_field' && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Campo a alterar</label>
              <Select value={(cfg.field as string) || ''} onValueChange={(v) => setCfg({ field: v })}>
                <SelectTrigger><SelectValue placeholder="ex.: concluido" /></SelectTrigger>
                <SelectContent>
                  {targetFields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Campo de busca</label>
              <Select value={(cfg.searchField as string) || ''} onValueChange={(v) => setCfg({ searchField: v })}>
                <SelectTrigger><SelectValue placeholder="ex.: chassi" /></SelectTrigger>
                <SelectContent>
                  {targetFields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Novo valor</label>
            <Input
              value={String(cfg.value ?? '')}
              placeholder="false"
              onChange={(e) => {
                const raw = e.target.value;
                const v = raw === 'true' ? true : raw === 'false' ? false : raw;
                setCfg({ value: v });
              }}
            />
            <p className="text-[10px] text-muted-foreground">Use <code>true</code> / <code>false</code> para campos sim/não.</p>
          </div>
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium">Quem pode pedir esta ação</label>
            <div className="grid grid-cols-2 gap-1.5">
              {roles.map((r) => {
                const sel = (elev.requesterRoles || []).includes(r.id);
                return (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={sel} onCheckedChange={() => setElev({ requesterRoles: toggle(elev.requesterRoles || [], r.id) })} />
                    {r.name}
                  </label>
                );
              })}
            </div>
          </div>
          <label className="flex items-center justify-between text-sm">
            <span>Pedir confirmação antes de executar</span>
            <Switch checked={elev.requireConfirmation !== false} onCheckedChange={(v) => setElev({ requireConfirmation: v })} />
          </label>
        </div>
      )}

        {draft.actionType === 'update_record' && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-[11px] text-muted-foreground">Edita um registro existente: o usuário busca o registro, o form abre pré-preenchido e salva.</p>
            <div className="space-y-1">
              <label className="text-xs font-medium">Buscar o registro por</label>
              <Select value={(cfg.searchField as string) || ''} onValueChange={(v) => setCfg({ searchField: v })}>
                <SelectTrigger><SelectValue placeholder="ex.: chassi" /></SelectTrigger>
                <SelectContent>
                  {targetFields.map((f) => <SelectItem key={f.slug} value={f.slug}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <FieldPicker
              title="Campos editáveis no formulário"
              fields={targetFields}
              selected={(cfg.fields as string[]) || []}
              onToggle={(s) => setCfg({ fields: toggle((cfg.fields as string[]) || [], s) })}
            />
            <FixedValues
              title="Valores fixos ao salvar"
              fields={targetFields}
              rules={(cfg.fixedValues as FixedRule[]) || []}
              onChange={(r) => setCfg({ fixedValues: r })}
            />
          </div>
        )}

        {draft.actionType === 'query' && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-[11px] text-muted-foreground">Consulta a tabela com filtros e mostra no chat (card) ou gera relatório (Excel/JSON/PDF).</p>
            <FieldPicker
              title="Colunas do resultado (vazio = todas)"
              fields={targetFields}
              selected={(cfg.columns as string[]) || []}
              onToggle={(s) => setCfg({ columns: toggle((cfg.columns as string[]) || [], s) })}
            />
            <FieldPicker
              title="Filtros que o usuário pode usar (vazio = nenhum)"
              fields={targetFields}
              selected={(cfg.filterFields as string[]) || []}
              onToggle={(s) => setCfg({ filterFields: toggle((cfg.filterFields as string[]) || [], s) })}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Formatos de saída</label>
              <div className="flex flex-wrap gap-3">
                {(['card', 'xlsx', 'json', 'pdf'] as const).map((fmt) => {
                  const formats = (cfg.formats as string[]) || ['card', 'xlsx', 'json', 'pdf'];
                  const label = { card: 'Card no chat', xlsx: 'Excel', json: 'JSON', pdf: 'PDF' }[fmt];
                  return (
                    <label key={fmt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={formats.includes(fmt)} onCheckedChange={() => setCfg({ formats: toggle(formats, fmt) })} />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
            {((cfg.formats as string[]) || ['card', 'xlsx', 'json', 'pdf']).includes('pdf') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">PDF: templates desenhados oferecidos (opcional)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {pdfTemplates.map((t) => {
                    const cur = (cfg.pdfTemplates as Array<{ id: string; name: string }>) || [];
                    const chosen = cur.some((x) => x.id === t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={chosen}
                          onCheckedChange={() => setCfg({ pdfTemplates: chosen ? cur.filter((x) => x.id !== t.id) : [...cur, { id: t.id, name: t.name }] })}
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    );
                  })}
                  {pdfTemplates.length === 0 && <p className="text-xs text-muted-foreground col-span-2">Nenhum template PDF cadastrado.</p>}
                </div>
                <p className="text-[10px] text-muted-foreground">Cada template vira uma opção de PDF no comando (1 doc desenhado por registro, até 300). &quot;Tabela simples&quot; fica sempre disponível.</p>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section n={3} title="Quem vê o comando" subtitle="Vazio = todos os cargos. Selecione para restringir a alguns.">
        <div className="grid grid-cols-2 gap-1.5">
          {roles.map((r) => {
            const sel = (draft.visibleToRoleIds || []).includes(r.id);
            return (
              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={sel} onCheckedChange={() => set({ visibleToRoleIds: toggle(draft.visibleToRoleIds || [], r.id) })} />
                <span className="truncate">{r.name}</span>
              </label>
            );
          })}
          {roles.length === 0 && <p className="text-xs text-muted-foreground col-span-2">Nenhum cargo cadastrado.</p>}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {(draft.visibleToRoleIds || []).length === 0
            ? 'Visível para todos os cargos.'
            : `Restrito a ${(draft.visibleToRoleIds || []).length} cargo(s).`}
        </p>
      </Section>

      <label className="flex items-center justify-between text-sm px-1">
        <span className="font-medium">Comando ativo</span>
        <Switch checked={draft.isActive} onCheckedChange={(v) => set({ isActive: v })} />
      </label>

      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onCancel}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Salvar comando
        </Button>
      </div>
    </div>
  );
}

function Section({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-muted/20">
      <div className="flex items-start gap-2.5 px-3 pt-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{n}</span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-tight">{title}</h4>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="p-3 pt-2.5 space-y-3">{children}</div>
    </section>
  );
}

function FieldPicker({
  title, fields, selected, onToggle,
}: {
  title: string;
  fields: Array<{ slug: string; label: string; type: string }>;
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">{title}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map((f) => (
          <label key={f.slug} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={selected.includes(f.slug)} onCheckedChange={() => onToggle(f.slug)} />
            <span className="truncate">{f.label}</span>
            <span className="text-[10px] text-muted-foreground">{f.type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
