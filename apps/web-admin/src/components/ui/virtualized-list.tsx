'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { Loader2 } from 'lucide-react';

// ============================================================================
// VIRTUALIZED LIST
// ============================================================================

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  containerClassName?: string;
  // Infinite scroll
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  loadMoreThreshold?: number;
  // Loading states
  isLoading?: boolean;
  loadingItemCount?: number;
  // Empty state
  emptyState?: React.ReactNode;
  // Gap between items
  gap?: number;
  // getItemKey for stable keys
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 72,
  overscan = 5,
  className,
  containerClassName,
  hasMore,
  isLoadingMore,
  onLoadMore,
  loadMoreThreshold = 5,
  isLoading,
  loadingItemCount = 10,
  emptyState,
  gap = 0,
  getItemKey,
}: VirtualizedListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Trigger load more quando proximo do fim
  React.useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    // Se o ultimo item visivel esta proximo do fim, carregar mais
    if (lastItem.index >= items.length - loadMoreThreshold) {
      onLoadMore();
    }
  }, [virtualItems, hasMore, isLoadingMore, onLoadMore, items.length, loadMoreThreshold]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: loadingItemCount }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={parentRef}
      className={cn('h-full overflow-auto', containerClassName)}
    >
      <div
        className={cn('relative w-full', className)}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Carregando mais...
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VIRTUALIZED TABLE
// ============================================================================

interface Column<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface VirtualizedTableProps<T> {
  items: T[];
  columns: Column<T>[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  // Infinite scroll
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  // Loading states
  isLoading?: boolean;
  loadingItemCount?: number;
  // Empty state
  emptyState?: React.ReactNode;
  // Row click
  onRowClick?: (item: T, index: number) => void;
  // getItemKey for stable keys
  getItemKey?: (item: T, index: number) => string | number;
  // Sticky header
  stickyHeader?: boolean;
}

export function VirtualizedTable<T extends Record<string, unknown>>({
  items,
  columns,
  estimateSize = 48,
  overscan = 10,
  className,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isLoading,
  loadingItemCount = 10,
  emptyState,
  onRowClick,
  getItemKey,
  stickyHeader = true,
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Trigger load more
  React.useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= items.length - 5) {
      onLoadMore();
    }
  }, [virtualItems, hasMore, isLoadingMore, onLoadMore, items.length]);

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full overflow-hidden rounded-lg border">
        <div className="bg-muted/50 p-3 border-b">
          <div className="flex gap-4">
            {columns.map((col) => (
              <Skeleton
                key={col.key}
                className="h-4"
                style={{ width: col.width || 100 }}
              />
            ))}
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: loadingItemCount }).map((_, i) => (
            <div key={i} className="p-3 flex gap-4">
              {columns.map((col) => (
                <Skeleton
                  key={col.key}
                  className="h-4"
                  style={{ width: col.width || 100 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('w-full overflow-hidden rounded-lg border', className)}>
      {/* Header */}
      <div
        className={cn(
          'bg-muted/50 border-b',
          stickyHeader && 'sticky top-0 z-10'
        )}
      >
        <div className="flex">
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                'px-4 py-3 text-left text-sm font-medium text-muted-foreground',
                col.className
              )}
              style={{
                width: col.width,
                minWidth: col.minWidth || col.width,
                flex: col.width ? 'none' : 1,
              }}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100% - 48px)', maxHeight: '600px' }}
      >
        <div
          className="relative"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  'absolute left-0 top-0 w-full flex border-b last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-muted/50 transition-colors'
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick?.(item, virtualRow.index)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={cn('px-4 py-3 text-sm', col.className)}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth || col.width,
                      flex: col.width ? 'none' : 1,
                    }}
                  >
                    {col.render
                      ? col.render(item, virtualRow.index)
                      : String(item[col.key] ?? '')}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-4 border-t">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Carregando mais...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INFINITE SCROLL CONTAINER
// ============================================================================

interface InfiniteScrollContainerProps {
  children: React.ReactNode;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  className?: string;
  loadingElement?: React.ReactNode;
}

export function InfiniteScrollContainer({
  children,
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 200,
  className,
  loadingElement,
}: InfiniteScrollContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isLoading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, onLoadMore, threshold]);

  return (
    <div ref={containerRef} className={cn('overflow-auto', className)}>
      {children}
      {isLoading && (
        loadingElement || (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )
      )}
    </div>
  );
}
