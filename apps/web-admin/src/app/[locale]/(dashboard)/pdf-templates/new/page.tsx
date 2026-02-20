'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequireRole } from '@/components/auth/require-role';
import { useEntities } from '@/hooks/use-entities';
import { useCreatePdfTemplate } from '@/hooks/use-pdf-templates';

const createTemplateSchema = z.object({
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

type CreateTemplateFormData = z.infer<typeof createTemplateSchema>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function NewPdfTemplatePageContent() {
  const router = useRouter();
  const tNav = useTranslations('navigation');
  const { data: entitiesData, isLoading: isLoadingEntities } = useEntities();
  const createTemplate = useCreatePdfTemplate({ success: 'Template criado com sucesso!' });

  const entities = entitiesData?.data || [];

  const form = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      templateType: 'single',
      sourceEntityId: '',
      pageSize: 'A4',
      orientation: 'PORTRAIT',
    },
  });

  const watchName = form.watch('name');

  const handleNameChange = (value: string) => {
    form.setValue('name', value);
    const currentSlug = form.getValues('slug');
    const expectedSlug = generateSlug(form.getValues('name').slice(0, -1) || '');
    // Auto-generate slug only if user hasn't manually edited it
    if (!currentSlug || currentSlug === expectedSlug || currentSlug === generateSlug(watchName)) {
      form.setValue('slug', generateSlug(value));
    }
  };

  const onSubmit = async (data: CreateTemplateFormData) => {
    try {
      const template = await createTemplate.mutateAsync({
        ...data,
        sourceEntityId: data.sourceEntityId || undefined,
        margins: { top: 70, right: 70, bottom: 70, left: 70 },
        content: {
          header: {
            showOnAllPages: true,
          },
          body: [],
          footer: {
            showPageNumbers: true,
            position: 'center',
          },
        },
      });
      router.push(`/pdf-templates/${template.id}`);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav
        className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"
        aria-label="breadcrumb"
      >
        <Link href="/dashboard" className="hover:underline">
          {tNav('dashboard')}
        </Link>
        <span>/</span>
        <Link href="/pdf-templates" className="hover:underline">
          Templates de PDF
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Novo Template</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pdf-templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Novo Template de PDF</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Configure as informacoes basicas do seu template
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informacoes Basicas</CardTitle>
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
                        <Input
                          placeholder="Ex: Relatorio de Veiculo"
                          {...field}
                          onChange={(e) => handleNameChange(e.target.value)}
                        />
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
                        <Input placeholder="relatorio-veiculo" {...field} />
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
                      <Textarea
                        placeholder="Descreva o proposito deste template..."
                        rows={3}
                        {...field}
                      />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Individual (1 registro por PDF)</SelectItem>
                          <SelectItem value="batch">Lote (multiplos registros)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Individual: gera 1 PDF por registro. Lote: combina multiplos registros em 1
                        PDF.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceEntityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entidade Fonte (opcional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <FormDescription>
                        Entidade da qual os dados serao extraidos para o PDF
                      </FormDescription>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tamanho" />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a orientacao" />
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

              <div className="flex justify-end gap-3">
                <Link href="/pdf-templates">
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </Link>
                <Button type="submit" disabled={createTemplate.isPending}>
                  {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar e Continuar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewPdfTemplatePage() {
  return (
    <RequireRole module="pdfTemplates" action="canCreate">
      <NewPdfTemplatePageContent />
    </RequireRole>
  );
}
