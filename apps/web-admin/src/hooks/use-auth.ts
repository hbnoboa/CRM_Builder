import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authService, UpdateProfileData } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth-store';

export function useUpdateProfile() {
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: (data: UpdateProfileData) => authService.updateProfile(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      toast.success('Perfil atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar perfil');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao alterar senha');
    },
  });
}
