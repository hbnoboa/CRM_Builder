import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authService, UpdateProfileData } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth-store';

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useUpdateProfile(messages?: MutationMessages) {
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: (data: UpdateProfileData) => authService.updateProfile(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useChangePassword(messages?: MutationMessages) {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}
