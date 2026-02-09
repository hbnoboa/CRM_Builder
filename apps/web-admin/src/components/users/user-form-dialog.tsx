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
import type { User, UserRole, Status } from '@/types';

const createUserSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
  email: z.string().email(t('emailInvalid')),
  password: z.string().min(8, t('passwordMinLength')).optional().or(z.literal('')),
  role: z.enum(['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER'] as const),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] as const).optional(),
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

  const form = useForm<UserFormData>({
    resolver: zodResolver(createUserSchema(tValidation)),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'USER',
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        status: user.status,
      });
    } else {
      form.reset({
        name: '',
        email: '',
        password: '',
        role: 'USER',
        status: 'ACTIVE',
      });
    }
  }, [user, form]);

  const onSubmit = async (data: UserFormData) => {
    try {
      if (isEditing && user) {
        const updateData: Record<string, unknown> = {
          name: data.name,
          email: data.email,
          role: data.role,
          status: data.status,
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
          role: data.role as UserRole,
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

          <div className="space-y-2">
            <Label htmlFor="role">{t('form.role')}</Label>
            <Select
              value={form.watch('role')}
              onValueChange={(value) => form.setValue('role', value as UserRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{tRoles('ADMIN')}</SelectItem>
                <SelectItem value="MANAGER">{tRoles('MANAGER')}</SelectItem>
                <SelectItem value="USER">{tRoles('USER')}</SelectItem>
                <SelectItem value="VIEWER">{tRoles('VIEWER')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isEditing && (
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
