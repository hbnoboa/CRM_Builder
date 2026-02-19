'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { RequireRole } from '@/components/auth/require-role';
import { useCreatePdfTemplate } from '@/hooks/use-pdf-templates';
import { useEntities } from '@/hooks/use-entities';
import { Link } from '@/i18n/navigation';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string()
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifens'),
  description: z.string().optional(),
  category: z.string().optional(),
  entitySlug: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const CATEGORIES = [
  { value: 'relatorio', label: 'Relatorio' },
  { value: 'ficha', label: 'Ficha' },
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'formulario', label: 'Formulario' },
  { value: 'contrato', label: 'Contrato' },
];

function NewPdfTemplatePageContent() {
  const t = useTranslations('pdfTemplates');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: entitiesData } = useEntities();
  const entities = entitiesData?.data ?? (Array.isArray(entitiesData) ? entitiesData : []);

  const createTemplate = useCreatePdfTemplate({
    success: t('toast.created'),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      category: '',
      entitySlug: '',
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);

    // Auto-generate slug if slug field is empty or matches previous auto-generated value
    const currentSlug = form.getValues('slug');
    const previousName = form.getValues('name');
    if (!currentSlug || currentSlug === generateSlug(previousName)) {
      form.setValue('slug', generateSlug(name));
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const result = await createTemplate.mutateAsync({
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        category: data.category || undefined,
        entitySlug: data.entitySlug || undefined,
        basePdf: {
          width: 210,
          height: 297,
          padding: [30, 30, 30, 30],
        },
        schemas: [],
        settings: {
          pageSize: 'A4',
          orientation: 'portrait',
          margins: { top: 30, right: 30, bottom: 30, left: 30 },
        },
      });

      // Redirecionar para a pagina de edicao do template
      router.push(`/pdf-templates/${result.id}`);
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pdf-templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('newTemplate')}</h1>
          <p className="text-muted-foreground">{t('newTemplateSubtitle')}</p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('basicInfo')}</CardTitle>
              <CardDescription>{t('basicInfoDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={handleNameChange}
                        placeholder={t('form.namePlaceholder')}
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
                    <FormLabel>{t('form.slug')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('form.slugPlaceholder')} />
                    </FormControl>
                    <FormDescription>{t('form.slugDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('form.descriptionPlaceholder')}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.category')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('form.categoryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entitySlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('form.linkedEntity')}</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('form.linkedEntityPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('form.noEntity')}</SelectItem>
                          {entities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.slug}>
                              {entity.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{t('form.linkedEntityDesc')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link href="/pdf-templates">{tCommon('cancel')}</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('createAndEdit')}
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
    <RequireRole module="pdf" action="canCreate">
      <NewPdfTemplatePageContent />
    </RequireRole>
  );
}
