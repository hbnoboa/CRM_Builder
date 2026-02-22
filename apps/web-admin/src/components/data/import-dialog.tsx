'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileSpreadsheet, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { dataService } from '@/services/data.service';

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportDialogProps {
  entitySlug: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportDialog({ entitySlug, entityName, open, onOpenChange, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: ImportError[]; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.toLowerCase();
      if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.json')) {
        toast.error('Formato nao suportado. Use .xlsx ou .json');
        return;
      }
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const res = await dataService.importData(entitySlug, file);
      setResult(res);

      if (res.imported > 0) {
        toast.success(`${res.imported} registro(s) importado(s) com sucesso`);
        onSuccess();
      }

      if (res.errors.length > 0 && res.imported === 0) {
        toast.error('Nenhum registro importado. Verifique os erros abaixo.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao importar';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!importing) {
      setFile(null);
      setResult(null);
      onOpenChange(open);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isExcel = file?.name.toLowerCase().endsWith('.xlsx') || file?.name.toLowerCase().endsWith('.xls');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar dados - {entityName}</DialogTitle>
          <DialogDescription>
            Selecione um arquivo .xlsx ou .json para importar registros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload area */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                {isExcel ? (
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                ) : (
                  <FileJson className="h-8 w-8 text-blue-600" />
                )}
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar um arquivo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .xlsx ou .json (max 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{result.imported} importado(s)</span>
                </div>
                {result.errors.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span>{result.errors.length} erro(s)</span>
                  </div>
                )}
                <span className="text-muted-foreground">de {result.total} linha(s)</span>
              </div>

              {/* Errors list */}
              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                  {result.errors.slice(0, 50).map((err, i) => (
                    <div key={i} className="text-xs flex gap-2">
                      <span className="text-muted-foreground shrink-0">Linha {err.row}</span>
                      <span className="font-medium shrink-0">{err.field}:</span>
                      <span className="text-destructive">{err.message}</span>
                    </div>
                  ))}
                  {result.errors.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      ... e mais {result.errors.length - 50} erro(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
