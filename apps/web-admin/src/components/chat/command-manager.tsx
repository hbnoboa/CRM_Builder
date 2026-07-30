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
type FieldDef = { slug: string; label?: string; name?: string; type?: string };
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
  }));
}

export function CommandManager({ open, onOpenChange, entities, roles, onChanged }: Props) {
  const [list, setList] = useState<CommandTpl[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<CommandTpl | null>(null);
  const [saving, setSaving] = useState(false);

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
                        {c.actionType === 'create_record' ? 'cria registro' : 'altera campo'}
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
  draft, setDraft, entities, roles, saving, onSave, onCancel,
}: {
  draft: CommandTpl;
  setDraft: (c: CommandTpl) => void;
  entities: EntityLite[];
  roles: RoleLite[];
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
                <SelectItem value="update_field">Altera um campo (ação)</SelectItem>
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
