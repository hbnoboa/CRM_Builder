'use client';

import { useState } from 'react';
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
import type { PdfFooter } from '@/services/pdf-templates.service';

interface FooterTabProps {
  footer?: PdfFooter;
  onChange: (footer: PdfFooter) => void;
}

export function FooterTab({ footer, onChange }: FooterTabProps) {
  const [localFooter, setLocalFooter] = useState<PdfFooter>(
    footer || {
      showPageNumbers: true,
      position: 'center',
    }
  );

  const handleChange = (updates: Partial<PdfFooter>) => {
    const newFooter = { ...localFooter, ...updates };
    setLocalFooter(newFooter);
    onChange(newFooter);
  };

  return (
    <div className="space-y-6">
      {/* Texto do Footer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Texto do Rodape</CardTitle>
          <CardDescription>Texto que aparecera no rodape de cada pagina</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Texto</Label>
            <Input
              placeholder="Ex: Documento gerado automaticamente"
              value={localFooter.text || ''}
              onChange={(e) => handleChange({ text: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para nao exibir texto no rodape
            </p>
          </div>

          <div className="space-y-2">
            <Label>Posicao do Texto</Label>
            <Select
              value={localFooter.position || 'center'}
              onValueChange={(value) =>
                handleChange({ position: value as 'left' | 'center' | 'right' })
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
        </CardContent>
      </Card>

      {/* Numeracao */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Numeracao de Paginas</CardTitle>
          <CardDescription>Exibir numero das paginas no rodape</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Switch
              checked={localFooter.showPageNumbers ?? true}
              onCheckedChange={(checked) => handleChange({ showPageNumbers: checked })}
            />
            <Label>Mostrar numeracao de paginas</Label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Formato: &quot;Pagina X de Y&quot;
          </p>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview do Rodape</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md p-4 bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {localFooter.position === 'left' && (
                <>
                  <span>{localFooter.text || '(sem texto)'}</span>
                  <span>{localFooter.showPageNumbers && 'Pagina 1 de 3'}</span>
                </>
              )}
              {localFooter.position === 'center' && (
                <>
                  <span></span>
                  <span>
                    {localFooter.text || '(sem texto)'}
                    {localFooter.showPageNumbers && ' - Pagina 1 de 3'}
                  </span>
                  <span></span>
                </>
              )}
              {localFooter.position === 'right' && (
                <>
                  <span>{localFooter.showPageNumbers && 'Pagina 1 de 3'}</span>
                  <span>{localFooter.text || '(sem texto)'}</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
