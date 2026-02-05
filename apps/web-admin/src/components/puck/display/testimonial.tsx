'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Quote } from 'lucide-react';

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: string;
  rating?: number;
}

export interface TestimonialProps {
  testimonials: TestimonialItem[];
  variant?: 'default' | 'card' | 'minimal' | 'featured';
  columns?: 1 | 2 | 3;
  showRating?: boolean;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={cn(
            'h-4 w-4',
            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'
          )}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonial({
  testimonials,
  variant = 'default',
  columns = 1,
  showRating = true,
}: TestimonialProps) {
  const safeTestimonials = Array.isArray(testimonials) ? testimonials : [];

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  if (safeTestimonials.length === 0) {
    return (
      <div className="border rounded-lg p-8 bg-muted/50 text-center">
        <p className="text-muted-foreground">💬 Configure os depoimentos</p>
      </div>
    );
  }

  if (variant === 'featured' && safeTestimonials.length > 0) {
    const featured = safeTestimonials[0];
    return (
      <div className="bg-primary text-primary-foreground rounded-xl p-8 md:p-12 text-center">
        <Quote className="h-10 w-10 mx-auto mb-6 opacity-30" />
        <blockquote className="text-xl md:text-2xl font-medium mb-6 max-w-3xl mx-auto">
          "{featured.quote}"
        </blockquote>
        {showRating && featured.rating && (
          <div className="flex justify-center mb-4">
            <StarRating rating={featured.rating} />
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          {featured.avatar && (
            <div className="w-12 h-12 rounded-full bg-primary-foreground/20 overflow-hidden">
              <img src={featured.avatar} alt={featured.author} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="text-left">
            <p className="font-semibold">{featured.author}</p>
            {(featured.role || featured.company) && (
              <p className="text-sm opacity-80">
                {featured.role}{featured.role && featured.company && ' · '}{featured.company}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('grid gap-6', gridCols[columns])}>
        {safeTestimonials.map((t, idx) => (
          <div key={idx}>
            <p className="text-muted-foreground italic mb-3">"{t.quote}"</p>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{t.author}</span>
              {t.role && <span className="text-xs text-muted-foreground">— {t.role}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default and card variants
  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {safeTestimonials.map((t, idx) => (
        <div
          key={idx}
          className={cn(
            'p-6',
            variant === 'card' ? 'bg-muted/50 rounded-xl' : 'border rounded-lg'
          )}
        >
          <Quote className="h-6 w-6 text-muted-foreground/30 mb-3" />
          <p className="text-sm mb-4">"{t.quote}"</p>
          {showRating && t.rating && (
            <div className="mb-3">
              <StarRating rating={t.rating} />
            </div>
          )}
          <div className="flex items-center gap-3">
            {t.avatar ? (
              <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                <img src={t.avatar} alt={t.author} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {t.author.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-medium text-sm">{t.author}</p>
              {(t.role || t.company) && (
                <p className="text-xs text-muted-foreground">
                  {t.role}{t.role && t.company && ' · '}{t.company}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TestimonialPreview({ variant }: TestimonialProps) {
  return (
    <div className={cn(
      'border rounded-lg p-3 bg-background',
      variant === 'featured' && 'bg-primary text-primary-foreground'
    )}>
      <Quote className="h-4 w-4 text-muted-foreground/30 mb-1" />
      <p className="text-xs mb-2 italic">"Excelente produto..."</p>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">A</div>
        <span className="text-xs">Autor</span>
      </div>
    </div>
  );
}
