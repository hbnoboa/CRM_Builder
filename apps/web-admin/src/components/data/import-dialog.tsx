'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  FileJson,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Link2,
  Link2Off,
} from 'lucide-react';
import { toast } from 'sonner';
import { dataService } from '@/services/data.service';
import { cn } from '@/lib/utils';

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface EntityField {
  slug: string;
  name: string;
  type: string;
  required: boolean;
}

interface ImportPreview {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  entityFields: EntityField[];
  suggestedMapping: Record<string, string>;
}

interface ImportDialogProps {
  entitySlug: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'result';

export function ImportDialog({
  entitySlug,
  entityName,
  open,
  onOpenChange,
  onSuccess,
}: ImportDialogProps) {
  const t = useTranslations('data.importDialog');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    imported: number;
    errors: ImportError[];
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFieldTypeLabel = (type: string): string => {
    try {
      return t(`fieldTypes.${type}`);
    } catch {
      return type;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.toLowerCase();
      if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.json')) {
        toast.error(t('unsupportedFormat'));
        return;
      }
      setFile(selected);
      setPreview(null);
      setColumnMapping({});
      setResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const previewData = await dataService.previewImport(entitySlug, file);
      setPreview(previewData);
      setColumnMapping(previewData.suggestedMapping);
      setStep('mapping');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('processError');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const res = await dataService.importData(entitySlug, file, columnMapping);
      setResult(res);
      setStep('result');

      if (res.imported > 0) {
        toast.success(t('importSuccess', { count: res.imported }));
        onSuccess();
      }

      if (res.errors.length > 0 && res.imported === 0) {
        toast.error(t('noRecordsImported'));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('importError');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!loading) {
      setFile(null);
      setPreview(null);
      setColumnMapping({});
      setResult(null);
      setStep('upload');
      onOpenChange(open);
    }
  };

  const handleBack = () => {
    if (step === 'mapping') {
      setStep('upload');
    }
  };

  const updateMapping = (header: string, fieldSlug: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: fieldSlug,
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMappedCount = () => {
    return Object.values(columnMapping).filter(Boolean).length;
  };

  const getRequiredFieldsMissing = () => {
    if (!preview) return [];
    const mappedSlugs = new Set(Object.values(columnMapping).filter(Boolean));
    return preview.entityFields.filter((f) => f.required && !mappedSlugs.has(f.slug));
  };

  const isExcel =
    file?.name.toLowerCase().endsWith('.xlsx') || file?.name.toLowerCase().endsWith('.xls');

  const requiredMissing = getRequiredFieldsMissing();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn('sm:max-w-2xl', step === 'mapping' && 'sm:max-w-4xl')}>
        <DialogHeader>
          <DialogTitle>
            {t('title', { entity: entityName })}
            {step === 'mapping' && (
              <Badge variant="outline" className="ml-2 font-normal">
                {t('stepMapping')}
              </Badge>
            )}
            {step === 'result' && (
              <Badge variant="outline" className="ml-2 font-normal">
                {t('stepResult')}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && t('descUpload')}
            {step === 'mapping' && t('descMapping')}
            {step === 'result' && t('descResult')}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
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
                  <p className="text-sm text-muted-foreground">{t('clickToSelect')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('maxSize')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && preview && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span>{t('linesInFile', { count: preview.totalRows })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  {t('columnsMapped', { mapped: getMappedCount(), total: preview.headers.length })}
                </span>
              </div>
            </div>

            {/* Required fields warning */}
            {requiredMissing.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">{t('requiredNotMapped')}</p>
                  <p className="text-muted-foreground">
                    {requiredMissing.map((f) => f.name).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Mapping table */}
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">{t('fileColumn')}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[250px]">{t('entityField')}</TableHead>
                    <TableHead>{t('sample')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.headers.map((header) => {
                    const mappedSlug = columnMapping[header];
                    const sampleValue = preview.sampleRows[0]?.[header];

                    return (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          {mappedSlug ? (
                            <Link2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Link2Off className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mappedSlug || '_none'}
                            onValueChange={(value) =>
                              updateMapping(header, value === '_none' ? '' : value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t('selectField')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">
                                <span className="text-muted-foreground">{t('ignore')}</span>
                              </SelectItem>
                              {preview.entityFields.map((field) => (
                                <SelectItem key={field.slug} value={field.slug}>
                                  <div className="flex items-center gap-2">
                                    <span>{field.name}</span>
                                    <Badge variant="outline" className="text-[10px] px-1">
                                      {getFieldTypeLabel(field.type)}
                                    </Badge>
                                    {field.required && (
                                      <span className="text-destructive">*</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                          {sampleValue !== undefined && sampleValue !== null
                            ? String(sampleValue)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Preview table */}
            <div>
              <p className="text-sm font-medium mb-2">{t('previewTitle')}</p>
              <ScrollArea className="h-[150px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((header) => (
                        <TableHead key={header} className="text-xs whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sampleRows.map((row, i) => (
                      <TableRow key={i}>
                        {preview.headers.map((header) => (
                          <TableCell key={header} className="text-xs max-w-[150px] truncate">
                            {row[header] !== undefined && row[header] !== null
                              ? String(row[header])
                              : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{t('imported', { count: result.imported })}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>{t('errors', { count: result.errors.length })}</span>
                </div>
              )}
              <span className="text-muted-foreground">{t('ofLines', { count: result.total })}</span>
            </div>

            {/* Errors list */}
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {result.errors.slice(0, 50).map((err, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <span className="text-muted-foreground shrink-0">{t('lineNum', { row: err.row })}</span>
                    <span className="font-medium shrink-0">{err.field}:</span>
                    <span className="text-destructive">{err.message}</span>
                  </div>
                ))}
                {result.errors.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    {t('moreErrors', { count: result.errors.length - 50 })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                {t('cancel')}
              </Button>
              <Button onClick={handlePreview} disabled={!file || loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('processing')}
                  </>
                ) : (
                  <>
                    {t('continue')}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('back')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || getMappedCount() === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('importing')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('importCount', { count: preview?.totalRows || 0 })}
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button onClick={() => handleClose(false)}>{t('close')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
