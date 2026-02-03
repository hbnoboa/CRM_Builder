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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCustomApi, useUpdateCustomApi } from '@/hooks/use-custom-apis';
import type { CustomApi } from '@/services/custom-apis.service';

const customApiSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  path: z.string().min(1, 'Path e obrigatorio').regex(/^\/[a-z0-9-/]*$/, 'Path deve comecar com / e conter apenas letras minusculas, numeros e hifens'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  description: z.string().optional(),
  code: z.string().optional(),
});

type CustomApiFormData = z.infer<typeof customApiSchema>;

interface CustomApiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApi?: CustomApi | null;
  onSuccess?: () => void;
}

export function CustomApiFormDialog({ open, onOpenChange, customApi, onSuccess }: CustomApiFormDialogProps) {
  const isEditing = !!customApi;
  const createCustomApi = useCreateCustomApi();
  const updateCustomApi = useUpdateCustomApi();

  const form = useForm<CustomApiFormData>({
    resolver: zodResolver(customApiSchema),
    defaultValues: {
      name: '',
      path: '/',
      method: 'GET',
      description: '',
      code: '',
    },
  });

  useEffect(() => {
    if (customApi) {
      form.reset({
        name: customApi.name,
        path: customApi.path,
        method: customApi.method,
        description: customApi.description || '',
        code: customApi.code || '',
      });
    } else {
      form.reset({
        name: '',
        path: '/',
        method: 'GET',
        description: '',
        code: '',
      });
    }
  }, [customApi, form]);

  const onSubmit = async (data: CustomApiFormData) => {
    try {
      if (isEditing && customApi) {
        await updateCustomApi.mutateAsync({
          id: customApi.id,
          data: {
            name: data.name,
            path: data.path,
            method: data.method,
            description: data.description,
            code: data.code,
          },
        });
      } else {
        await createCustomApi.mutateAsync({
          name: data.name,
          path: data.path,
          method: data.method,
          description: data.description,
          code: data.code,
        });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isLoading = createCustomApi.isPending || updateCustomApi.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar API' : 'Nova API'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informacoes da API personalizada.'
              : 'Preencha os dados para criar uma nova API personalizada.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da API</Label>
              <Input
                id="name"
                placeholder="Listar Clientes VIP"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Metodo HTTP</Label>
              <Select
                value={form.watch('method')}
                onValueChange={(value) => form.setValue('method', value as CustomApiFormData['method'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o metodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path">Path</Label>
            <Input
              id="path"
              placeholder="/clientes-vip"
              {...form.register('path')}
            />
            {form.formState.errors.path && (
              <p className="text-sm text-destructive">{form.formState.errors.path.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              O path completo sera: /api/x/[org]{form.watch('path')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva o que esta API faz..."
              rows={2}
              {...form.register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Codigo (opcional)</Label>
            <Textarea
              id="code"
              placeholder="// Seu codigo JavaScript aqui..."
              rows={6}
              className="font-mono text-sm"
              {...form.register('code')}
            />
            <p className="text-xs text-muted-foreground">
              Escreva o codigo que sera executado quando esta API for chamada.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar API'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
