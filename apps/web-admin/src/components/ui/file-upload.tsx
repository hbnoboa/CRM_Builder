'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileIcon, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface UploadedFile {
  url: string;
  publicUrl: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  bucket: string;
  path: string;
}

interface FileUploadProps {
  onUpload: (file: UploadedFile) => void;
  onRemove?: (file: UploadedFile) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // em bytes
  folder?: string;
  value?: UploadedFile | UploadedFile[] | null;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onUpload,
  onRemove,
  accept = 'image/*,application/pdf',
  multiple = false,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  folder = 'uploads',
  value,
  className,
  disabled = false,
}: FileUploadProps) {
  const t = useTranslations('fileUpload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = value ? (Array.isArray(value) ? value : [value]) : [];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    try {
      const response = await api.post('/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percentCompleted);
        },
      });

      return response.data;
    } catch (err: any) {
      console.error('Upload error:', err);
      throw new Error(err.response?.data?.message || t('uploadError'));
    }
  };

  const processFiles = async (fileList: FileList | File[]) => {
    setError(null);
    const filesToUpload = Array.from(fileList);

    // Validate number of files
    if (!multiple && filesToUpload.length > 1) {
      setError(t('onlyOneFile'));
      return;
    }

    if (files.length + filesToUpload.length > maxFiles) {
      setError(t('maxFilesError', { count: maxFiles }));
      return;
    }

    // Validar tamanho
    for (const file of filesToUpload) {
      if (file.size > maxSize) {
        setError(t('fileTooLarge', { name: file.name, maxSize: formatFileSize(maxSize) }));
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (const file of filesToUpload) {
        const uploadedFile = await uploadFile(file);
        if (uploadedFile) {
          onUpload(uploadedFile);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles);
      }
    },
    [disabled, processFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = (file: UploadedFile) => {
    if (onRemove) {
      onRemove(file);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'pointer-events-none'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="space-y-4">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('uploading')}</p>
            <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              {t('dragOrClick')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {multiple ? t('upToFiles', { count: maxFiles }) + ' ' : ''}
              {t('maxSize', { size: formatFileSize(maxSize) })}
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Lista de Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={file.path || index}
              className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
            >
              {/* Preview */}
              {isImage(file.mimeType) ? (
                <div className="h-12 w-12 rounded overflow-hidden bg-background">
                  <img
                    src={file.publicUrl || file.url}
                    alt={file.originalName}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded bg-background flex items-center justify-center">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Remove Button */}
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(file)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simplified component for image fields
export function ImageUpload({
  value,
  onChange,
  onRemove,
  className,
  disabled,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const t = useTranslations('fileUpload');
  const handleUpload = (file: UploadedFile) => {
    onChange(file.publicUrl || file.url);
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    else onChange('');
  };

  // If already has image, show preview
  if (value) {
    return (
      <div className={cn('relative group', className)}>
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
              >
                <X className="h-4 w-4 mr-1" />
                {t('remove')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <FileUpload
      onUpload={handleUpload}
      accept="image/*"
      multiple={false}
      folder="images"
      className={className}
      disabled={disabled}
    />
  );
}
