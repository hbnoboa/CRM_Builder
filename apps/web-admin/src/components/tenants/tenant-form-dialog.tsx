'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Camera, X } from 'lucide-react';
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
import { useCreateTenant, useUpdateTenant } from '@/hooks/use-tenants';
import api from '@/lib/api';
import type { Tenant } from '@/types';

const createTenantSchemaFn = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
  slug: z.string().min(2, t('slugMinLength')).regex(/^[a-z0-9-]+$/, t('slugFormat')),
  adminEmail: z.string().email(t('emailInvalid')),
  adminName: z.string().min(2, t('adminNameMinLength')),
  adminPassword: z.string().min(8, t('passwordMinLength')),
});

const updateTenantSchemaFn = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const form = useForm<CreateTenantFormData | UpdateTenantFormData>({
    resolver: zodResolver(isEditing ? updateTenantSchemaFn(tValidation) : createTenantSchemaFn(tValidation)),
    defaultValues: {
      name: '',
      slug: '',
      adminEmail: '',
      adminName: '',
      adminPassword: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setLogoFile(null);
    if (tenant) {
      form.reset({
        name: tenant.name,
        slug: tenant.slug,
        adminEmail: '',
        adminName: '',
        adminPassword: '',
      });
      setLogoPreview(tenant.logo || null);
    } else {
      form.reset({
        name: '',
        slug: '',
        adminEmail: '',
        adminName: '',
        adminPassword: '',
      });
      setLogoPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, open]);

  // Slug automatico: gera a partir do nome
  useEffect(() => {
    if (!isEditing) {
      const name = form.watch('name');
      if (name) {
        const autoSlug = name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .replace(/--+/g, '-');
        form.setValue('slug', autoSlug);
      }
    }
  }, [form.watch('name'), isEditing]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoRemove = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    const formData = new FormData();
    formData.append('image', logoFile);
    formData.append('folder', 'logos');
    const res = await api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.url || res.data?.publicUrl || null;
  };

  const onSubmit = async (data: CreateTenantFormData | UpdateTenantFormData) => {
    try {
      let logoUrl: string | null | undefined;
      if (logoFile) {
        logoUrl = await uploadLogo();
      } else if (logoPreview === null && tenant?.logo) {
        // User removed the logo
        logoUrl = '';
      }

      if (isEditing && tenant) {
        await updateTenant.mutateAsync({
          id: tenant.id,
          data: {
            name: data.name,
            ...(logoUrl !== undefined ? { logo: logoUrl } : {}),
          },
        });
      } else {
        const createData = data as CreateTenantFormData;
        await createTenant.mutateAsync({
          name: createData.name,
          slug: createData.slug,
          adminEmail: createData.adminEmail,
          adminName: createData.adminName,
          adminPassword: createData.adminPassword,
          ...(logoUrl ? { logo: logoUrl } : {}),
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isLoading = createTenant.isPending || updateTenant.isPending;
  const nameValue = form.watch('name');
  const initials = (nameValue || tenant?.name || '?').slice(0, 2).toUpperCase();

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
          {/* Logo upload */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex items-center justify-center overflow-hidden transition-colors bg-muted"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">{initials}</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoSelect}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {t('form.logoHint')}
            </div>
          </div>

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
                readOnly
              />
              {(form.formState.errors as Record<string, { message?: string }>).slug && (
                <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).slug?.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Slug gerado automaticamente a partir do nome.</p>
            </div>
          )}

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
