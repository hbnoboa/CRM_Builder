'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Camera, X, Palette, RotateCcw } from 'lucide-react';
import { generateThemeVariables, PRESET_COLORS } from '@/lib/generate-theme';
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
import { useTenant } from '@/stores/tenant-context';
import api from '@/lib/api';
import type { Tenant } from '@/types';

const createTenantSchemaFn = (t: (key: string) => string) => z.object({
  name: z.string().min(2, t('nameMinLength')),
  slug: z.string().min(2, t('slugMinLength')).regex(/^[a-z0-9-]+$/, t('slugFormat')),
  adminEmail: z.string().optional().or(z.literal('')),
  adminName: z.string().optional().or(z.literal('')),
  adminPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  const hasEmail = data.adminEmail && data.adminEmail.length > 0;
  const hasName = data.adminName && data.adminName.length > 0;
  const hasPassword = data.adminPassword && data.adminPassword.length > 0;

  // Se algum campo estiver preenchido, todos devem estar
  if (hasEmail || hasName || hasPassword) {
    return hasEmail && hasName && hasPassword;
  }
  // Se nenhum estiver preenchido, está ok
  return true;
}, {
  message: t('adminFieldsRequired'),
  path: ['adminEmail'],
}).refine((data) => {
  // Se email foi preenchido, validar formato
  if (data.adminEmail && data.adminEmail.length > 0) {
    return z.string().email().safeParse(data.adminEmail).success;
  }
  return true;
}, {
  message: t('emailInvalid'),
  path: ['adminEmail'],
}).refine((data) => {
  // Se nome foi preenchido, validar tamanho mínimo
  if (data.adminName && data.adminName.length > 0) {
    return data.adminName.length >= 2;
  }
  return true;
}, {
  message: t('adminNameMinLength'),
  path: ['adminName'],
}).refine((data) => {
  // Se senha foi preenchida, validar tamanho mínimo
  if (data.adminPassword && data.adminPassword.length > 0) {
    return data.adminPassword.length >= 8;
  }
  return true;
}, {
  message: t('passwordMinLength'),
  path: ['adminPassword'],
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
  const { refresh: refreshTenantContext } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState<string>('');
  const [secondaryColor, setSecondaryColor] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('');
  const [darkModePreference, setDarkModePreference] = useState<'light' | 'dark' | 'system'>('system');

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
      const settings = tenant.settings as Record<string, any> | undefined;
      setBrandColor(settings?.theme?.brandColor || '');
      setSecondaryColor(settings?.theme?.secondaryColor || '');
      setAccentColor(settings?.theme?.accentColor || '');
      setDarkModePreference(settings?.theme?.darkMode || 'system');
    } else {
      form.reset({
        name: '',
        slug: '',
        adminEmail: '',
        adminName: '',
        adminPassword: '',
      });
      setLogoPreview(null);
      setBrandColor('');
      setSecondaryColor('');
      setAccentColor('');
      setDarkModePreference('system');
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
        const existingSettings = (tenant.settings as Record<string, any>) || {};
        const themeSettings = brandColor
          ? {
              brandColor,
              secondaryColor: secondaryColor || undefined,
              accentColor: accentColor || undefined,
              darkMode: darkModePreference
            }
          : undefined;

        await updateTenant.mutateAsync({
          id: tenant.id,
          data: {
            name: data.name,
            ...(logoUrl !== undefined ? { logo: logoUrl } : {}),
            settings: {
              ...existingSettings,
              theme: themeSettings,
            },
          },
        });
      } else {
        const createData = data as CreateTenantFormData;

        // Only include admin fields if they are filled
        const payload: any = {
          name: createData.name,
          slug: createData.slug,
        };

        if (createData.adminEmail && createData.adminName && createData.adminPassword) {
          payload.adminEmail = createData.adminEmail;
          payload.adminName = createData.adminName;
          payload.adminPassword = createData.adminPassword;
        }

        if (logoUrl) {
          payload.logo = logoUrl;
        }

        await createTenant.mutateAsync(payload);
      }
      onOpenChange(false);
      onSuccess?.();
      // Refresh TenantContext so allTenants picks up updated theme settings
      refreshTenantContext();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isLoading = createTenant.isPending || updateTenant.isPending;
  const nameValue = form.watch('name');
  const initials = (nameValue || tenant?.name || '?').slice(0, 2).toUpperCase();

  // Live preview of theme colors
  const themePreview = useMemo(() => {
    if (!brandColor) return null;
    try {
      return generateThemeVariables(
        brandColor,
        secondaryColor || undefined,
        accentColor || undefined
      );
    } catch {
      return null;
    }
  }, [brandColor, secondaryColor, accentColor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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
                <h4 className="font-medium mb-2">{t('form.adminTitle')}</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('form.adminOptionalHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">{t('form.adminName')} <span className="text-muted-foreground text-xs">({tCommon('optional')})</span></Label>
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
                <Label htmlFor="adminEmail">{t('form.adminEmail')} <span className="text-muted-foreground text-xs">({tCommon('optional')})</span></Label>
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
                <Label htmlFor="adminPassword">{t('form.adminPassword')} <span className="text-muted-foreground text-xs">({tCommon('optional')})</span></Label>
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

          {/* Theme Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('form.themeTitle')}
              </h4>
              {brandColor && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setBrandColor(''); setDarkModePreference('system'); }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('form.themeReset')}
                </Button>
              )}
            </div>

            {/* Color Picker */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t('form.brandColor')}</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={brandColor || '#2563eb'}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer bg-transparent p-0.5"
                    />
                  </div>
                  <Input
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandColor(v);
                    }}
                    placeholder="#2563eb"
                    className="w-28 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2">
                <Label>{t('form.secondaryColor')}</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={secondaryColor || '#7c3aed'}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer bg-transparent p-0.5"
                    />
                  </div>
                  <Input
                    value={secondaryColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) setSecondaryColor(v);
                    }}
                    placeholder="#7c3aed"
                    className="w-28 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <Label>{t('form.accentColor')}</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={accentColor || '#059669'}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer bg-transparent p-0.5"
                    />
                  </div>
                  <Input
                    value={accentColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) setAccentColor(v);
                    }}
                    placeholder="#059669"
                    className="w-28 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Preset Colors */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('form.presetColors')}</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.name}
                      onClick={() => setBrandColor(c.hex)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${brandColor === c.hex ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Dark Mode Preference */}
              <div className="space-y-2">
                <Label>{t('form.darkModePreference')}</Label>
                <div className="flex gap-1">
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={darkModePreference === mode ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setDarkModePreference(mode)}
                    >
                      {t(`form.darkMode.${mode}`)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              {themePreview && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('form.themePreview')}</Label>
                  <div className="rounded-lg border p-3 space-y-2" style={{ background: `hsl(${themePreview.light['--background']})`, color: `hsl(${themePreview.light['--foreground']})` }}>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: `hsl(${themePreview.light['--primary']})`, color: `hsl(${themePreview.light['--primary-foreground']})` }}>
                        {t('form.previewButton')}
                      </div>
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium border" style={{ background: `hsl(${themePreview.light['--secondary']})`, color: `hsl(${themePreview.light['--secondary-foreground']})`, borderColor: `hsl(${themePreview.light['--border']})` }}>
                        {t('form.previewSecondary')}
                      </div>
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: `hsl(${themePreview.light['--accent']})`, color: `hsl(${themePreview.light['--accent-foreground']})` }}>
                        {t('form.previewAccent')}
                      </div>
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: `hsl(${themePreview.light['--destructive']})`, color: `hsl(${themePreview.light['--destructive-foreground']})` }}>
                        {t('form.previewDelete')}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: `hsl(${themePreview.light['--muted-foreground']})` }}>
                      {t('form.previewMutedText')}
                    </div>
                    <div className="rounded border p-2 text-xs" style={{ background: `hsl(${themePreview.light['--card']})`, borderColor: `hsl(${themePreview.light['--border']})` }}>
                      {t('form.previewCard')}
                    </div>
                  </div>
                  {/* Dark preview */}
                  <div className="rounded-lg border p-3 space-y-2" style={{ background: `hsl(${themePreview.dark['--background']})`, color: `hsl(${themePreview.dark['--foreground']})` }}>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: `hsl(${themePreview.dark['--primary']})`, color: `hsl(${themePreview.dark['--primary-foreground']})` }}>
                        {t('form.previewButton')}
                      </div>
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium border" style={{ background: `hsl(${themePreview.dark['--secondary']})`, color: `hsl(${themePreview.dark['--secondary-foreground']})`, borderColor: `hsl(${themePreview.dark['--border']})` }}>
                        {t('form.previewSecondary')}
                      </div>
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: `hsl(${themePreview.dark['--accent']})`, color: `hsl(${themePreview.dark['--accent-foreground']})` }}>
                        {t('form.previewAccent')}
                      </div>
                      <div className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: `hsl(${themePreview.dark['--destructive']})`, color: `hsl(${themePreview.dark['--destructive-foreground']})` }}>
                        {t('form.previewDelete')}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: `hsl(${themePreview.dark['--muted-foreground']})` }}>
                      {t('form.previewMutedText')}
                    </div>
                    <div className="rounded border p-2 text-xs" style={{ background: `hsl(${themePreview.dark['--card']})`, borderColor: `hsl(${themePreview.dark['--border']})` }}>
                      {t('form.previewCard')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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
