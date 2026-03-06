'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type {
  PdfTemplate,
  PdfMargins,
  PdfTemplateSettings,
  PdfTemplateContent,
} from '@/services/pdf-templates.service';

interface TemplateInfoPanelProps {
  template: PdfTemplate;
  content: PdfTemplateContent;
  onTemplateFieldChange: (field: string, value: unknown) => void;
  onContentChange: (content: PdfTemplateContent) => void;
}

export function TemplateInfoPanel({
  template,
  content,
  onTemplateFieldChange,
  onContentChange,
}: TemplateInfoPanelProps) {
  const margins = template.margins || { top: 40, right: 40, bottom: 40, left: 40 };
  const settings = content.settings || {};

  const handleMarginChange = (side: keyof PdfMargins, value: number) => {
    onTemplateFieldChange('margins', {
      ...margins,
      [side]: value,
    });
  };

  const handleSettingsChange = (field: keyof PdfTemplateSettings, value: string) => {
    onContentChange({
      ...content,
      settings: {
        ...settings,
        [field]: value,
      },
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Informacoes do Template</h3>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              value={template.name}
              onChange={(e) => onTemplateFieldChange('name', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Slug</Label>
            <Input
              value={template.slug}
              disabled
              className="h-9 text-sm bg-muted"
            />
          </div>

          <div>
            <Label className="text-xs">Descricao</Label>
            <Textarea
              value={template.description || ''}
              onChange={(e) => onTemplateFieldChange('description', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Badge variant={template.isPublished ? 'default' : 'secondary'}>
              {template.isPublished ? 'Publicado' : 'Rascunho'}
            </Badge>
            <Badge variant="outline">
              {template.templateType === 'batch' ? 'Lote' : 'Individual'}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Entidade Fonte</h3>
        <div className="text-sm text-muted-foreground">
          {template.sourceEntity ? (
            <Badge variant="outline" className="text-xs">
              {template.sourceEntity.name}
            </Badge>
          ) : (
            'Nenhuma entidade vinculada'
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Pagina</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tamanho</Label>
            <Select
              value={template.pageSize}
              onValueChange={(v) => onTemplateFieldChange('pageSize', v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="LETTER">Carta</SelectItem>
                <SelectItem value="LEGAL">Oficio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Orientacao</Label>
            <Select
              value={template.orientation}
              onValueChange={(v) => onTemplateFieldChange('orientation', v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PORTRAIT">Retrato</SelectItem>
                <SelectItem value="LANDSCAPE">Paisagem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Margens (px)</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <div key={side}>
              <Label className="text-xs capitalize">
                {side === 'top' ? 'Superior' : side === 'right' ? 'Direita' : side === 'bottom' ? 'Inferior' : 'Esquerda'}
              </Label>
              <Input
                type="number"
                value={margins[side]}
                onChange={(e) => handleMarginChange(side, Number(e.target.value))}
                className="h-9 text-sm"
                min={0}
                max={200}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Configuracoes</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Padrao para campos vazios</Label>
            <Input
              value={settings.emptyFieldDefault || ''}
              onChange={(e) => handleSettingsChange('emptyFieldDefault', e.target.value)}
              placeholder="Ex: N/A, -, (vazio)"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Padrao do nome do arquivo</Label>
            <Input
              value={settings.fileNamePattern || ''}
              onChange={(e) => handleSettingsChange('fileNamePattern', e.target.value)}
              placeholder="Ex: {{slug}}-{{id}}"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
