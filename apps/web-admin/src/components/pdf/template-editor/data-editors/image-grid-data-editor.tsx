'use client';

import { ImageIcon, Info, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ImageGridElement } from '@/services/pdf-templates.service';

interface ImageGridDataEditorProps {
  element: ImageGridElement;
  onChange: (updates: Partial<ImageGridElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
}

export function ImageGridDataEditor({
  element,
  onChange,
  availableFields,
  subEntities,
}: ImageGridDataEditorProps) {
  const selectedSubEntity = element.dataSource && subEntities?.[element.dataSource];
  const subEntityImageFields = selectedSubEntity?.fields?.filter(
    (f) => f.type === 'image'
  ) || [];
  const subEntityAllFields = selectedSubEntity?.fields || [];

  const parentImageFields = availableFields.filter((f) => f.type === 'image' || f.type === 'images');

  const subEntityOptions = availableFields.filter(
    (f) => f.type === 'sub-entity' || f.type === 'array'
  );
  const imageFieldOptions = availableFields.filter(
    (f) => f.type === 'image' || f.type === 'images'
  );

  const handleToggleImageField = (slug: string, checked: boolean) => {
    const current = element.imageFields || [];
    if (checked) {
      onChange({ imageFields: [...current, slug] });
    } else {
      onChange({ imageFields: current.filter((f) => f !== slug) });
    }
  };

  const handleToggleParentImageField = (slug: string, checked: boolean) => {
    const current = element.parentImageFields || [];
    if (checked) {
      onChange({ parentImageFields: [...current, slug] });
    } else {
      onChange({ parentImageFields: current.filter((f) => f !== slug) });
    }
  };

  const parentCols = element.parentImageFields?.length || 0;
  const childCols = element.imageFields?.length || 0;
  const totalCols = parentCols + childCols;

  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...(element.captionFields || [])];
    newHeaders[index] = value;
    onChange({ captionFields: newHeaders });
  };

  const handleDataCaptionChange = (index: number, value: string) => {
    const newCaptions = [...(element.captionDataFields || [])];
    newCaptions[index] = value;
    onChange({ captionDataFields: newCaptions });
  };

  const ensureArraySize = (arr: string[] | undefined, size: number): string[] => {
    const result = [...(arr || [])];
    while (result.length < size) result.push('');
    return result.slice(0, size);
  };

  const headers = ensureArraySize(element.captionFields, totalCols);
  const dataCaptions = ensureArraySize(element.captionDataFields, totalCols);

  return (
    <div className="space-y-4">
      {/* Fonte de dados */}
      <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Fonte das Imagens</Label>
        </div>

        {subEntityOptions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Repetir imagens de uma sub-entidade (loop por registro)
            </Label>
            <Select
              value={element.dataSource || '_empty'}
              onValueChange={(value) => onChange({
                dataSource: value === '_empty' ? '' : value,
                imageFields: [],
                parentImageFields: [],
                captionFields: [],
                captionDataFields: [],
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sub-entidade..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_empty">Nenhuma (usar campos diretos)</SelectItem>
                {subEntityOptions.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!selectedSubEntity && imageFieldOptions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Ou use campos de imagem do registro principal
            </Label>
            <Select
              value={element.dataSource || '_empty'}
              onValueChange={(value) => onChange({
                dataSource: value === '_empty' ? '' : value,
                imageFields: [],
                parentImageFields: [],
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Campo de imagem..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_empty">Selecione...</SelectItem>
                {imageFieldOptions.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedSubEntity && (
          <>
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
              <p className="font-medium">Loop: {selectedSubEntity.name}</p>
              <p className="text-xs mt-1 opacity-80">
                Para cada registro, as imagens selecionadas abaixo serao exibidas como colunas.
              </p>
            </div>

            {subEntityImageFields.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm">Colunas de imagem (por registro)</Label>
                <div className="grid gap-2">
                  {subEntityImageFields.map((f) => (
                    <label
                      key={f.slug}
                      className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={(element.imageFields || []).includes(f.slug)}
                        onCheckedChange={(checked) => handleToggleImageField(f.slug, !!checked)}
                      />
                      <span className="text-sm">{f.label || f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>Esta sub-entidade nao tem campos de imagem.</span>
                </div>
              </div>
            )}

            {parentImageFields.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm">Colunas fixas (do registro principal)</Label>
                <p className="text-xs text-muted-foreground">
                  Aparecem nas primeiras colunas de cada linha, repetidas em todos os registros.
                </p>
                <div className="grid gap-2">
                  {parentImageFields.map((f) => (
                    <label
                      key={f.slug}
                      className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        checked={(element.parentImageFields || []).includes(f.slug)}
                        onCheckedChange={(checked) => handleToggleParentImageField(f.slug, !!checked)}
                      />
                      <span className="text-sm">{f.label || f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cabecalhos e Legendas */}
      {selectedSubEntity && totalCols > 0 && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Cabecalhos e Legendas</Label>
          </div>

          <p className="text-xs text-muted-foreground">
            Configure o texto acima (cabecalho) e abaixo (legenda dinamica) de cada coluna de imagem.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground w-20">Coluna</th>
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Cabecalho</th>
                  <th className="text-left py-1.5 pl-2 font-medium text-muted-foreground">Legenda (campo)</th>
                </tr>
              </thead>
              <tbody>
                {(element.parentImageFields || []).map((slug, i) => {
                  const field = parentImageFields.find((f) => f.slug === slug);
                  return (
                    <tr key={`p-${slug}`} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] dark:bg-blue-900 dark:text-blue-300">
                          {field?.label || field?.name || slug}
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          placeholder={`Ex: ${field?.label || field?.name || 'Foto'}`}
                          value={headers[i] || ''}
                          onChange={(e) => handleHeaderChange(i, e.target.value)}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 pl-2">
                        <Select
                          value={dataCaptions[i] || '_none'}
                          onValueChange={(value) => handleDataCaptionChange(i, value === '_none' ? '' : value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {availableFields
                              .filter((f) => f.type !== 'image' && f.type !== 'images')
                              .map((f) => (
                                <SelectItem key={f.slug} value={f.slug}>
                                  {f.label || f.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
                {(element.imageFields || []).map((slug, i) => {
                  const field = subEntityImageFields.find((f) => f.slug === slug);
                  const colIdx = parentCols + i;
                  return (
                    <tr key={`c-${slug}`} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] dark:bg-green-900 dark:text-green-300">
                          {field?.label || field?.name || slug}
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          placeholder={`Ex: ${field?.label || field?.name || 'Foto'}`}
                          value={headers[colIdx] || ''}
                          onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 pl-2">
                        <Select
                          value={dataCaptions[colIdx] || '_none'}
                          onValueChange={(value) => handleDataCaptionChange(colIdx, value === '_none' ? '' : value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {subEntityAllFields
                              .filter((f) => f.type !== 'image' && f.type !== 'images')
                              .map((f) => (
                                <SelectItem key={f.slug} value={f.slug}>
                                  {f.label || f.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalCols === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Selecione campos de imagem acima para configurar cabecalhos e legendas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
