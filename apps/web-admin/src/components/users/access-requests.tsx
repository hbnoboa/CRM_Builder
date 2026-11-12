'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { getErrorMessage } from '@/lib/get-error-message';
import type { CustomRole } from '@/types';

interface AccessRequest { id: string; name: string; email: string; createdAt: string }

/**
 * Pedidos de acesso feitos pelo dominio proprio da empresa ("Pedir acesso" no login).
 * Aprovar escolhe o cargo e cria a conta (ou liga uma conta que a pessoa ja tem).
 */
export function AccessRequests({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { tenant } = useTenant();
  const { data: rolesPage } = useCustomRoles();
  const [roleFor, setRoleFor] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ['access-requests'],
    queryFn: async () => (await api.get<AccessRequest[]>('/access-requests')).data,
    refetchInterval: 60_000,
  });

  // So cargos que eu posso dar: abaixo do meu (o dono da empresa da qualquer um)
  const myRank = me?.customRole?.rank ?? Number.MAX_SAFE_INTEGER;
  const iAmOwner = !!me && me.id === tenant?.ownerId;
  const roles = (Array.isArray(rolesPage?.data) ? rolesPage.data : [])
    .filter((r: CustomRole) => iAmOwner || (r.rank ?? 100) > myRank)
    .sort((a: CustomRole, b: CustomRole) => (a.rank ?? 100) - (b.rank ?? 100));
  const defaultRole = roles.find((r: CustomRole) => r.isDefault)?.id ?? roles[roles.length - 1]?.id ?? '';

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) =>
      (await api.post(`/access-requests/${id}/${approve ? 'approve' : 'reject'}`, approve ? { customRoleId: roleFor[id] || defaultRole } : {})).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['access-requests'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(v.approve ? 'Acesso liberado! A pessoa já pode entrar.' : 'Pedido recusado.');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível concluir.')),
  });

  if (!data?.length) return null;

  return (
    <Card className="border-primary/40" data-testid="access-requests">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-primary" />Pedidos de acesso ({data.length})</CardTitle>
        <p className="text-xs text-muted-foreground">Pessoas que pediram para entrar pelo endereço próprio da empresa. Ninguém entra antes de você aprovar.</p>
      </CardHeader>
      <CardContent className="divide-y">
        {data.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5" data-testid="access-request">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">{r.email} · pediu em {new Date(r.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </div>
            {canManage && (
              <>
                <Select value={roleFor[r.id] || defaultRole} onValueChange={(v) => setRoleFor((p) => ({ ...p, [r.id]: v }))}>
                  <SelectTrigger className="h-9 w-40" aria-label="Cargo"><SelectValue placeholder="Cargo" /></SelectTrigger>
                  <SelectContent>{roles.map((role: CustomRole) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={decide.isPending || !(roleFor[r.id] || defaultRole)} onClick={() => decide.mutate({ id: r.id, approve: true })} data-testid="access-approve">
                  {decide.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Aprovar
                </Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: false })}>
                  <X className="mr-1 h-3.5 w-3.5" />Recusar
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
