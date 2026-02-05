'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, ChevronRight, ArrowUpRight } from 'lucide-react';
import { normalizeHrefOptional } from '@/lib/normalize-href';

export interface LinkItem {
  label: string;
  href?: string;
  description?: string;
  icon?: string;
  target?: '_self' | '_blank';
}

export interface LinkListProps {
  title?: string;
  links: LinkItem[];
  variant?: 'default' | 'card' | 'minimal';
  showArrows?: boolean;
  columns?: 1 | 2 | 3;
}

export function LinkList({
  title,
  links,
  variant = 'default',
  showArrows = true,
  columns = 1,
}: LinkListProps) {
  const safeLinks = Array.isArray(links) ? links : [];

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  if (safeLinks.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">🔗 Configure os links</p>
      </div>
    );
  }

  const LinkWrapper = ({ link, children }: { link: LinkItem; children: React.ReactNode }) => {
    if (link.href) {
      const finalHref = normalizeHrefOptional(link.href);
      return (
        <a
          href={finalHref}
          target={link.target || '_self'}
          rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
          className="block"
        >
          {children}
        </a>
      );
    }
    return <div>{children}</div>;
  };

  if (variant === 'card') {
    return (
      <div>
        {title && <h3 className="font-semibold mb-3">{title}</h3>}
        <div className={cn('grid gap-3', gridCols[columns])}>
          {safeLinks.map((link, idx) => (
            <LinkWrapper key={idx} link={link}>
              <div className="border rounded-lg p-4 hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {link.icon && <span>{link.icon}</span>}
                      <span className="font-medium group-hover:text-primary transition-colors">
                        {link.label}
                      </span>
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {link.description}
                      </p>
                    )}
                  </div>
                  {showArrows && (
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
              </div>
            </LinkWrapper>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div>
        {title && <h3 className="font-semibold mb-3">{title}</h3>}
        <div className={cn('grid gap-2', gridCols[columns])}>
          {safeLinks.map((link, idx) => (
            <LinkWrapper key={idx} link={link}>
              <div className="flex items-center gap-2 py-1 text-primary hover:underline cursor-pointer">
                {link.icon && <span>{link.icon}</span>}
                <span>{link.label}</span>
                {link.target === '_blank' && (
                  <ExternalLink className="h-3 w-3" />
                )}
              </div>
            </LinkWrapper>
          ))}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div>
      {title && <h3 className="font-semibold mb-3">{title}</h3>}
      <div className="divide-y border rounded-lg overflow-hidden">
        {safeLinks.map((link, idx) => (
          <LinkWrapper key={idx} link={link}>
            <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-2">
                {link.icon && <span>{link.icon}</span>}
                <div>
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {link.label}
                  </span>
                  {link.description && (
                    <p className="text-xs text-muted-foreground">
                      {link.description}
                    </p>
                  )}
                </div>
              </div>
              {showArrows && (
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>
          </LinkWrapper>
        ))}
      </div>
    </div>
  );
}

export function LinkListPreview({ variant }: LinkListProps) {
  return (
    <div className="border rounded-lg p-3 bg-background">
      {variant === 'card' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="border rounded p-2 text-xs">
            <span className="font-medium">Link 1</span>
          </div>
          <div className="border rounded p-2 text-xs">
            <span className="font-medium">Link 2</span>
          </div>
        </div>
      ) : variant === 'minimal' ? (
        <div className="space-y-1 text-xs text-primary">
          <div>🔗 Link 1</div>
          <div>🔗 Link 2</div>
        </div>
      ) : (
        <div className="divide-y text-xs">
          <div className="flex justify-between py-1">
            <span>Link 1</span>
            <ChevronRight className="h-3 w-3" />
          </div>
          <div className="flex justify-between py-1">
            <span>Link 2</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  );
}
