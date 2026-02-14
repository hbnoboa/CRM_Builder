'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateUser, useUpdateUser } from '@/hooks/use-users';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { usePermissions } from '@/hooks/use-permissions';
import type { User, Status } from '@/types';

const createUserSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
  email: z.string().email(t('emailInvalid')),
  password: z.string().min(8, t('passwordMinLength')).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] as const).optional(),
  customRoleId: z.string().min(1, 'Role e obrigatoria'),
});

const userSchema = createUserSchema((key) => key);
type UserFormData = z.infer<typeof userSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSuccess?: () => void;
}

export function UserFormDialog({ open, onOpenChange, user, onSuccess }: UserFormDialogProps) {
  const t = useTranslations('users');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const isEditing = !!user;
  const createUser = useCreateUser({ success: t('toast.created') });
  const updateUser = useUpdateUser({ success: t('toast.updated') });
  const { data: rolesData } = useCustomRoles();
  const customRoles = Array.isArray(rolesData?.data) ? rolesData.data : [];
  const { hasModuleAction } = usePermissions();

  // Buscar role default para novos usuarios
  const defaultRoleId = customRoles.find((r) => r.isDefault)?.id || customRoles[0]?.id || '';

  const form = useForm<UserFormData>({
    resolver: zodResolver(createUserSchema(tValidation)),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      status: 'ACTIVE',
      customRoleId: defaultRoleId,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: '',
        status: user.status,
        customRoleId: user.customRoleId || '',
      });
    } else {
      form.reset({
        name: '',
        email: '',
        password: '',
        status: 'ACTIVE',
        customRoleId: defaultRoleId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, open, defaultRoleId]);

  const onSubmit = async (data: UserFormData) => {
    try {
      if (isEditing && user) {
        const updateData: Record<string, unknown> = {
          name: data.name,
          email: data.email,
          status: data.status,
          customRoleId: data.customRoleId,
        };
        if (data.password) {
          updateData.password = data.password;
        }
        await updateUser.mutateAsync({ id: user.id, data: updateData });
      } else {
        await createUser.mutateAsync({
          name: data.name,
          email: data.email,
          password: data.password || '',
          customRoleId: data.customRoleId,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isLoading = createUser.isPending || updateUser.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editUser') : t('newUser')}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('form.editDescription')
              : t('form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('form.name')}</Label>
            <Input
              id="name"
              placeholder={t('form.namePlaceholder')}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('form.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('form.emailPlaceholder')}
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {t('form.password')} {isEditing && t('form.passwordHint')}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={isEditing ? '********' : t('form.passwordPlaceholder')}
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          {(!isEditing || hasModuleAction('users', 'canAssignRole')) && (
          <div className="space-y-2">
            <Label htmlFor="customRole">{t('form.role')} *</Label>
            <Select
              value={form.watch('customRoleId') || ''}
              onValueChange={(value) => form.setValue('customRoleId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {customRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <span>{role.name}</span>
                      {role.isSystem && (
                        <span className="text-xs text-muted-foreground">
                          ({tRoles(role.roleType)})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.customRoleId && (
              <p className="text-sm text-destructive">{form.formState.errors.customRoleId.message}</p>
            )}
          </div>
          )}

          {isEditing && hasModuleAction('users', 'canChangeStatus') && (
            <div className="space-y-2">
              <Label htmlFor="status">{t('form.status')}</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as Status)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('form.statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{tCommon('active')}</SelectItem>
                  <SelectItem value="INACTIVE">{tCommon('inactive')}</SelectItem>
                  <SelectItem value="SUSPENDED">{tCommon('suspended')}</SelectItem>
                  <SelectItem value="PENDING">{tCommon('pending')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? tCommon('saving') : isEditing ? tCommon('save') : tCommon('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
