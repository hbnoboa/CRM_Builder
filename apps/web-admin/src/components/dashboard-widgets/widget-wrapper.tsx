'use client';

import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Settings, Trash2, Loader2, AlertCircle } from 'lucide-react';

interface WidgetWrapperProps {
  title?: string;
  isEditMode?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onConfigure?: () => void;
  onRemove?: () => void;
  children: ReactNode;
}

export function WidgetWrapper({
  title,
  isEditMode,
  isLoading,
  error,
  onConfigure,
  onRemove,
  children,
}: WidgetWrapperProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {(title || isEditMode) && (
        <CardHeader className="widget-drag-handle pb-2 pt-3 px-4 flex-row items-center justify-between space-y-0 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2 min-w-0">
            {isEditMode && (
              <div className="drag-handle">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {title && (
              <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
            )}
          </div>
          {isEditMode && (
            <div className="flex items-center gap-1 ml-2">
              {onConfigure && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onConfigure}>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              )}
              {onRemove && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </CardHeader>
      )}
      <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-xs text-center">{error}</span>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
