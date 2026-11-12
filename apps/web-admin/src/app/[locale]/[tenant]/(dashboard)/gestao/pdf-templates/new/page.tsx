'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/tenant-navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, FileText, Files, Loader2, Sparkles } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { AiPdfBuilder } from '@/components/ai-builder/ai-pdf-builder';
import { useAiBuilderStatus } from '@/hooks/use-ai-builder';
import { buildStarterPdfBody } from '@/lib/pdf-starter';

const createTemplateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z
    .string()
    .min(2, 'O código interno precisa de pelo menos 2 letras')
    .regex(/^[a-z0-9-]+$/, 'Código interno: só letras minúsculas, números e hífens'),
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
    const { data: entitiesData, isLoading: isLoadingEntities } = useEntities({ limit: 200 });
  const createTemplate = useCreatePdfTemplate({ success: 'Modelo criado!' });
  const [useStarter, setUseStarter] = useState(true);
  const [aiMode, setAiMode] = useState(false);
  const { data: aiStatus } = useAiBuilderStatus();

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
    const source = entities.find((e) => e.id === data.sourceEntityId);
    const starter = source && data.templateType === 'single' && useStarter
      ? buildStarterPdfBody(source, entities)
      : null;
    try {
      const template = await createTemplate.mutateAsync({
        ...data,
        sourceEntityId: data.sourceEntityId || undefined,
        margins: { top: 70, right: 70, bottom: 70, left: 70 },
        content: {
          header: {
            showOnAllPages: true,
            ...(starter ? { title: { text: starter.title, bold: true, fontSize: 14 } } : {}),
          },
          body: starter?.body ?? [],
          footer: {
            showPageNumbers: true,
            position: 'center',
          },
        },
      });
      router.push(`/gestao/pdf-templates/${template.id}`);
    } catch {
      // Error handled by hook
    }
  };

  const sourceEntityId = form.watch('sourceEntityId');
  const templateType = form.watch('templateType');
  const sourceEntity = entities.find((e) => e.id === sourceEntityId);

  const pickEntity = (id: string) => {
    form.setValue('sourceEntityId', id);
    const picked = entities.find((e) => e.id === id);
    if (picked && !form.getValues('name')) handleNameChange(picked.name);
  };

  const TYPES = [
    { value: 'single' as const, icon: FileText, title: 'Um documento por registro', example: 'Ex.: a OS de um cliente, um laudo, um orçamento.' },
    { value: 'batch' as const, icon: Files, title: 'Um relatório com vários registros', example: 'Ex.: todas as visitas do mês num PDF só.' },
  ];

  if (aiMode) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="flex-shrink-0" aria-label="Voltar" onClick={() => setAiMode(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Criar PDF com IA</h1>
            <p className="mt-1 text-sm text-muted-foreground">Conte como quer o documento; a IA monta e você vê o PDF antes de criar.</p>
          </div>
        </div>
        <AiPdfBuilder />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabecalho */}
      <div className="flex items-start gap-3">
        <Link href="/gestao/pdf-templates">
          <Button variant="ghost" size="icon" className="flex-shrink-0" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Novo modelo de PDF</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Um documento pronto para imprimir ou mandar ao cliente: ordem de serviço, laudo, orçamento, relatório.
          </p>
        </div>
      </div>

      {aiStatus?.enabled && (
        <button
          type="button"
          onClick={() => setAiMode(true)}
          data-testid="pdf-ai"
          className="flex w-full items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-medium">Criar com IA</span>
            <span className="block text-xs text-muted-foreground">Conte como quer o documento (ex.: uma OS com os itens e a assinatura) e a IA monta para você revisar.</span>
          </span>
        </button>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 1. Tabela */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. De qual tabela vêm os dados?</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEntities ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="pdf-entity-picker">
                  {entities.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      onClick={() => pickEntity(entity.id)}
                      aria-pressed={sourceEntityId === entity.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors',
                        sourceEntityId === entity.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                      )}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" style={entity.color ? { backgroundColor: entity.color } : undefined} />
                      <span className="truncate font-medium">{entity.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Tipo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Que tipo de documento?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {TYPES.map(({ value, icon: Icon, title, example }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => form.setValue('templateType', value)}
                  aria-pressed={templateType === value}
                  data-testid={`pdf-type-${value}`}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors',
                    templateType === value ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-nav-active text-nav-active-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{example}</span>
                  </span>
                </button>
              ))}
              {templateType === 'single' && sourceEntity && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/50 p-3 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={useStarter}
                    onChange={(e) => setUseStarter(e.target.checked)}
                    data-testid="pdf-starter-toggle"
                  />
                  <span>
                    <span className="font-medium">Já começar com a ficha montada</span>
                    <span className="block text-xs text-muted-foreground">
                      Coloca os campos de {sourceEntity.name}, listas de itens, fotos e assinatura. Depois é só ajustar.
                    </span>
                  </span>
                </label>
              )}
            </CardContent>
          </Card>

          {/* 3. Nome */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Nome do modelo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Ex.: Ordem de serviço, Laudo de vistoria"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                        data-testid="pdf-name-input"
                      />
                    </FormControl>
                    <FormDescription>É o nome que aparece no botão &quot;Gerar PDF&quot; dos registros.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <details className="text-sm">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground">Mais opções (papel, orientação, descrição)</summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="pageSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do papel</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                              <SelectItem value="LETTER">Carta (216 × 279 mm)</SelectItem>
                              <SelectItem value="LEGAL">Ofício (216 × 356 mm)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="orientation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Orientação</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PORTRAIT">Em pé (retrato)</SelectItem>
                              <SelectItem value="LANDSCAPE">Deitado (paisagem)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Para que serve este documento (opcional)" rows={2} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código interno</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>Gerado a partir do nome. Só mude se souber o que está fazendo.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </details>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/gestao/pdf-templates">
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={createTemplate.isPending} data-testid="pdf-create-button">
              {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar e abrir o editor
            </Button>
          </div>
        </form>
      </Form>
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
