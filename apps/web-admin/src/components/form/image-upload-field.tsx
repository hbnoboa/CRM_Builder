'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, FileIcon, Loader2, Camera, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface ImageUploadFieldProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  /** 'image' shows preview, 'file' shows file icon */
  mode?: 'image' | 'file';
  /** Allow multiple files */
  multiple?: boolean;
  /** Max number of files when multiple=true */
  maxFiles?: number;
  /** Accepted file types (e.g. "image/*", ".pdf,.doc") */
  accept?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Upload folder on server */
  folder?: string;
  /** Image source: 'camera' = only camera, 'gallery' = only gallery/URL, 'both' = all */
  imageSource?: 'camera' | 'gallery' | 'both';
  /** Display size for image previews in pixels */
  imageDisplaySize?: number;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

export default function ImageUploadField({
  value,
  onChange,
  mode = 'image',
  multiple = false,
  maxFiles = 10,
  accept,
  placeholder,
  disabled = false,
  folder = 'uploads',
  imageSource = 'both',
  imageDisplaySize,
}: ImageUploadFieldProps) {
  const t = useTranslations('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const showCamera = mode === 'image' && imageSource !== 'gallery';

  // Normalize value to array for internal handling
  const values: string[] = Array.isArray(value)
    ? value.filter(Boolean)
    : (typeof value === 'string' && value ? [value] : []);

  const defaultAccept = mode === 'image'
    ? 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'
    : 'image/*,video/mp4,video/quicktime,video/webm,video/mpeg,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    let fileArray = Array.from(files);

    // In image mode, reject non-image files before uploading
    if (mode === 'image') {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      const rejected = fileArray.filter(f => !allowedTypes.includes(f.type));
      if (rejected.length > 0) {
        toast.error(t('onlyImages'));
        fileArray = fileArray.filter(f => allowedTypes.includes(f.type));
        if (fileArray.length === 0) return;
      }
    }

    let toUpload: File[];
    if (multiple) {
      const remaining = maxFiles - values.length;
      if (remaining <= 0) {
        toast.error(t('maxFilesAllowed', { count: maxFiles }));
        return;
      }
      toUpload = fileArray.slice(0, remaining);
    } else {
      // Single mode: only upload 1 file (will replace existing)
      toUpload = fileArray.slice(0, 1);
    }

    const uploadPromises = toUpload.map(async (file) => {
      const uploadId = Math.random().toString(36).slice(2);
      setUploading(prev => [...prev, { id: uploadId, name: file.name, progress: 0 }]);

      try {
        const formData = new FormData();
        const endpoint = mode === 'image' ? '/upload/image' : '/upload/file';
        const fieldName = mode === 'image' ? 'image' : 'file';
        formData.append(fieldName, file);
        formData.append('folder', folder);

        const response = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const pct = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploading(prev =>
              prev.map(u => u.id === uploadId ? { ...u, progress: pct } : u)
            );
          },
        });

        setUploading(prev => prev.filter(u => u.id !== uploadId));
        return response.data.publicUrl || response.data.url;
      } catch (err) {
        setUploading(prev => prev.filter(u => u.id !== uploadId));
        console.error('Upload error:', err);
        toast.error(t('uploadError', { name: file.name }));
        return null;
      }
    });

    const urls = (await Promise.all(uploadPromises)).filter(Boolean) as string[];

    if (multiple) {
      // Multiple mode: always add to existing
      onChange([...values, ...urls]);
    } else {
      // Single mode: replace with the last uploaded file
      onChange(urls[urls.length - 1] || values[0] || '');
    }
  }, [values, multiple, maxFiles, mode, folder, onChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }, [handleFiles]);

  const handleRemove = useCallback((index: number) => {
    if (multiple) {
      const newValues = values.filter((_, i) => i !== index);
      onChange(newValues);
    } else {
      onChange('');
    }
  }, [values, multiple, onChange]);

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) return;
    const trimmed = urlInput.trim();

    // Validate URL protocol (only http/https allowed)
    try {
      const url = new URL(trimmed);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return;
      }
    } catch {
      return;
    }

    if (multiple) {
      onChange([...values, trimmed]);
    } else {
      onChange(trimmed);
    }
    setUrlInput('');
    setUrlMode(false);
  }, [urlInput, values, multiple, onChange]);

  const isImage = (url: string) => {
    // File mode: always show as file, never as image preview
    if (mode === 'file') return false;
    return true;
  };

  const isVideo = (url: string) => {
    if (mode === 'file') return false;
    return /\.(mp4|mov|webm|mpeg)(\?.*)?$/i.test(url);
  };

  // Show drop zone: always for single-file (to allow replace), or while under maxFiles for multiple
  const showDropZone = multiple ? values.length < maxFiles : true;

  return (
    <div className="space-y-2">
      {/* Existing files / previews */}
      {values.length > 0 && (
        <div className={cn(
          'gap-2',
          mode === 'image' ? 'flex flex-wrap' : 'flex flex-col'
        )}>
          {values.map((url, index) => (
            <div key={`${url}-${index}`} className="relative group">
              {isVideo(url) ? (
                <div className="relative aspect-video rounded-lg border overflow-hidden bg-muted">
                  <video
                    src={url}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-background/90 text-foreground rounded-full p-1 shadow-md hover:bg-background"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="bg-destructive text-destructive-foreground rounded-full p-1 shadow-md"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ) : isImage(url) ? (
                <div
                  className="relative rounded-lg border overflow-hidden bg-muted"
                  style={imageDisplaySize ? { width: imageDisplaySize, height: imageDisplaySize } : { aspectRatio: '1/1', width: '100%', maxWidth: 200 }}
                >
                  <img
                    src={url}
                    alt={`Arquivo ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '';
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      (e.currentTarget.parentElement as HTMLElement).classList.add('flex', 'items-center', 'justify-center');
                      const icon = document.createElement('div');
                      icon.innerHTML = '🖼️';
                      icon.className = 'text-3xl';
                      e.currentTarget.parentElement?.appendChild(icon);
                    }}
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-background/90 text-foreground rounded-full p-1 shadow-md hover:bg-background"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="bg-destructive text-destructive-foreground rounded-full p-1 shadow-md"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted">
                  <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm truncate flex-1 hover:underline hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {url.split('/').pop() || url}
                  </a>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="text-destructive hover:text-destructive/80 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploading indicators */}
      {uploading.length > 0 && (
        <div className="space-y-1">
          {uploading.map(u => (
            <div key={u.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="truncate flex-1">{u.name}</span>
              <span className="text-xs">{u.progress}%</span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden camera input */}
      {showCamera && (
        <input
          ref={cameraRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleFileInput}
          disabled={disabled}
        />
      )}

      {/* Drop zone */}
      {showDropZone && !disabled && (
        <>
          {urlMode ? (
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder={t('pasteUrl')}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                autoFocus
              />
              <Button type="button" size="sm" onClick={handleUrlSubmit}>{t('ok')}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setUrlMode(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : imageSource === 'camera' ? (
            /* Camera-only mode: just a button, no drag-drop */
            <div className="flex flex-col items-center gap-2 py-4">
              <Camera className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('takePhotoHint')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5 mr-1" />
                {t('takePhoto')}
              </Button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={accept || defaultAccept}
                multiple={multiple}
                onChange={handleFileInput}
                disabled={disabled}
              />
              <div className="flex flex-col items-center gap-1.5 py-2">
                {mode === 'image' ? (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                )}
                <p className="text-sm text-muted-foreground">
                  {placeholder || (mode === 'image'
                    ? t('dragImage')
                    : t('dragFile'))}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {showCamera && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        cameraRef.current?.click();
                      }}
                    >
                      <Camera className="h-3.5 w-3.5 mr-1" />
                      {t('takePhoto')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {t('chooseFile')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUrlMode(true);
                    }}
                  >
                    {t('pasteUrlButton')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
