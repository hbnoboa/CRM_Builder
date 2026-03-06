'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdatePdfTemplate, usePublishPdfTemplate } from '@/hooks/use-pdf-templates';
import type {
  PdfTemplate,
  PdfTemplateContent,
  PdfTemplateSettings,
  PdfElement,
} from '@/services/pdf-templates.service';
import { PdfPreview } from '@/components/pdf/preview/pdf-preview';

import { PdfCanvas, type SelectedZone } from './pdf-canvas';
import { ElementPickerModal, createDefaultElement } from './element-picker-modal';
import { ElementPropertiesPanel } from './element-properties-panel';
import { TemplateInfoPanel } from './template-info-panel';
import { ComputedFieldsDialog } from './computed-fields-dialog';

// ─── System fields available in all templates ────────────

const SYSTEM_FIELDS = [
  { slug: 'createdAt', name: 'Data de Criacao', label: 'Data de Criacao', type: 'datetime' },
  { slug: 'updatedAt', name: 'Data de Atualizacao', label: 'Data de Atualizacao', type: 'datetime' },
  { slug: '_geolocation.lat', name: 'Latitude', label: 'Latitude', type: 'number' },
  { slug: '_geolocation.lng', name: 'Longitude', label: 'Longitude', type: 'number' },
  { slug: '_geolocation.city', name: 'Cidade (GPS)', label: 'Cidade (GPS)', type: 'text' },
  { slug: '_geolocation.uf', name: 'Estado (GPS)', label: 'Estado (GPS)', type: 'text' },
  { slug: '_geolocation.address', name: 'Endereco (GPS)', label: 'Endereco (GPS)', type: 'text' },
];

// ─── Props ───────────────────────────────────────────────

interface PdfVisualEditorProps {
  template: PdfTemplate;
}

// ─── Component ───────────────────────────────────────────

export function PdfVisualEditor({ template }: PdfVisualEditorProps) {
  const router = useRouter();

  const updateTemplate = useUpdatePdfTemplate({ success: 'Template salvo com sucesso!' });
  const publishTemplate = usePublishPdfTemplate();

  // ─── State ───────────────────────────────────────────

  const [localContent, setLocalContent] = useState<PdfTemplateContent>(
    (template.content as PdfTemplateContent) || { body: [] },
  );
  const [localName, setLocalName] = useState(template.name);
  const [localDescription, setLocalDescription] = useState(template.description || '');
  const [localPageSize, setLocalPageSize] = useState(template.pageSize);
  const [localOrientation, setLocalOrientation] = useState(template.orientation);
  const [localMargins, setLocalMargins] = useState(template.margins);
  const [hasChanges, setHasChanges] = useState(false);

  const [selected, setSelected] = useState<SelectedZone>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [elementPickerOpen, setElementPickerOpen] = useState(false);
  const [computedFieldsOpen, setComputedFieldsOpen] = useState(false);

  // Sync from server when template changes
  useEffect(() => {
    setLocalContent((template.content as PdfTemplateContent) || { body: [] });
    setLocalName(template.name);
    setLocalDescription(template.description || '');
    setLocalPageSize(template.pageSize);
    setLocalOrientation(template.orientation);
    setLocalMargins(template.margins);
  }, [template]);

  // ─── Available fields ────────────────────────────────

  const availableFields = [
    ...(template.sourceEntity?.fields || []),
    ...SYSTEM_FIELDS,
  ];

  // ─── Handlers ────────────────────────────────────────

  const handleContentChange = useCallback((newContent: PdfTemplateContent) => {
    setLocalContent(newContent);
    setHasChanges(true);
  }, []);

  const handleTemplateFieldChange = useCallback((field: string, value: unknown) => {
    setHasChanges(true);
    switch (field) {
      case 'name':
        setLocalName(value as string);
        break;
      case 'description':
        setLocalDescription(value as string);
        break;
      case 'pageSize':
        setLocalPageSize(value as PdfTemplate['pageSize']);
        break;
      case 'orientation':
        setLocalOrientation(value as PdfTemplate['orientation']);
        break;
      case 'margins':
        setLocalMargins(value as PdfTemplate['margins']);
        break;
    }
  }, []);

  const handleAddElement = useCallback(
    (element: PdfElement) => {
      handleContentChange({
        ...localContent,
        body: [...(localContent.body || []), element],
      });
      setSelected({ type: 'element', id: element.id });
    },
    [localContent, handleContentChange],
  );

  const handleDeleteElement = useCallback(
    (id: string) => {
      handleContentChange({
        ...localContent,
        body: (localContent.body || []).filter((el) => el.id !== id),
      });
      if (selected?.type === 'element' && selected.id === id) {
        setSelected(null);
      }
    },
    [localContent, handleContentChange, selected],
  );

  const handleSave = async () => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        data: {
          content: localContent,
          name: localName,
          description: localDescription,
          pageSize: localPageSize,
          orientation: localOrientation,
          margins: localMargins,
        },
      });
      setHasChanges(false);
    } catch {
      // Error handled by hook
    }
  };

  const handlePublish = async () => {
    try {
      if (hasChanges) {
        await updateTemplate.mutateAsync({
          id: template.id,
          data: {
            content: localContent,
            name: localName,
            description: localDescription,
            pageSize: localPageSize,
            orientation: localOrientation,
            margins: localMargins,
          },
        });
        setHasChanges(false);
      }
      await publishTemplate.mutateAsync(template.id);
    } catch {
      // Error handled by hook
    }
  };

  // ─── Keyboard shortcut ──────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, localContent, localName, localDescription, localPageSize, localOrientation, localMargins]);

  // ─── Template object for preview and info panel ─────

  const localTemplate: PdfTemplate = {
    ...template,
    name: localName,
    description: localDescription,
    pageSize: localPageSize,
    orientation: localOrientation,
    margins: localMargins,
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen">
      {/* ═══ Toolbar ═══ */}
      <div className="h-14 border-b bg-card flex items-center px-4 gap-2 flex-shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push('/pdf-templates')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Template name */}
        <input
          type="text"
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            setHasChanges(true);
          }}
          className="text-sm font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 min-w-[120px] max-w-[300px]"
        />

        {/* Badges */}
        <div className="flex items-center gap-1.5 mr-auto">
          {template.isPublished ? (
            <Badge variant="default" className="gap-1 text-xs h-5">
              <CheckCircle className="h-3 w-3" />
              Publicado
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs h-5">Rascunho</Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="text-xs h-5 text-orange-600 border-orange-600">
              Alteracoes nao salvas
            </Badge>
          )}
        </div>

        {/* Toolbar actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setComputedFieldsOpen(true)}
        >
          <Calculator className="h-4 w-4 mr-1.5" />
          Campos
          {(localContent.computedFields?.length || 0) > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
              {localContent.computedFields?.length}
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? (
            <EyeOff className="h-4 w-4 mr-1.5" />
          ) : (
            <Eye className="h-4 w-4 mr-1.5" />
          )}
          Preview
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setElementPickerOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || updateTemplate.isPending}
        >
          {updateTemplate.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Salvar
        </Button>

        {!template.isPublished && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishTemplate.isPending}
          >
            {publishTemplate.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1.5" />
            )}
            Publicar
          </Button>
        )}
      </div>

      {/* ═══ Main Area ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Canvas ─── */}
        <div className="flex-1 overflow-y-auto bg-muted/30">
          <PdfCanvas
            content={localContent}
            selected={selected}
            onSelect={setSelected}
            onChange={handleContentChange}
            pageSize={localPageSize}
            orientation={localOrientation}
          />
        </div>

        {/* ─── Properties Panel ─── */}
        <div className="w-80 border-l bg-card flex-shrink-0 overflow-y-auto">
          {selected ? (
            <ElementPropertiesPanel
              selected={selected}
              content={localContent}
              onChange={handleContentChange}
              onDelete={handleDeleteElement}
              onDeselect={() => setSelected(null)}
              availableFields={availableFields}
              subEntities={template.subEntities}
              computedFields={localContent.computedFields}
              templateType={template.templateType}
            />
          ) : (
            <TemplateInfoPanel
              template={localTemplate}
              content={localContent}
              onTemplateFieldChange={handleTemplateFieldChange}
              onContentChange={handleContentChange}
            />
          )}
        </div>

        {/* ─── Preview Panel (optional) ─── */}
        {showPreview && (
          <div className="w-96 border-l bg-card flex-shrink-0 overflow-y-auto">
            <Card className="border-0 shadow-none rounded-none h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Preview PDF</CardTitle>
                <CardDescription>Gerado pelo backend</CardDescription>
              </CardHeader>
              <CardContent>
                <PdfPreview
                  template={localTemplate}
                  content={localContent}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══ Modals ═══ */}
      <ElementPickerModal
        open={elementPickerOpen}
        onClose={() => setElementPickerOpen(false)}
        onSelect={handleAddElement}
      />

      <ComputedFieldsDialog
        open={computedFieldsOpen}
        onClose={() => setComputedFieldsOpen(false)}
        computedFields={localContent.computedFields || []}
        onChange={(computedFields) =>
          handleContentChange({ ...localContent, computedFields })
        }
        availableFields={availableFields}
        templateType={template.templateType}
        subEntities={template.subEntities}
        settings={localContent.settings}
        onSettingsChange={(settings: PdfTemplateSettings) =>
          handleContentChange({ ...localContent, settings })
        }
      />
    </div>
  );
}
