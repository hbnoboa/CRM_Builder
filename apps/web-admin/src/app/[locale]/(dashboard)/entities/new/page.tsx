'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Save, Loader2 } from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { entityTemplates, templateCategories } from '@/lib/entity-templates';
import type { EntityTemplate } from '@/lib/entity-templates';

function NewEntityPageContent() {
  const router = useRouter();
  const t = useTranslations('entities');
  const { effectiveTenantId } = useTenant();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EntityTemplate | null>(null);
  const [saving, setSaving] = useState(false);

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
      if (effectiveTenantId) payload.tenantId = effectiveTenantId;

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
      // Redirecionar para o editor GrapeJS
      router.push(`/entities/${entityId}`);
    } catch (error) {
      console.error('Error creating entity:', error);
      toast.error(t('toast.createError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('newEntity')}</h1>
            <p className="text-sm text-muted-foreground">
              {selectedTemplate
                ? `Template: ${selectedTemplate.name}`
                : 'Escolha um template ou crie do zero'}
            </p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('createEntity')}
        </Button>
      </div>

      {/* Nome e descricao */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria (Sidebar)</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: CRM, Suporte, Projetos..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Escolha um template</CardTitle>
              <CardDescription>Comece com uma estrutura pronta ou crie do zero</CardDescription>
            </div>
            {selectedTemplate ? (
              <Button variant="outline" size="sm" onClick={clearTemplate}>
                Limpar template
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Criar do zero — basta preencher o nome e clicar em Criar
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {templateCategories.map(tc => {
            const templates = entityTemplates.filter(t => t.templateCategory === tc.id);
            if (templates.length === 0) return null;
            return (
              <div key={tc.id} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tc.color }} />
                  {tc.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {templates.map(template => {
                    const isSelected = selectedTemplate?.id === template.id;
                    return (
                      <button
                        key={template.id}
                        onClick={() => isSelected ? clearTemplate() : selectTemplate(template)}
                        className={`text-left p-4 rounded-lg border-2 transition-all group ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:border-primary/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-lg"
                            style={{ backgroundColor: template.color }}
                          >
                            {template.icon.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm group-hover:text-primary transition-colors">{template.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-[10px]">{template.fields.length} campos</Badge>
                              {template.automations && template.automations.length > 0 && (
                                <Badge variant="outline" className="text-[10px]">{template.automations.length} automacao(es)</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewEntityPage() {
  return (
    <RequireRole module="entities">
      <NewEntityPageContent />
    </RequireRole>
  );
}
