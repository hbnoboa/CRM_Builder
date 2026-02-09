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
import { useCreateTenant, useUpdateTenant } from '@/hooks/use-tenants';
import type { Tenant } from '@/types';

const createTenantSchemaFn = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
  slug: z.string().min(2, t('slugMinLength')).regex(/^[a-z0-9-]+$/, t('slugFormat')),
  domain: z.string().optional(),
  plan: z.string().optional(),
  adminEmail: z.string().email(t('emailInvalid')),
  adminName: z.string().min(2, t('adminNameMinLength')),
  adminPassword: z.string().min(8, t('passwordMinLength')),
});

const updateTenantSchemaFn = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
  domain: z.string().optional(),
  plan: z.string().optional(),
});

const createTenantSchema = createTenantSchemaFn((key) => key);
const updateTenantSchema = updateTenantSchemaFn((key) => key);

type CreateTenantFormData = z.infer<typeof createTenantSchema>;
type UpdateTenantFormData = z.infer<typeof updateTenantSchema>;

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant | null;
  onSuccess?: () => void;
}

export function TenantFormDialog({ open, onOpenChange, tenant, onSuccess }: TenantFormDialogProps) {
  const t = useTranslations('tenants');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');
  const isEditing = !!tenant;
  const createTenant = useCreateTenant({ success: t('toast.created') });
  const updateTenant = useUpdateTenant({ success: t('toast.updated') });

  const form = useForm<CreateTenantFormData | UpdateTenantFormData>({
    resolver: zodResolver(isEditing ? updateTenantSchemaFn(tValidation) : createTenantSchemaFn(tValidation)),
    defaultValues: {
      name: '',
      slug: '',
      domain: '',
      plan: 'basic',
      adminEmail: '',
      adminName: '',
      adminPassword: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (tenant) {
      form.reset({
        name: tenant.name,
        domain: '',
        plan: tenant.plan || 'basic',
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        domain: '',
        plan: 'basic',
        adminEmail: '',
        adminName: '',
        adminPassword: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, open]);

  const onSubmit = async (data: CreateTenantFormData | UpdateTenantFormData) => {
    try {
      if (isEditing && tenant) {
        await updateTenant.mutateAsync({
          id: tenant.id,
          data: {
            name: data.name,
            domain: data.domain,
            plan: data.plan,
          },
        });
      } else {
        const createData = data as CreateTenantFormData;
        await createTenant.mutateAsync({
          name: createData.name,
          slug: createData.slug,
          domain: createData.domain,
          plan: createData.plan,
          adminEmail: createData.adminEmail,
          adminName: createData.adminName,
          adminPassword: createData.adminPassword,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isLoading = createTenant.isPending || updateTenant.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('title') : t('newTenant')}</DialogTitle>
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

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="slug">{t('form.slug')}</Label>
              <Input
                id="slug"
                placeholder={t('form.slugPlaceholder')}
                {...form.register('slug' as keyof CreateTenantFormData)}
              />
              {(form.formState.errors as Record<string, { message?: string }>).slug && (
                <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).slug?.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="domain">{t('form.domain')}</Label>
            <Input
              id="domain"
              placeholder={t('form.domainPlaceholder')}
              {...form.register('domain')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">{t('form.plan')}</Label>
            <Select
              value={form.watch('plan') || 'basic'}
              onValueChange={(value) => form.setValue('plan', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('form.planPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isEditing && (
            <>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">{t('form.adminTitle')}</h4>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">{t('form.adminName')}</Label>
                <Input
                  id="adminName"
                  placeholder={t('form.adminNamePlaceholder')}
                  {...form.register('adminName' as keyof CreateTenantFormData)}
                />
                {(form.formState.errors as Record<string, { message?: string }>).adminName && (
                  <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).adminName?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">{t('form.adminEmail')}</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder={t('form.adminEmailPlaceholder')}
                  {...form.register('adminEmail' as keyof CreateTenantFormData)}
                />
                {(form.formState.errors as Record<string, { message?: string }>).adminEmail && (
                  <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).adminEmail?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">{t('form.adminPassword')}</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder={t('form.adminPasswordPlaceholder')}
                  {...form.register('adminPassword' as keyof CreateTenantFormData)}
                />
                {(form.formState.errors as Record<string, { message?: string }>).adminPassword && (
                  <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).adminPassword?.message}</p>
                )}
              </div>
            </>
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
