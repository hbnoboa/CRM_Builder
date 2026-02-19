'use client';

import { useTranslations } from 'next-intl';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  Save,
  Eye,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePdfEditorStore } from '@/stores/pdf-editor-store';
import { useTemporalStore } from 'zundo';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  onSave: () => void;
  onPreview: () => void;
  isSaving?: boolean;
  templateName?: string;
}

export function EditorToolbar({
  onSave,
  onPreview,
  isSaving = false,
  templateName = 'Template',
}: EditorToolbarProps) {
  const t = useTranslations('pdfTemplates.editor');
  const { zoom, showGrid, snapToGrid, setZoom, toggleGrid, toggleSnapToGrid } = usePdfEditorStore();

  // Access temporal store for undo/redo
  const { undo, redo, pastStates, futureStates } = useTemporalStore(
    usePdfEditorStore
  );

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const zoomIn = () => setZoom(zoom + 0.1);
  const zoomOut = () => setZoom(zoom - 0.1);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold truncate max-w-[200px]">{templateName}</h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => undo()}
                disabled={!canUndo}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('undo')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => redo()}
                disabled={!canRedo}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('redo')}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Zoom */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={zoomOut} disabled={zoom <= 0.25}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <span className="text-sm text-muted-foreground w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={zoomIn} disabled={zoom >= 2}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Grid */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGrid ? 'secondary' : 'ghost'}
                size="icon"
                onClick={toggleGrid}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('grid')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapToGrid ? 'secondary' : 'ghost'}
                size="icon"
                onClick={toggleSnapToGrid}
              >
                <Magnet className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('snapToGrid')}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-2" />
            {t('preview')}
          </Button>

          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
