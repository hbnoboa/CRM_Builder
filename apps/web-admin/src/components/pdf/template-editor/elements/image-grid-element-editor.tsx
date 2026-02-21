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
}

export function ImageGridElementEditor({
  element,
  onChange,
}: ImageGridElementEditorProps) {
  return (
    <div className="space-y-5">
      {/* Titulo da secao */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Titulo da Secao</Label>
        <Input
          placeholder="Ex: Fotos das Avarias"
          value={element.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      {/* Layout do Grid */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Layout</Label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Colunas</Label>
            <Select
              value={String(element.columns)}
              onValueChange={(value) => onChange({ columns: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Largura img (px)</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[element.imageWidth || 90]}
                onValueChange={([value]) => onChange({ imageWidth: value })}
                min={40}
                max={200}
                step={5}
                className="flex-1"
              />
              <span className="w-10 text-xs text-muted-foreground text-right">
                {element.imageWidth || 90}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Altura img (px)</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[element.imageHeight || 68]}
                onValueChange={([value]) => onChange({ imageHeight: value })}
                min={40}
                max={200}
                step={5}
                className="flex-1"
              />
              <span className="w-10 text-xs text-muted-foreground text-right">
                {element.imageHeight || 68}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Captions simples (sem sub-entidade) */}
      {!element.dataSource && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={element.showCaptions || false}
              onCheckedChange={(checked) => onChange({ showCaptions: checked })}
            />
            <Label className="text-sm">Mostrar legendas</Label>
          </div>

          {element.showCaptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Textos (na ordem das imagens)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ captionFields: [...(element.captionFields || []), ''] })}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              {(element.captionFields || []).map((caption, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`Legenda ${index + 1}`}
                    value={caption}
                    onChange={(e) => {
                      const newCaptions = [...(element.captionFields || [])];
                      newCaptions[index] = e.target.value;
                      onChange({ captionFields: newCaptions });
                    }}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      onChange({ captionFields: (element.captionFields || []).filter((_, i) => i !== index) });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Margens e tamanho de fonte */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">Espacamento</Label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Margem superior</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[element.marginTop || 0]}
                onValueChange={([value]) => onChange({ marginTop: value })}
                min={0}
                max={50}
                step={5}
                className="flex-1"
              />
              <span className="w-8 text-xs text-muted-foreground text-right">
                {element.marginTop || 0}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Margem inferior</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[element.marginBottom || 0]}
                onValueChange={([value]) => onChange({ marginBottom: value })}
                min={0}
                max={50}
                step={5}
                className="flex-1"
              />
              <span className="w-8 text-xs text-muted-foreground text-right">
                {element.marginBottom || 0}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fonte legenda</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[element.captionFontSize || 7]}
                onValueChange={([value]) => onChange({ captionFontSize: value })}
                min={5}
                max={12}
                step={1}
                className="flex-1"
              />
              <span className="w-8 text-xs text-muted-foreground text-right">
                {element.captionFontSize || 7}pt
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure a fonte de imagens e campos na aba Dados.
      </p>
    </div>
  );
}
