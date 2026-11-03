'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LifecycleBadge, PageHeader, UsageLine, useFormatDate } from '@/components/platform/platform-ui';
import { useDebounce } from '@/hooks/use-debounce';
import {
  CreatePlatformTenantBody,
  useCreatePlatformTenant,
  usePlatformCan,
  usePlatformPlans,
  usePlatformTenants,
} from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { TENANT_LIFECYCLES, type TenantLifecycle } from '@/types/platform';

const ALL = 'all';

export default function PlatformTenantsPage() {
  return (
    <Suspense>
      <PlatformTenantsContent />
    </Suspense>
  );
}

function PlatformTenantsContent() {
  const t = useTranslations('platform.tenants');
  const tLife = useTranslations('platform.lifecycle');
  const searchParams = useSearchParams();
  const formatDate = useFormatDate();
  const can = usePlatformCan();
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<string>(searchParams.get('lifecycle') || ALL);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => setPage(1), [debouncedSearch, lifecycle]);

  const { data, isLoading } = usePlatformTenants({
    search: debouncedSearch || undefined,
    lifecycle: lifecycle === ALL ? undefined : (lifecycle as TenantLifecycle),
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can('tenants.create') && (
            <Button onClick={() => setCreateOpen(true)} data-testid="platform-new-tenant">
              <Plus className="mr-2 h-4 w-4" />
              {t('new')}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={lifecycle} onValueChange={setLifecycle}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allLifecycles')}</SelectItem>
            {TENANT_LIFECYCLES.map((l) => (
              <SelectItem key={l} value={l}>{tLife(l)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.plan')}</TableHead>
                <TableHead className="min-w-32">{t('columns.users')}</TableHead>
                <TableHead className="min-w-32">{t('columns.records')}</TableHead>
                <TableHead>{t('columns.lastAccess')}</TableHead>
                <TableHead>{t('columns.createdAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{t('empty')}</TableCell>
                </TableRow>
              )}
              {data?.data.map((tenant) => (
                <TableRow key={tenant.id} data-testid={`platform-tenant-${tenant.slug}`}>
                  <TableCell>
                    <Link href={`/admin/tenants/${tenant.id}`} className="font-medium hover:underline">{tenant.name}</Link>
                    <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                  </TableCell>
                  <TableCell>
                    <LifecycleBadge lifecycle={tenant.lifecycle} />
                    {tenant.lifecycle === 'TRIAL' && (
                      <div className="mt-1 text-xs text-muted-foreground">{t('trialUntil', { date: formatDate(tenant.trialEndsAt) })}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{tenant.plan?.name ?? <span className="text-muted-foreground">{t('noPlan')}</span>}</TableCell>
                  <TableCell><UsageLine used={tenant.usage.users} limit={tenant.limits.maxUsers} /></TableCell>
                  <TableCell><UsageLine used={tenant.usage.records} limit={tenant.limits.maxRecords} /></TableCell>
                  <TableCell className="text-sm">{formatDate(tenant.usage.lastLoginAt, true)}</TableCell>
                  <TableCell className="text-sm">{formatDate(tenant.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{t('page', { page: data.meta.page, total: data.meta.totalPages })}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('previous')}</Button>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>{t('next')}</Button>
        </div>
      )}

      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function CreateTenantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('platform.tenants.create');
  const tLife = useTranslations('platform.lifecycle');
  const router = useRouter();
  const { data: plans } = usePlatformPlans();
  const create = useCreatePlatformTenant();
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<CreatePlatformTenantBody>({
    name: '',
    slug: '',
    lifecycle: 'TRIAL',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const set = <K extends keyof CreatePlatformTenantBody>(key: K, value: CreatePlatformTenantBody[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const body: CreatePlatformTenantBody = { ...form, planId: form.planId || undefined };
      if (body.lifecycle === 'TRIAL' && !body.trialEndsAt) {
        body.trialEndsAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
      }
      const tenant = await create.mutateAsync(body);
      toast.success(t('created'));
      onOpenChange(false);
      router.push(`/admin/tenants/${tenant.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tenant-name">{t('name')}</Label>
              <Input
                id="tenant-name"
                required
                value={form.name}
                onChange={(e) => {
                  set('name', e.target.value);
                  if (!slugTouched) set('slug', slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="tenant-slug">{t('slug')}</Label>
              <Input
                id="tenant-slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">{t('slugHint')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('plan')}</Label>
              <Select value={form.planId ?? ALL} onValueChange={(v) => set('planId', v === ALL ? undefined : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('noPlan')}</SelectItem>
                  {plans?.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('lifecycle')}</Label>
              <Select value={form.lifecycle} onValueChange={(v) => set('lifecycle', v as TenantLifecycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['TRIAL', 'ACTIVE'] as TenantLifecycle[]).map((l) => (
                    <SelectItem key={l} value={l}>{tLife(l)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="text-sm font-medium">{t('admin')}</div>
            <div className="space-y-2">
              <Label htmlFor="admin-name">{t('adminName')}</Label>
              <Input id="admin-name" required value={form.adminName} onChange={(e) => set('adminName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">{t('adminEmail')}</Label>
              <Input id="admin-email" type="email" required value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">{t('adminPassword')}</Label>
              <Input id="admin-password" type="password" required minLength={8} value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('passwordRule')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
