'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PdfElement,
  PdfHeader,
  PdfFooter,
  PdfTemplateContent,
  TextElement,
  FieldGroupElement,
  TableElement,
  ImageGridElement,
  StatisticsElement,
  DividerElement,
  SpacerElement,
  ComputedField,
} from '@/services/pdf-templates.service';
import type { SelectedZone } from './pdf-canvas';

// Appearance editors
import { TextElementEditor } from '@/components/pdf/template-editor/elements/text-element-editor';
import { FieldGroupElementEditor } from '@/components/pdf/template-editor/elements/field-group-element-editor';
import { TableElementEditor } from '@/components/pdf/template-editor/elements/table-element-editor';
import { ImageGridElementEditor } from '@/components/pdf/template-editor/elements/image-grid-element-editor';
import { DividerElementEditor } from '@/components/pdf/template-editor/elements/divider-element-editor';
import { SpacerElementEditor } from '@/components/pdf/template-editor/elements/spacer-element-editor';
import { StatisticsElementEditor } from '@/components/pdf/template-editor/elements/statistics-element-editor';

// Data editors
import { FieldGroupDataEditor } from '@/components/pdf/template-editor/data-editors/field-group-data-editor';
import { TableDataEditor } from '@/components/pdf/template-editor/data-editors/table-data-editor';
import { ImageGridDataEditor } from '@/components/pdf/template-editor/data-editors/image-grid-data-editor';
import { StatisticsDataEditor } from '@/components/pdf/template-editor/data-editors/statistics-data-editor';
import { VisibilityEditor } from '@/components/pdf/template-editor/data-editors/visibility-editor';

// Header / Footer editors
import { HeaderTab } from '@/components/pdf/template-editor/header-tab';
import { FooterTab } from '@/components/pdf/template-editor/footer-tab';

import { getElementIcon, getElementLabel } from './element-renderers';

// ─── Types ───────────────────────────────────────────────

type AvailableField = { slug: string; name: string; label?: string; type: string };

interface ElementPropertiesPanelProps {
  selected: SelectedZone;
  content: PdfTemplateContent;
  onChange: (content: PdfTemplateContent) => void;
  onDelete: (id: string) => void;
  onDeselect: () => void;
  availableFields: AvailableField[];
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: AvailableField[];
  }>;
  computedFields?: ComputedField[];
  templateType: 'single' | 'batch';
}

// ─── Collapsible Section ─────────────────────────────────

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group">
        {title}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Data element types ──────────────────────────────────

const DATA_ELEMENT_TYPES = ['field-group', 'table', 'image-grid', 'statistics'] as const;

function hasDataEditor(type: string): boolean {
  return DATA_ELEMENT_TYPES.includes(type as (typeof DATA_ELEMENT_TYPES)[number]);
}

// ─── Body Element Editor ─────────────────────────────────

function BodyElementEditor({
  element,
  content,
  onChange,
  onDelete,
  availableFields,
  subEntities,
  computedFields,
  templateType,
}: {
  element: PdfElement;
  content: PdfTemplateContent;
  onChange: (content: PdfTemplateContent) => void;
  onDelete: () => void;
  availableFields: AvailableField[];
  subEntities?: ElementPropertiesPanelProps['subEntities'];
  computedFields?: ComputedField[];
  templateType: 'single' | 'batch';
}) {
  const Icon = getElementIcon(element.type);

  const handleElementChange = (updates: Partial<PdfElement>) => {
    onChange({
      ...content,
      body: content.body.map((el) =>
        el.id === element.id ? { ...el, ...updates } : el,
      ),
    });
  };

  return (
    <div className="p-4 space-y-3">
      {/* Element header */}
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">{getElementLabel(element.type)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Appearance Section */}
      <Section title="Aparencia">
        {element.type === 'text' && (
          <TextElementEditor
            element={element as TextElement}
            onChange={handleElementChange}
            availableFields={availableFields}
          />
        )}
        {element.type === 'field-group' && (
          <FieldGroupElementEditor
            element={element as FieldGroupElement}
            onChange={handleElementChange}
          />
        )}
        {element.type === 'table' && (
          <TableElementEditor
            element={element as TableElement}
            onChange={handleElementChange}
          />
        )}
        {element.type === 'image-grid' && (
          <ImageGridElementEditor
            element={element as ImageGridElement}
            onChange={handleElementChange}
          />
        )}
        {element.type === 'statistics' && (
          <StatisticsElementEditor
            element={element as StatisticsElement}
            onChange={handleElementChange}
          />
        )}
        {element.type === 'divider' && (
          <DividerElementEditor
            element={element as DividerElement}
            onChange={handleElementChange}
          />
        )}
        {element.type === 'spacer' && (
          <SpacerElementEditor
            element={element as SpacerElement}
            onChange={handleElementChange}
          />
        )}
      </Section>

      {/* Data Section (only for data-capable elements) */}
      {hasDataEditor(element.type) && (
        <>
          <Separator />
          <Section title="Dados">
            {element.type === 'field-group' && (
              <FieldGroupDataEditor
                element={element as FieldGroupElement}
                onChange={handleElementChange}
                availableFields={availableFields}
                isBatch={templateType === 'batch'}
                computedFields={computedFields?.map((cf) => ({ slug: cf.slug, label: cf.label }))}
              />
            )}
            {element.type === 'table' && (
              <TableDataEditor
                element={element as TableElement}
                onChange={handleElementChange}
                availableFields={availableFields}
                subEntities={subEntities}
              />
            )}
            {element.type === 'image-grid' && (
              <ImageGridDataEditor
                element={element as ImageGridElement}
                onChange={handleElementChange}
                availableFields={availableFields}
                subEntities={subEntities}
              />
            )}
            {element.type === 'statistics' && (
              <StatisticsDataEditor
                element={element as StatisticsElement}
                onChange={handleElementChange}
                availableFields={availableFields}
              />
            )}
          </Section>
        </>
      )}

      {/* Visibility Section */}
      <Separator />
      <Section title="Visibilidade" defaultOpen={!!element.visibility}>
        <VisibilityEditor
          visibility={element.visibility}
          onChange={(visibility) => handleElementChange({ visibility })}
          availableFields={availableFields}
        />
      </Section>

      {/* Repeat per record (batch only) */}
      {templateType === 'batch' && (
        <>
          <Separator />
          <Section title="Repeticao" defaultOpen={!!element.repeatPerRecord}>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Repetir por registro</Label>
                <p className="text-[10px] text-muted-foreground">
                  Este elemento sera repetido para cada registro do lote
                </p>
              </div>
              <Switch
                checked={element.repeatPerRecord || false}
                onCheckedChange={(checked) =>
                  handleElementChange({ repeatPerRecord: checked })
                }
              />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────

export function ElementPropertiesPanel({
  selected,
  content,
  onChange,
  onDelete,
  onDeselect,
  availableFields,
  subEntities,
  computedFields,
  templateType,
}: ElementPropertiesPanelProps) {
  if (!selected) return null;

  // Header
  if (selected.type === 'header') {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Header</h3>
        </div>
        <HeaderTab
          header={content.header}
          onChange={(header: PdfHeader) => onChange({ ...content, header })}
          availableFields={availableFields}
        />
      </div>
    );
  }

  // Footer
  if (selected.type === 'footer') {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Footer</h3>
        </div>
        <FooterTab
          footer={content.footer}
          onChange={(footer: PdfFooter) => onChange({ ...content, footer })}
        />
      </div>
    );
  }

  // Body element
  if (selected.type === 'element') {
    const element = content.body.find((el) => el.id === selected.id);
    if (!element) {
      onDeselect();
      return null;
    }

    return (
      <BodyElementEditor
        key={element.id}
        element={element}
        content={content}
        onChange={onChange}
        onDelete={() => onDelete(element.id)}
        availableFields={availableFields}
        subEntities={subEntities}
        computedFields={computedFields}
        templateType={templateType}
      />
    );
  }

  return null;
}
