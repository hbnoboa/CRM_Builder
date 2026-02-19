'use client';

import { useTranslations } from 'next-intl';
import { Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { usePdfEditorStore } from '@/stores/pdf-editor-store';
import type { PdfElement, EntityField } from '@/types';

interface PropertiesPanelProps {
  element: PdfElement | null;
  entityFields?: EntityField[];
  className?: string;
}

export function PropertiesPanel({ element, entityFields = [], className }: PropertiesPanelProps) {
  const t = useTranslations('pdfTemplates.editor');
  const tFormat = useTranslations('pdfTemplates.formatTypes');
  const { updateElement, removeElement, duplicateElement, moveElementUp, moveElementDown } = usePdfEditorStore();

  if (!element) {
    return (
      <div className={cn('p-4 flex items-center justify-center h-full', className)}>
        <p className="text-sm text-muted-foreground text-center">
          {t('noElementSelected')}
        </p>
      </div>
    );
  }

  const handleChange = (field: keyof PdfElement, value: unknown) => {
    updateElement(element.name, { [field]: value });
  };

  const handlePositionChange = (axis: 'x' | 'y', value: string) => {
    const numValue = parseFloat(value) || 0;
    updateElement(element.name, {
      position: { ...element.position, [axis]: numValue },
    });
  };

  const handleFormatChange = (field: string, value: unknown) => {
    updateElement(element.name, {
      format: { ...element.format, [field]: value },
    });
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('properties')}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => moveElementUp(element.name)}
            title={t('moveForward')}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => moveElementDown(element.name)}
            title={t('moveBackward')}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => duplicateElement(element.name)}
            title={t('duplicateElement')}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => removeElement(element.name)}
            title={t('delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Position */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              {t('position')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">X</Label>
                <Input
                  type="number"
                  value={element.position.x}
                  onChange={(e) => handlePositionChange('x', e.target.value)}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Y</Label>
                <Input
                  type="number"
                  value={element.position.y}
                  onChange={(e) => handlePositionChange('y', e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              {t('size')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('width')}</Label>
                <Input
                  type="number"
                  value={element.width}
                  onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">{t('height')}</Label>
                <Input
                  type="number"
                  value={element.height}
                  onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Binding */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              {t('binding')}
            </h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('fieldBinding')}</Label>
                <Select
                  value={element.fieldSlug || 'none'}
                  onValueChange={(value) => handleChange('fieldSlug', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t('selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('none')}</SelectItem>
                    {entityFields.map((field) => (
                      <SelectItem key={field.slug} value={field.slug}>
                        {field.label || field.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('staticValue')}</Label>
                <Input
                  value={element.staticValue || ''}
                  onChange={(e) => handleChange('staticValue', e.target.value || undefined)}
                  placeholder={t('staticPlaceholder')}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">{t('expression')}</Label>
                <Input
                  value={element.expression || ''}
                  onChange={(e) => handleChange('expression', e.target.value || undefined)}
                  placeholder={t('expressionPlaceholder')}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Style (for text elements) */}
          {(element.type === 'text' || element.type === 'table') && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">
                {t('style')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('fontSize')}</Label>
                  <Input
                    type="number"
                    value={element.fontSize || 12}
                    onChange={(e) => handleChange('fontSize', parseFloat(e.target.value) || 12)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('fontWeight')}</Label>
                  <Select
                    value={element.fontWeight || 'normal'}
                    onValueChange={(value) => handleChange('fontWeight', value as 'normal' | 'bold')}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">{t('normal')}</SelectItem>
                      <SelectItem value="bold">{t('bold')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('fontColor')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={element.fontColor || '#000000'}
                      onChange={(e) => handleChange('fontColor', e.target.value)}
                      className="h-8 w-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={element.fontColor || '#000000'}
                      onChange={(e) => handleChange('fontColor', e.target.value)}
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t('alignment')}</Label>
                  <Select
                    value={element.alignment || 'left'}
                    onValueChange={(value) => handleChange('alignment', value as 'left' | 'center' | 'right')}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t('alignLeft')}</SelectItem>
                      <SelectItem value="center">{t('alignCenter')}</SelectItem>
                      <SelectItem value="right">{t('alignRight')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Background/Border (for shapes) */}
          {(element.type === 'rectangle' || element.type === 'line') && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">
                {t('style')}
              </h4>
              {element.type === 'rectangle' && (
                <div>
                  <Label className="text-xs">{t('backgroundColor')}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={element.backgroundColor || '#ffffff'}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="h-8 w-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={element.backgroundColor || 'transparent'}
                      onChange={(e) => handleChange('backgroundColor', e.target.value)}
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">{t('borderColor')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={element.borderColor || '#000000'}
                    onChange={(e) => handleChange('borderColor', e.target.value)}
                    className="h-8 w-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={element.borderColor || '#000000'}
                    onChange={(e) => handleChange('borderColor', e.target.value)}
                    className="h-8 flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('borderWidth')}</Label>
                <Input
                  type="number"
                  value={element.borderWidth || 1}
                  onChange={(e) => handleChange('borderWidth', parseFloat(e.target.value) || 1)}
                  className="h-8"
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Format */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              {t('format')}
            </h4>
            <div>
              <Label className="text-xs">{t('formatType')}</Label>
              <Select
                value={element.format?.type || 'text'}
                onValueChange={(value) => handleFormatChange('type', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{tFormat('text')}</SelectItem>
                  <SelectItem value="number">{tFormat('number')}</SelectItem>
                  <SelectItem value="currency">{tFormat('currency')}</SelectItem>
                  <SelectItem value="percentage">{tFormat('percentage')}</SelectItem>
                  <SelectItem value="date">{tFormat('date')}</SelectItem>
                  <SelectItem value="datetime">{tFormat('datetime')}</SelectItem>
                  <SelectItem value="time">{tFormat('time')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(element.format?.type === 'number' || element.format?.type === 'currency' || element.format?.type === 'percentage') && (
              <div>
                <Label className="text-xs">{t('formatDecimals')}</Label>
                <Input
                  type="number"
                  value={element.format?.decimals ?? 2}
                  onChange={(e) => handleFormatChange('decimals', parseInt(e.target.value) || 0)}
                  className="h-8"
                  min={0}
                  max={10}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('formatPrefix')}</Label>
                <Input
                  value={element.format?.prefix || ''}
                  onChange={(e) => handleFormatChange('prefix', e.target.value || undefined)}
                  placeholder="R$ "
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">{t('formatSuffix')}</Label>
                <Input
                  value={element.format?.suffix || ''}
                  onChange={(e) => handleFormatChange('suffix', e.target.value || undefined)}
                  placeholder=" kg"
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
