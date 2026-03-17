'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useEntities } from '@/hooks/use-entities';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { useCreatePublicLink, useUpdatePublicLink } from '@/hooks/use-public-links';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { PublicLink } from '@/services/public-link.service';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatorio'),
  entitySlug: z.string().min(1, 'Entidade obrigatoria'),
  description: z.string().optional().or(z.literal('')),
  autoCreateRole: z.boolean(),
  customRoleId: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  maxUsers: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface PublicLinkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link?: PublicLink | null;
  onSuccess?: () => void;
}

export function PublicLinkFormDialog({ open, onOpenChange, link, onSuccess }: PublicLinkFormDialogProps) {
  const t = useTranslations('common');
  const isEditing = !!link;
  const createLink = useCreatePublicLink();
  const updateLink = useUpdatePublicLink();
  const { data: entitiesData } = useEntities();
  const entities = Array.isArray(entitiesData?.data) ? entitiesData.data : [];
  const { data: rolesData } = useCustomRoles();
  const roles = Array.isArray(rolesData?.data) ? rolesData.data : [];

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      entitySlug: '',
      description: '',
      autoCreateRole: true,
      customRoleId: '',
      expiresAt: '',
      maxUsers: '',
    },
  });

  const autoCreateRole = form.watch('autoCreateRole');

  useEffect(() => {
    if (!open) return;
    if (link) {
      form.reset({
        name: link.name,
        entitySlug: link.entitySlug,
        description: link.description || '',
        autoCreateRole: false,
        customRoleId: link.customRoleId,
        expiresAt: link.expiresAt ? link.expiresAt.slice(0, 10) : '',
        maxUsers: link.maxUsers ? String(link.maxUsers) : '',
      });
    } else {
      form.reset({
        name: '',
        entitySlug: '',
        description: '',
        autoCreateRole: true,
        customRoleId: '',
        expiresAt: '',
        maxUsers: '',
      });
    }
  }, [link, open, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload: any = {
        name: data.name,
        entitySlug: data.entitySlug,
        description: data.description || undefined,
        expiresAt: data.expiresAt || undefined,
        maxUsers: data.maxUsers ? parseInt(data.maxUsers) : undefined,
      };

      if (!data.autoCreateRole && data.customRoleId) {
        payload.customRoleId = data.customRoleId;
      }

      if (isEditing && link) {
        await updateLink.mutateAsync({ id: link.id, data: payload });
      } else {
        await createLink.mutateAsync(payload);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Handled by hook
    }
  };

  const isLoading = createLink.isPending || updateLink.isPending;
  const linkUrl = link ? `${window.location.origin}/p/${link.slug}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Link Publico' : 'Novo Link Publico'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as configuracoes do link.'
              : 'Configure o link publico para acesso externo a uma entidade.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {linkUrl && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="text-xs flex-1 truncate">{linkUrl}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(linkUrl);
                  toast.success('Link copiado!');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Inspecao de Caminhoes"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entitySlug">Entidade *</Label>
            <Select
              value={form.watch('entitySlug')}
              onValueChange={(v) => form.setValue('entitySlug', v)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a entidade" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e: any) => (
                  <SelectItem key={e.slug} value={e.slug}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.entitySlug && (
              <p className="text-sm text-destructive">{form.formState.errors.entitySlug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descricao exibida para usuarios externos"
              rows={2}
              {...form.register('description')}
            />
          </div>

          {!isEditing && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="autoCreateRole"
                checked={autoCreateRole}
                onCheckedChange={(checked) => form.setValue('autoCreateRole', !!checked)}
              />
              <Label htmlFor="autoCreateRole" className="cursor-pointer">
                Criar role automaticamente
              </Label>
            </div>
          )}

          {(!autoCreateRole || isEditing) && (
            <div className="space-y-2">
              <Label htmlFor="customRoleId">Role</Label>
              <Select
                value={form.watch('customRoleId') || ''}
                onValueChange={(v) => form.setValue('customRoleId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiracao (opcional)</Label>
              <Input
                id="expiresAt"
                type="date"
                {...form.register('expiresAt')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max usuarios (opcional)</Label>
              <Input
                id="maxUsers"
                type="number"
                min="1"
                placeholder="Ilimitado"
                {...form.register('maxUsers')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('saving') : isEditing ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
