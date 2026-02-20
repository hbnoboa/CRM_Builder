'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { ImageUpload } from '@/components/ui/file-upload';
import type { PdfHeader } from '@/services/pdf-templates.service';

interface HeaderTabProps {
  header?: PdfHeader;
  onChange: (header: PdfHeader) => void;
  availableFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function HeaderTab({ header, onChange, availableFields = [] }: HeaderTabProps) {
  const [localHeader, setLocalHeader] = useState<PdfHeader>(
    header || {
      showOnAllPages: true,
    }
  );

  const handleChange = (updates: Partial<PdfHeader>) => {
    const newHeader = { ...localHeader, ...updates };
    setLocalHeader(newHeader);
    onChange(newHeader);
  };

  const handleLogoChange = (updates: Partial<PdfHeader['logo']>) => {
    const newLogo = { ...localHeader.logo, ...updates } as PdfHeader['logo'];
    handleChange({ logo: newLogo });
  };

  const handleTitleChange = (updates: Partial<PdfHeader['title']>) => {
    const newTitle = { ...localHeader.title, ...updates } as PdfHeader['title'];
    handleChange({ title: newTitle });
  };

  const handleSubtitleChange = (updates: Partial<PdfHeader['subtitle']>) => {
    const newSubtitle = { ...localHeader.subtitle, ...updates } as PdfHeader['subtitle'];
    handleChange({ subtitle: newSubtitle });
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logo</CardTitle>
          <CardDescription>Configure o logo que aparecera no cabecalho do PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Logo</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://exemplo.com/logo.png ou {{tenant.logo}}"
                value={localHeader.logo?.url || ''}
                onChange={(e) => handleLogoChange({ url: e.target.value })}
              />
              {localHeader.logo?.url && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleChange({ logo: undefined })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Use {`{{tenant.logo}}`} para usar o logo do tenant dinamicamente
            </p>
          </div>

          <div className="space-y-2">
            <Label>Ou envie uma imagem</Label>
            <ImageUpload
              value={localHeader.logo?.url && !localHeader.logo.url.includes('{{') ? localHeader.logo.url : undefined}
              onChange={(url) => handleLogoChange({ url })}
              onRemove={() => handleChange({ logo: undefined })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Largura (px)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[localHeader.logo?.width || 100]}
                  onValueChange={([value]) => handleLogoChange({ width: value })}
                  min={30}
                  max={500}
                  step={10}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {localHeader.logo?.width || 100}px
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Altura (px)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[localHeader.logo?.height || 60]}
                  onValueChange={([value]) => handleLogoChange({ height: value })}
                  min={20}
                  max={300}
                  step={10}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {localHeader.logo?.height || 60}px
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Posicao</Label>
              <Select
                value={localHeader.logo?.position || 'left'}
                onValueChange={(value) =>
                  handleLogoChange({ position: value as 'left' | 'center' | 'right' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Titulo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Titulo</CardTitle>
          <CardDescription>Texto principal do cabecalho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Texto do Titulo</Label>
            <Input
              placeholder="Ex: Relatorio de Inspecao"
              value={localHeader.title?.text || ''}
              onChange={(e) => handleTitleChange({ text: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tamanho da Fonte</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[localHeader.title?.fontSize || 14]}
                  onValueChange={([value]) => handleTitleChange({ fontSize: value })}
                  min={8}
                  max={24}
                  step={1}
                  className="flex-1"
                />
                <span className="w-12 text-sm text-muted-foreground">
                  {localHeader.title?.fontSize || 14}pt
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={localHeader.title?.bold || false}
                onCheckedChange={(checked) => handleTitleChange({ bold: checked })}
              />
              <Label>Negrito</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subtitulo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subtitulo</CardTitle>
          <CardDescription>Texto secundario (pode usar data binding)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Texto do Subtitulo</Label>
            <Input
              placeholder="Ex: Chassi: {{chassi}} ou Data: {{data}}"
              value={localHeader.subtitle?.text || ''}
              onChange={(e) => handleSubtitleChange({ text: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Use {`{{campo}}`} para inserir valores dinamicos dos dados
            </p>
          </div>

          <div className="space-y-2">
            <Label>Campo de Binding (alternativo)</Label>
            {availableFields.length > 0 ? (
              <Select
                value={localHeader.subtitle?.binding || '_none'}
                onValueChange={(value) => handleSubtitleChange({ binding: value === '_none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {availableFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Ex: chassi"
                value={localHeader.subtitle?.binding || ''}
                onChange={(e) => handleSubtitleChange({ binding: e.target.value })}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Campo que sera exibido diretamente no subtitulo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Opcoes Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Opcoes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Switch
              checked={localHeader.showOnAllPages ?? true}
              onCheckedChange={(checked) => handleChange({ showOnAllPages: checked })}
            />
            <Label>Mostrar cabecalho em todas as paginas</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
