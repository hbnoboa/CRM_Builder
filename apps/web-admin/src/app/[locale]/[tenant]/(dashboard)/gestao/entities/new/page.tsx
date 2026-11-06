'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/tenant-navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Database, Plus, Loader2, Sparkles, icons, type LucideIcon } from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { DesktopOnlyEditor } from '@/components/layout/desktop-only-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fieldKind } from '@/lib/field-catalog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/get-error-message';
import api from '@/lib/api';
import { entityTemplates, templateCategories } from '@/lib/entity-templates';
import type { EntityTemplate } from '@/lib/entity-templates';
import { AiTableBuilder } from '@/components/ai-builder/ai-table-builder';
import { useAiBuilderStatus } from '@/hooks/use-ai-builder';

function NewEntityPageContent() {
  const router = useRouter();
  const t = useTranslations('entities');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EntityTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const { data: aiStatus } = useAiBuilderStatus();

  const selectTemplate = (template: EntityTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description);
    setCategory(template.category);
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setName('');
    setDescription('');
    setCategory('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('validation.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        description,
        fields: selectedTemplate?.fields || [],
      };
      if (category.trim()) payload.category = category.trim();

      const entityResult = await api.post('/entities', payload);
      const entityId = entityResult.data?.id;

      // Criar automacoes do template se houver
      if (selectedTemplate?.automations?.length && entityId) {
        for (const automation of selectedTemplate.automations) {
          try {
            await api.post(`/entities/${entityId}/automations`, automation);
          } catch (err) {
            console.warn('Failed to create template automation:', err);
          }
        }
      }

      toast.success(t('toast.created'));
      router.push(`/gestao/entities/${entityId}`);
    } catch (error) {
      console.error('Error creating entity:', error);
      toast.error(getErrorMessage(error, t('toast.createError')));
    } finally {
      setSaving(false);
    }
  };

  const templateFields = (selectedTemplate?.fields || []).filter((f) => f.type !== 'section-title');

  if (aiMode) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Criar com IA</h1>
          <p className="text-sm text-muted-foreground">Conte o que você quer controlar; a IA propõe as tabelas e você ajusta antes de criar.</p>
        </div>
        <AiTableBuilder onBack={() => setAiMode(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      {/* Cabecalho */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova tabela</h1>
          <p className="text-sm text-muted-foreground">
            Uma tabela guarda um tipo de informação: clientes, ordens de serviço, veículos, visitas...
          </p>
        </div>
      </div>

      {/* 1. Como comecar */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">1</span>
          Como quer começar?
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {aiStatus?.enabled && (
            <button
              type="button"
              onClick={() => setAiMode(true)}
              data-testid="template-ai"
              className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium">Criar com IA</span>
                <span className="block text-xs text-muted-foreground">Conte como é o seu negócio e a IA monta as tabelas para você revisar.</span>
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={clearTemplate}
            data-testid="template-blank"
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
              !selectedTemplate ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground">
              <Plus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Em branco</span>
              <span className="block text-xs text-muted-foreground">Você escolhe cada campo do zero.</span>
            </span>
          </button>
        </div>
        {templateCategories.map((tc) => {
          const templates = entityTemplates.filter((tpl) => tpl.templateCategory === tc.id);
          if (templates.length === 0) return null;
          return (
            <div key={tc.id} className="pt-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Modelo · {tc.label}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id;
                  const Icon = (icons as Record<string, LucideIcon>)[template.icon] ?? Database;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => (isSelected ? clearTemplate() : selectTemplate(template))}
                      data-testid={`template-${template.id}`}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
                        isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                      )}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `color-mix(in srgb, ${template.color} 14%, transparent)`, color: template.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{template.name}</span>
                        <span className="line-clamp-2 block text-xs text-muted-foreground">{template.description}</span>
                        <span className="mt-1.5 block text-[11px] text-muted-foreground">{template.fields.length} campos prontos</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* 2. Nome */}
      <Card className="sticky bottom-4 z-10 shadow-lg">
        <CardContent className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">2</span>
            Dê um nome
          </h2>
          {selectedTemplate && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="template-preview">
              <span className="text-muted-foreground">Vem com:</span>
              {templateFields.slice(0, 10).map((f) => {
                const Icon = fieldKind(f.type).icon;
                return (
                  <span key={f.slug} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    <Icon className="h-3 w-3 text-muted-foreground" /> {f.label || f.name}
                  </span>
                );
              })}
              {templateFields.length > 10 && <span className="text-muted-foreground">+{templateFields.length - 10}</span>}
              <span className="text-muted-foreground">· dá para mudar tudo depois.</span>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name">Nome da tabela, no singular</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="Ex.: Cliente, Veículo, Ordem de serviço"
                autoFocus
                data-testid="entity-name-input"
              />
            </div>
            <Button size="lg" onClick={handleCreate} disabled={saving || !name.trim()} data-testid="entity-create-button">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Criar e montar os campos
            </Button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-xs text-muted-foreground">Mais opções (descrição e grupo no menu)</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para que serve esta tabela (opcional)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Grupo no menu</Label>
                <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Vendas, Serviços (opcional)" />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewEntityPage() {
  return (
    <RequireRole module="entities" action="canCreate">
      <DesktopOnlyEditor action="criar tabelas">
        <NewEntityPageContent />
      </DesktopOnlyEditor>
    </RequireRole>
  );
}
