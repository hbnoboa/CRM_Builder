'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Loader2, Monitor, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/stores/tenant-context';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import { DEFAULT_BRAND_COLOR } from '@/lib/generate-theme';

// Mesma cor que o tema usa quando a empresa nao escolheu nenhuma (antes: roxo aqui, laranja na tela)
const DEFAULT_COLOR = DEFAULT_BRAND_COLOR;
const HEX = /^#[0-9a-fA-F]{6}$/;
const THEMES = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
] as const;
type ThemeKey = (typeof THEMES)[number]['key'];

export default function GestaoOrganizationPage() {
  const t = useTranslations('gestao.organization');
  const { tenant, refresh } = useTenant();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [customColor, setCustomColor] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>('system');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carrega (e recarrega depois de salvar) o que esta gravado.
  useEffect(() => {
    if (!tenant) return;
    const saved = tenant.settings?.theme;
    setName(tenant.name);
    setLogo(tenant.logo ?? null);
    setColor(saved?.brandColor || DEFAULT_COLOR);
    setCustomColor(!!saved?.brandColor);
    setTheme((saved?.darkMode as ThemeKey) || 'system');
  }, [tenant]);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('folder', 'branding');
      const { data } = await api.post('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogo(data.publicUrl || data.url);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (customColor && !HEX.test(color)) return toast.error(t('invalidColor'));
    setSaving(true);
    try {
      await api.patch('/tenants/me', {
        name: name.trim(),
        logo,
        brandColor: customColor ? color.toLowerCase() : null,
        darkMode: theme,
      });
      await refresh();
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) return null;
  const previewColor = customColor && HEX.test(color) ? color : DEFAULT_COLOR;

  return (
    <form onSubmit={save} className="mx-auto max-w-4xl space-y-6" data-testid="organization-form">
      <GestaoPageHeader help="module.organization"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button type="submit" disabled={saving || uploading || name.trim().length < 2} data-testid="organization-save">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('identity.title')}</CardTitle>
          <CardDescription>{t('identity.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t('identity.name')}</Label>
            <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label>{t('identity.logo')}</Label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border bg-muted" data-testid="logo-preview">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-white" style={{ backgroundColor: previewColor, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(name || 'E')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  data-testid="logo-input"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                  {logo ? t('identity.changeLogo') : t('identity.uploadLogo')}
                </Button>
                {logo && (
                  <Button type="button" variant="ghost" onClick={() => setLogo(null)} data-testid="logo-remove">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('identity.removeLogo')}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('identity.logoHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('appearance.title')}</CardTitle>
          <CardDescription>{t('appearance.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-color">{t('appearance.color')}</Label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                aria-label={t('appearance.color')}
                value={previewColor}
                onChange={(e) => { setColor(e.target.value); setCustomColor(true); }}
                className="h-10 w-14 cursor-pointer rounded border bg-transparent p-1"
                data-testid="color-picker"
              />
              <Input
                id="org-color"
                value={customColor ? color : DEFAULT_COLOR}
                onChange={(e) => { setColor(e.target.value); setCustomColor(true); }}
                className="w-32 font-mono"
                data-testid="color-hex"
              />
              {customColor && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setColor(DEFAULT_COLOR); setCustomColor(false); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('appearance.resetColor')}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid="color-preview">
              <span className="text-sm text-muted-foreground">{t('appearance.preview')}</span>
              <span className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: previewColor }}>
                {t('appearance.sampleButton')}
              </span>
              <span className="text-sm font-medium underline" style={{ color: previewColor }}>{t('appearance.sampleLink')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('appearance.theme')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {THEMES.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  data-testid={`theme-${key}`}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors',
                    theme === key ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(`appearance.themes.${key}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('appearance.themeHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('address.title')}</CardTitle>
          <CardDescription>{t('address.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('address.slug')}</Label>
            <Input value={tenant.slug} readOnly />
          </div>
          <div className="space-y-2">
            <Label>{t('address.domain')}</Label>
            <Input value={tenant.domain || t('address.noDomain')} readOnly />
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
