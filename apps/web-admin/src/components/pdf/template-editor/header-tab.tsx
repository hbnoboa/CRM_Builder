'use client';

import { useState, useRef } from 'react';
import { Trash2, Upload, X, Loader2, AlertCircle, Lock, Unlock } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { PdfHeader } from '@/services/pdf-templates.service';

interface HeaderTabProps {
  header?: PdfHeader;
  onChange: (header: PdfHeader) => void;
  availableFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function HeaderTab({ header, onChange, availableFields = [] }: HeaderTabProps) {
  const t = useTranslations('fileUpload');
  const [localHeader, setLocalHeader] = useState<PdfHeader>(
    header || {
      showOnAllPages: true,
    }
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lockRatio, setLockRatio] = useState(true);
  const aspectRatio = useRef<number | null>(null);

  // Calcular aspect ratio da imagem real
  const updateAspectRatio = (url: string) => {
    const img = new Image();
    img.onload = () => {
      aspectRatio.current = img.naturalWidth / img.naturalHeight;
    };
    img.src = url;
  };

  // Inicializar aspect ratio se ja tem logo
  if (localHeader.logo?.url && !localHeader.logo.url.includes('{{') && !aspectRatio.current) {
    updateAspectRatio(localHeader.logo.url);
  }

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

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Imagem muito grande (max 10MB)');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'logos');
      const response = await api.post('/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response.data.publicUrl || response.data.url;
      updateAspectRatio(url);
      handleLogoChange({ url });
    } catch {
      setUploadError('Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const hasLogo = !!localHeader.logo?.url;
  const isDynamicLogo = localHeader.logo?.url?.includes('{{');

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Logo</Label>

        {/* Preview ou Upload */}
        {hasLogo ? (
          <div className="space-y-3">
            {/* Preview constrained */}
            {isDynamicLogo ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  Logo
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">{localHeader.logo?.url}</p>
                  <p className="text-xs text-muted-foreground">Logo dinamico do tenant</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive flex-shrink-0"
                  onClick={() => handleChange({ logo: undefined })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="border rounded-lg p-2 bg-muted/30 flex-shrink-0">
                  <img
                    src={localHeader.logo?.url}
                    alt="Logo"
                    className="max-h-20 max-w-[200px] object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1 pt-1">
                  <p className="text-sm truncate text-muted-foreground">
                    {localHeader.logo?.url?.split('/').pop()}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-7 text-xs"
                    onClick={() => handleChange({ logo: undefined })}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
            )}

            {/* Tamanho e posicao */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Largura</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[localHeader.logo?.width || 100]}
                      onValueChange={([value]) => {
                        if (lockRatio && aspectRatio.current) {
                          const h = Math.round(value / aspectRatio.current);
                          handleLogoChange({ width: value, height: Math.max(20, Math.min(300, h)) });
                        } else {
                          handleLogoChange({ width: value });
                        }
                      }}
                      min={30}
                      max={500}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-xs text-muted-foreground text-right">
                      {localHeader.logo?.width || 100}px
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mt-4 flex-shrink-0"
                  onClick={() => setLockRatio(!lockRatio)}
                  title={lockRatio ? 'Desbloquear proporcao' : 'Travar proporcao'}
                >
                  {lockRatio ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </Button>

                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Altura</Label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[localHeader.logo?.height || 60]}
                      onValueChange={([value]) => {
                        if (lockRatio && aspectRatio.current) {
                          const w = Math.round(value * aspectRatio.current);
                          handleLogoChange({ height: value, width: Math.max(30, Math.min(500, w)) });
                        } else {
                          handleLogoChange({ height: value });
                        }
                      }}
                      min={20}
                      max={300}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-xs text-muted-foreground text-right">
                      {localHeader.logo?.height || 60}px
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Posicao</Label>
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
          </div>
        ) : (
          <div className="space-y-2">
            {/* Upload area */}
            <label
              className={cn(
                'relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
                'border-muted-foreground/25 hover:border-primary/50',
                isUploading && 'pointer-events-none opacity-60',
              )}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
              />
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste uma imagem
                  </p>
                </>
              )}
            </label>

            {uploadError && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                {uploadError}
              </div>
            )}

            {/* URL manual ou dinamica */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">ou</span>
              <Input
                placeholder="Cole a URL da imagem ou use {{tenant.logo}}"
                value=""
                onChange={(e) => {
                  if (e.target.value) handleLogoChange({ url: e.target.value });
                }}
                className="flex-1 text-xs h-8"
              />
            </div>
          </div>
        )}
      </div>

      {/* Titulo */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-base font-medium">Titulo</Label>
        <Input
          placeholder="Ex: Relatorio de Inspecao"
          value={localHeader.title?.text || ''}
          onChange={(e) => handleTitleChange({ text: e.target.value })}
        />
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Tamanho da fonte</Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[localHeader.title?.fontSize || 14]}
                onValueChange={([value]) => handleTitleChange({ fontSize: value })}
                min={8}
                max={24}
                step={1}
                className="flex-1"
              />
              <span className="w-10 text-xs text-muted-foreground text-right">
                {localHeader.title?.fontSize || 14}pt
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Switch
              checked={localHeader.title?.bold || false}
              onCheckedChange={(checked) => handleTitleChange({ bold: checked })}
            />
            <span className="text-xs font-bold">B</span>
          </div>
        </div>
      </div>

      {/* Subtitulo */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-base font-medium">Subtitulo</Label>
        <Input
          placeholder="Ex: Chassi: {{chassi}} — Data: {{data}}"
          value={localHeader.subtitle?.text || ''}
          onChange={(e) => handleSubtitleChange({ text: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Use {`{{campo}}`} para inserir valores dos dados. Exemplo: Chassi: {`{{chassi}}`}
        </p>

        {availableFields.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Inserir campo no subtitulo</Label>
            <Select
              value="_none"
              onValueChange={(value) => {
                if (value !== '_none') {
                  const currentText = localHeader.subtitle?.text || '';
                  handleSubtitleChange({ text: `${currentText}{{${value}}}` });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar campo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecionar campo para inserir...</SelectItem>
                {availableFields
                  .filter((f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type))
                  .map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Opcoes */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={localHeader.showOnAllPages ?? true}
            onCheckedChange={(checked) => handleChange({ showOnAllPages: checked })}
          />
          <Label>Mostrar cabecalho em todas as paginas</Label>
        </div>
      </div>
    </div>
  );
}
