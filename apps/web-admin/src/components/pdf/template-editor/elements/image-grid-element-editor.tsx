'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ImageGridElement } from '@/services/pdf-templates.service';

interface ImageGridElementEditorProps {
  element: ImageGridElement;
  onChange: (updates: Partial<ImageGridElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function ImageGridElementEditor({
  element,
  onChange,
  availableFields,
}: ImageGridElementEditorProps) {
  const handleAddCaption = () => {
    onChange({
      captionFields: [...(element.captionFields || []), ''],
    });
  };

  const handleRemoveCaption = (index: number) => {
    onChange({
      captionFields: (element.captionFields || []).filter((_, i) => i !== index),
    });
  };

  const handleCaptionChange = (index: number, value: string) => {
    const newCaptions = [...(element.captionFields || [])];
    newCaptions[index] = value;
    onChange({ captionFields: newCaptions });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Titulo (opcional)</Label>
        <Input
          placeholder="Ex: Fotos das Avarias"
          value={element.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fonte de Dados (array de imagens)</Label>
          <Select
            value={element.dataSource}
            onValueChange={(value) => onChange({ dataSource: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {availableFields
                .filter((f) => f.type === 'image' || f.type === 'images' || f.type === 'array')
                .map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
              <SelectItem value="_imagensGrid">_imagensGrid (especial)</SelectItem>
              <SelectItem value="_damagedVehiclesImages">_damagedVehiclesImages (especial)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Campo que contem o array de URLs de imagens
          </p>
        </div>

        <div className="space-y-2">
          <Label>Numero de Colunas</Label>
          <Select
            value={String(element.columns)}
            onValueChange={(value) => onChange({ columns: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 colunas</SelectItem>
              <SelectItem value="3">3 colunas</SelectItem>
              <SelectItem value="4">4 colunas</SelectItem>
              <SelectItem value="5">5 colunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Largura da Imagem (px)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[element.imageWidth || 90]}
              onValueChange={([value]) => onChange({ imageWidth: value })}
              min={50}
              max={200}
              step={5}
              className="flex-1"
            />
            <span className="w-12 text-sm text-muted-foreground">
              {element.imageWidth || 90}px
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Altura da Imagem (px)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[element.imageHeight || 68]}
              onValueChange={([value]) => onChange({ imageHeight: value })}
              min={50}
              max={200}
              step={5}
              className="flex-1"
            />
            <span className="w-12 text-sm text-muted-foreground">
              {element.imageHeight || 68}px
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={element.showCaptions || false}
          onCheckedChange={(checked) => onChange({ showCaptions: checked })}
        />
        <Label>Mostrar Legendas</Label>
      </div>

      {element.showCaptions && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Campos das Legendas</Label>
            <Button variant="outline" size="sm" onClick={handleAddCaption}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Textos que aparecerao abaixo de cada imagem (na ordem)
          </p>

          <div className="space-y-2">
            {(element.captionFields || []).map((caption, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder={`Legenda ${index + 1}`}
                  value={caption}
                  onChange={(e) => handleCaptionChange(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleRemoveCaption(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Margem Superior (px)</Label>
          <Slider
            value={[element.marginTop || 0]}
            onValueChange={([value]) => onChange({ marginTop: value })}
            min={0}
            max={50}
            step={5}
          />
        </div>
        <div className="space-y-2">
          <Label>Margem Inferior (px)</Label>
          <Slider
            value={[element.marginBottom || 0]}
            onValueChange={([value]) => onChange({ marginBottom: value })}
            min={0}
            max={50}
            step={5}
          />
        </div>
      </div>
    </div>
  );
}
