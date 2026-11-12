'use client';

import { Loader2, Pencil } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { useEntities } from '@/hooks/use-entities';
import { cn } from '@/lib/utils';

type Perm = {
  entitySlug: string;
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  scope?: 'all' | 'own' | 'team' | 'client';
};

type RoleLike = {
  id: string;
  name: string;
  color?: string | null;
  permissions?: Perm[];
  modulePermissions?: Record<string, unknown> & { allAccess?: boolean };
};

/** "Vê, cria e edita · só os que criou" (ou "Sem acesso"). */
function describe(perm: Perm | undefined, full: boolean): { text: string; level: 'none' | 'some' | 'all' } {
  if (full) return { text: 'Tudo', level: 'all' };
  if (!perm) return { text: 'Sem acesso', level: 'none' };
  const verbs = [perm.canRead && 'vê', perm.canCreate && 'cria', perm.canUpdate && 'edita', perm.canDelete && 'exclui'].filter(Boolean) as string[];
  if (verbs.length === 0) return { text: 'Sem acesso', level: 'none' };
  const sentence = verbs.length > 1 ? `${verbs.slice(0, -1).join(', ')} e ${verbs[verbs.length - 1]}` : verbs[0];
  const whose = perm.scope === 'own' ? 'só os que criou' : perm.scope === 'team' ? 'os da equipe' : perm.scope === 'client' ? 'só os do cliente vinculado' : 'todos';
  return { text: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} · ${whose}`, level: verbs.length === 4 && (perm.scope ?? 'all') === 'all' ? 'all' : 'some' };
}

/** Quais telas da administracao o cargo abre (resumo). */
function adminAccess(role: RoleLike): string {
  const mp = role.modulePermissions || {};
  if (mp.allAccess) return 'Tudo';
  const ADMIN_MODULES: Array<[string, string]> = [
    ['users', 'Usuários'], ['roles', 'Cargos'], ['entities', 'Tabelas'], ['pdfTemplates', 'Modelos de PDF'],
    ['dashboardTemplates', 'Painéis'], ['automations', 'Automações'], ['settings', 'Empresa'],
  ];
  const open = ADMIN_MODULES.filter(([key]) => {
    const p = mp[key] as Record<string, unknown> | undefined;
    return p && Object.values(p).some((v) => v === true);
  }).map(([, label]) => label);
  return open.length ? open.join(', ') : 'Nenhuma';
}

/**
 * Guia de permissoes: o que cada cargo REAL da empresa faz em cada tabela, em
 * frases. So leitura; para mudar, abre o cargo.
 */
export default function PermissionsPage() {
  const { data: rolesPage, isLoading: loadingRoles } = useCustomRoles({ limit: 100, sortBy: "rank", sortOrder: "asc" });
  const { data: entitiesPage, isLoading: loadingEntities } = useEntities({ limit: 200 });
  const roles = ((rolesPage as { data?: RoleLike[] } | undefined)?.data || []) as RoleLike[];
  const entities = entitiesPage?.data || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <GestaoPageHeader
        help="module.permissions"
        title="Guia de permissões"
        subtitle="O que cada cargo pode fazer em cada tabela e quais telas da administração ele abre. Para mudar, edite o cargo."
        actions={<Button asChild variant="outline"><Link href="/gestao/roles"><Pencil className="mr-1.5 h-4 w-4" />Editar cargos</Link></Button>}
      />

      {loadingRoles || loadingEntities ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <Card className="overflow-x-auto" data-testid="permissions-matrix">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Tabela</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" style={r.color ? { backgroundColor: r.color } : undefined} />
                      {r.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  {roles.map((r) => {
                    const full = !!r.modulePermissions?.allAccess;
                    const perms = r.permissions || [];
                    const perm = perms.find((p) => p.entitySlug === e.slug) ?? perms.find((p) => p.entitySlug === '*');
                    const d = describe(perm, full);
                    return (
                      <td key={r.id} className="px-4 py-3">
                        <span className={cn(
                          'text-xs',
                          d.level === 'none' && 'text-muted-foreground/70',
                          d.level === 'all' && 'font-medium text-emerald-700 dark:text-emerald-400',
                        )}>
                          {d.text}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td className="px-4 py-3 font-medium">Telas da administração</td>
                {roles.map((r) => (
                  <td key={r.id} className="px-4 py-3 text-xs text-muted-foreground">{adminAccess(r)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
