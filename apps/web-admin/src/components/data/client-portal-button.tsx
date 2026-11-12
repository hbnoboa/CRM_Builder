'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Loader2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';

interface RolePerm { entitySlug: string; canRead?: boolean; scope?: string }
interface RoleRow { id: string; name: string; permissions?: RolePerm[] }
interface PortalUser { id: string; name: string; email: string; status: string; customRole?: { name: string } | null }

/** Cargos de portal que servem para esta tabela: tem escopo "do cliente vinculado" e leem a tabela. */
function portalRolesFor(roles: RoleRow[], entitySlug: string): RoleRow[] {
  return roles.filter((r) => {
    const perms = r.permissions || [];
    if (!perms.some((p) => p.scope === 'client')) return false;
    const entry = perms.find((p) => p.entitySlug === entitySlug) ?? perms.find((p) => p.entitySlug === '*');
    return !!entry?.canRead;
  });
}

const suggestPassword = () => `Portal@${Math.floor(1000 + Math.random() * 9000)}`;

/** Endereco de login que o cliente usa: no dominio da empresa e /entrar; no da plataforma, o login normal. */
function loginUrl(): string {
  if (typeof window === 'undefined') return '';
  const { origin, hostname } = window.location;
  return /(^|\.)iossystem\.com\.br$|^localhost$|^127\./.test(hostname) ? `${origin}/pt-BR/login` : `${origin}/entrar`;
}

/**
 * "Portal do cliente" no registro de um cliente (ex.: uma empresa): da login a quem
 * representa esse cliente. Com cargo de escopo "do cliente vinculado", a pessoa entra
 * no sistema e ve so o registro dela e o que esta dentro dele. So aparece quando
 * existe cargo de portal para a tabela e quem esta usando pode criar usuarios.
 */
export function ClientPortalButton({ entitySlug, recordId, recordTitle }: { entitySlug: string; recordId: string; recordTitle?: string | null }) {
  const { hasModulePermission } = usePermissions();
  const canManage = hasModulePermission('users', 'canCreate');
  const qc = useQueryClient();
  const { data: roles } = useQuery({
    queryKey: ['custom-roles', 'portal'],
    queryFn: async () => {
      const res = (await api.get<RoleRow[] | { data: RoleRow[] }>('/custom-roles')).data;
      return Array.isArray(res) ? res : res.data;
    },
    enabled: canManage,
    staleTime: 60_000,
    retry: false,
  });
  const portalRoles = useMemo(() => portalRolesFor(roles ?? [], entitySlug), [roles, entitySlug]);
  const [open, setOpen] = useState(false);
  const users = useQuery({
    queryKey: ['client-portal-users', recordId],
    queryFn: async () => (await api.get<{ data: PortalUser[] }>('/users', { params: { clientRecordId: recordId, limit: 50 } })).data.data,
    enabled: open,
  });
  const [form, setForm] = useState({ name: '', email: '', password: suggestPassword(), roleId: '' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  if (!canManage || portalRoles.length === 0) return null;
  const roleId = form.roleId || (portalRoles.length === 1 ? portalRoles[0].id : '');

  const give = async () => {
    if (!form.name.trim() || !form.email.trim() || !roleId) {
      toast.error('Preencha nome, e-mail e cargo.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', {
        name: form.name.trim(), email: form.email.trim(), password: form.password, customRoleId: roleId,
        clientEntitySlug: entitySlug, clientRecordId: recordId,
      });
      setCreated({ email: form.email.trim(), password: form.password });
      setForm({ name: '', email: '', password: suggestPassword(), roleId: '' });
      await qc.invalidateQueries({ queryKey: ['client-portal-users', recordId] });
      toast.success('Acesso criado!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível criar o acesso.'));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (u: PortalUser) => {
    try {
      await api.patch(`/users/${u.id}`, { status: 'INACTIVE' });
      await qc.invalidateQueries({ queryKey: ['client-portal-users', recordId] });
      toast.success(`${u.name} não entra mais no portal.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível tirar o acesso.'));
    }
  };

  const active = (users.data ?? []).filter((u) => u.status === 'ACTIVE');
  const url = loginUrl();
  const message = created ? `Seu acesso ao portal: ${url}\nE-mail: ${created.email}\nSenha: ${created.password}` : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreated(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0" data-testid="client-portal-button">
          <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Portal do cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="client-portal-dialog">
        <DialogHeader>
          <DialogTitle>Portal do cliente{recordTitle ? ` · ${recordTitle}` : ''}</DialogTitle>
          <DialogDescription>
            Quem tem acesso entra com e-mail e senha e vê só este cadastro e o que está dentro dele.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Quem já tem acesso</p>
          {users.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém ainda.</p>
          ) : (
            <ul className="divide-y rounded-md border" data-testid="client-portal-users">
              {active.map((u) => (
                <li key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}{u.customRole ? ` · ${u.customRole.name}` : ''}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void revoke(u)} title="Tirar acesso">
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {created ? (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm" data-testid="client-portal-created">
            <p className="font-medium">Mande estes dados para o cliente</p>
            <p className="whitespace-pre-line break-all text-xs">{message}</p>
            <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(message); toast.success('Copiado!'); }}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />Copiar
            </Button>
          </div>
        ) : (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-medium">Dar acesso a alguém deste cliente</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="portal-name">Nome</Label>
                <Input id="portal-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="portal-email">E-mail</Label>
                <Input id="portal-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="portal-password">Senha inicial</Label>
                <Input id="portal-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Select value={roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {portalRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => void give()} disabled={saving} data-testid="client-portal-give">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
              Dar acesso
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
