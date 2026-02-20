'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEntities } from '@/hooks/use-entities';
import type { PdfTemplate, UpdatePdfTemplateData } from '@/services/pdf-templates.service';

const generalSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z
    .string()
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifens'),
  description: z.string().optional(),
  templateType: z.enum(['single', 'batch']),
  sourceEntityId: z.string().optional(),
  pageSize: z.enum(['A4', 'LETTER', 'LEGAL']),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE']),
});

type GeneralFormData = z.infer<typeof generalSchema>;

interface GeneralTabProps {
  template: PdfTemplate;
  onUpdate: (data: UpdatePdfTemplateData) => void;
  isUpdating: boolean;
}

export function GeneralTab({ template, onUpdate, isUpdating }: GeneralTabProps) {
  const { data: entitiesData, isLoading: isLoadingEntities } = useEntities();
  const entities = entitiesData?.data || [];

  const form = useForm<GeneralFormData>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: template.name,
      slug: template.slug,
      description: template.description || '',
      templateType: template.templateType as 'single' | 'batch',
      sourceEntityId: template.sourceEntityId || '',
      pageSize: template.pageSize,
      orientation: template.orientation,
    },
  });

  const onSubmit = (data: GeneralFormData) => {
    onUpdate({
      ...data,
      sourceEntityId: data.sourceEntityId || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuracoes Gerais</CardTitle>
        <CardDescription>Informacoes basicas e configuracoes de pagina do template</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Template</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Identificador unico para URLs</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descricao (opcional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="templateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Template</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Individual (1 registro por PDF)</SelectItem>
                        <SelectItem value="batch">Lote (multiplos registros)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sourceEntityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entidade Fonte</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma entidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingEntities ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : (
                          entities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>
                              {entity.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>Entidade da qual os dados serao extraidos</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pageSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tamanho da Pagina</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                        <SelectItem value="LETTER">Carta (215.9 x 279.4 mm)</SelectItem>
                        <SelectItem value="LEGAL">Oficio (215.9 x 355.6 mm)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orientation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orientacao</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PORTRAIT">Retrato (vertical)</SelectItem>
                        <SelectItem value="LANDSCAPE">Paisagem (horizontal)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configuracoes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
