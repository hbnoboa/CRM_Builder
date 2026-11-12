import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teamsService } from '@/services/teams.service';
import { userKeys } from '@/hooks/use-users';

export const teamKeys = { all: ['teams'] as const };

export function useTeams(enabled = true) {
  return useQuery({ queryKey: teamKeys.all, queryFn: teamsService.list, enabled });
}

/** Mudou equipe: lista de equipes e de usuarios (selos de equipe). */
function useAfter() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: teamKeys.all });
    qc.invalidateQueries({ queryKey: userKeys.all });
  };
}

export function useSaveTeam() {
  const after = useAfter();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; description?: string; color?: string }) =>
      id ? teamsService.update(id, body) : teamsService.create(body),
    onSuccess: after,
  });
}

export function useDeleteTeam() {
  const after = useAfter();
  return useMutation({ mutationFn: teamsService.remove, onSuccess: after });
}

export function useSetTeamMembers() {
  const after = useAfter();
  return useMutation({
    mutationFn: ({ id, members }: { id: string; members: Array<{ userId: string; isLeader: boolean }> }) =>
      teamsService.setMembers(id, members),
    onSuccess: after,
  });
}
