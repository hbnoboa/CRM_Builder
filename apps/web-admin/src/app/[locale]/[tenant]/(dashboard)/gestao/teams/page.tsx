'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crown, Loader2, Pencil, Plus, Search, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/use-permissions';
import { useDeleteTeam, useSaveTeam, useSetTeamMembers, useTeams } from '@/hooks/use-teams';
import { useUsers } from '@/hooks/use-users';
import { getErrorMessage } from '@/lib/get-error-message';
import type { Team } from '@/services/teams.service';
import type { User } from '@/types';

const DEFAULT_COLOR = '#6366f1';

export default function TeamsPage() {
  const t = useTranslations('gestao.teams');
  const { hasModulePermission } = usePermissions();
  const canEdit = hasModulePermission('users', 'canUpdate');
  const { data: teams, isLoading } = useTeams();
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [membersOf, setMembersOf] = useState<Team | null>(null);
  const [toDelete, setToDelete] = useState<Team | null>(null);
  const remove = useDeleteTeam();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">{t('subtitle')}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing('new')} data-testid="team-new">
            <Plus className="mr-2 h-4 w-4" /> {t('new')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">{t('scopeHint')}</CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : !teams?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center" data-testid="teams-empty">
            <UsersRound className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{t('empty')}</p>
            <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="teams-list">
          {teams.map((team) => (
            <Card key={team.id} data-testid={`team-${team.name}`}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: team.color ?? DEFAULT_COLOR }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{team.name}</p>
                    {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
                    <p className="text-xs text-muted-foreground">{t('membersCount', { n: team.members.length })}</p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(team)} aria-label={t('edit')} data-testid="team-edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDelete(team)} aria-label={t('delete')} data-testid="team-delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {team.members.map((m) => (
                    <Badge key={m.id} variant={m.isLeader ? 'default' : 'secondary'} className="gap-1" data-testid={`team-member-${m.email}`}>
                      {m.isLeader && <Crown className="h-3 w-3" />}
                      {m.name}
                    </Badge>
                  ))}
                </div>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setMembersOf(team)} data-testid="team-members">
                    <UsersRound className="mr-2 h-4 w-4" /> {t('manageMembers')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && <TeamFormDialog team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {membersOf && <MembersDialog team={membersOf} onClose={() => setMembersOf(null)} />}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle', { name: toDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="team-delete-confirm"
              onClick={() => toDelete && remove.mutate(toDelete.id, {
                onSuccess: () => { toast.success(t('deleted')); setToDelete(null); },
                onError: (e) => toast.error(getErrorMessage(e)),
              })}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TeamFormDialog({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const t = useTranslations('gestao.teams');
  const save = useSaveTeam();
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [color, setColor] = useState(team?.color ?? DEFAULT_COLOR);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? t('editTitle') : t('newTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="team-name">{t('name')}</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="team-description">{t('description')}</Label>
            <Textarea id="team-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="team-color">{t('color')}</Label>
            <input id="team-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button
            disabled={name.trim().length < 2 || save.isPending}
            data-testid="team-save"
            onClick={() => save.mutate({ id: team?.id, name, description, color }, {
              onSuccess: () => { toast.success(t('saved')); onClose(); },
              onError: (e) => toast.error(getErrorMessage(e)),
            })}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ team, onClose }: { team: Team; onClose: () => void }) {
  const t = useTranslations('gestao.teams');
  const { data } = useUsers({ limit: 100 });
  const people: User[] = Array.isArray(data?.data) ? data.data : [];
  const setMembers = useSetTeamMembers();
  const [selected, setSelected] = useState<Map<string, boolean>>(() => new Map(team.members.map((m) => [m.id, m.isLeader])));
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () => people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase())),
    [people, search],
  );

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Map(prev);
    if (next.has(id)) next.delete(id); else next.set(id, false);
    return next;
  });
  const toggleLeader = (id: string) => setSelected((prev) => new Map(prev).set(id, !prev.get(id)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('membersTitle', { name: team.name })}</DialogTitle>
          <DialogDescription>{t('membersHint')}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('searchPeople')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto" data-testid="team-people">
          {visible.map((p) => {
            const on = selected.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted" data-testid={`pick-${p.email}`}>
                <Checkbox id={`pick-${p.id}`} checked={on} onCheckedChange={() => toggle(p.id)} />
                <label htmlFor={`pick-${p.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                </label>
                {on && (
                  <Button
                    type="button" size="sm" variant={selected.get(p.id) ? 'default' : 'ghost'} className="h-7 gap-1 text-xs"
                    onClick={() => toggleLeader(p.id)} data-testid="pick-leader"
                  >
                    <Crown className="h-3 w-3" /> {t('leader')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button
            disabled={setMembers.isPending}
            data-testid="team-members-save"
            onClick={() => setMembers.mutate(
              { id: team.id, members: Array.from(selected.entries()).map(([userId, isLeader]) => ({ userId, isLeader })) },
              { onSuccess: () => { toast.success(t('membersSaved')); onClose(); }, onError: (e) => toast.error(getErrorMessage(e)) },
            )}
          >
            {setMembers.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
