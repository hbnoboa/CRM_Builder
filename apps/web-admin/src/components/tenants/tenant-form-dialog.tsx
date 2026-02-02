'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

const createTenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string().min(2, 'Slug deve ter pelo menos 2 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifens'),
  domain: z.string().optional(),
  plan: z.string().optional(),
  adminEmail: z.string().email('Email invalido'),
  adminName: z.string().min(2, 'Nome do admin deve ter pelo menos 2 caracteres'),
  adminPassword: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

const updateTenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  domain: z.string().optional(),
  plan: z.string().optional(),
});

type CreateTenantFormData = z.infer<typeof createTenantSchema>;
type UpdateTenantFormData = z.infer<typeof updateTenantSchema>;

interface TenantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant | null;
  onSuccess?: () => void;
}

export function TenantFormDialog({ open, onOpenChange, tenant, onSuccess }: TenantFormDialogProps) {
  const isEditing = !!tenant;
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();

  const form = useForm<CreateTenantFormData | UpdateTenantFormData>({
    resolver: zodResolver(isEditing ? updateTenantSchema : createTenantSchema),
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
  }, [tenant, form]);

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
          <DialogTitle>{isEditing ? 'Editar Tenant' : 'Novo Tenant'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informacoes do tenant.'
              : 'Preencha os dados para criar um novo tenant.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa</Label>
            <Input
              id="name"
              placeholder="Minha Empresa"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                placeholder="minha-empresa"
                {...form.register('slug' as keyof CreateTenantFormData)}
              />
              {(form.formState.errors as Record<string, { message?: string }>).slug && (
                <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).slug?.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="domain">Dominio Personalizado (opcional)</Label>
            <Input
              id="domain"
              placeholder="app.minhaempresa.com"
              {...form.register('domain')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plano</Label>
            <Select
              value={form.watch('plan') || 'basic'}
              onValueChange={(value) => form.setValue('plan', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
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
                <h4 className="font-medium mb-3">Administrador do Tenant</h4>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">Nome do Administrador</Label>
                <Input
                  id="adminName"
                  placeholder="Joao Silva"
                  {...form.register('adminName' as keyof CreateTenantFormData)}
                />
                {(form.formState.errors as Record<string, { message?: string }>).adminName && (
                  <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).adminName?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email do Administrador</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@empresa.com"
                  {...form.register('adminEmail' as keyof CreateTenantFormData)}
                />
                {(form.formState.errors as Record<string, { message?: string }>).adminEmail && (
                  <p className="text-sm text-destructive">{(form.formState.errors as Record<string, { message?: string }>).adminEmail?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Senha do Administrador</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="Senha segura"
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
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
