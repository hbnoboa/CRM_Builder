import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitationsService } from '@/services/invitations.service';

const invitationKeys = { all: ['invitations'] as const };

export function useInvitations(enabled = true) {
  return useQuery({ queryKey: invitationKeys.all, queryFn: invitationsService.list, enabled });
}

function useInvalidating<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['gestao-overview'] });
    },
  });
}

export const useCreateInvitation = () => useInvalidating(invitationsService.create);
export const useResendInvitation = () => useInvalidating(invitationsService.resend);
export const useRevokeInvitation = () => useInvalidating(invitationsService.revoke);
