'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export function Avatar({ src, alt, fallback, size = 'md', status }: AvatarProps) {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500',
  };

  const statusSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative inline-flex">
      <div
        className={cn(
          'relative rounded-full bg-muted flex items-center justify-center overflow-hidden',
          sizes[size]
        )}
      >
        {src ? (
          <img src={src} alt={alt || 'Avatar'} className="h-full w-full object-cover" />
        ) : fallback ? (
          <span className="font-medium text-muted-foreground">{getInitials(fallback)}</span>
        ) : (
          <User className="h-1/2 w-1/2 text-muted-foreground" />
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
            statusColors[status],
            statusSizes[size]
          )}
        />
      )}
    </div>
  );
}

export interface AvatarGroupProps {
  avatars: { src?: string; alt?: string; fallback?: string }[];
  max?: number;
  size?: AvatarProps['size'];
}

export function AvatarGroup({ avatars, max = 4, size = 'md' }: AvatarGroupProps) {
  const safeAvatars = Array.isArray(avatars) ? avatars : [];
  const displayAvatars = safeAvatars.slice(0, max);
  const remaining = safeAvatars.length - max;

  const sizes = {
    xs: 'h-6 w-6 text-xs -ml-1.5',
    sm: 'h-8 w-8 text-sm -ml-2',
    md: 'h-10 w-10 text-base -ml-2.5',
    lg: 'h-12 w-12 text-lg -ml-3',
    xl: 'h-16 w-16 text-xl -ml-4',
  };

  return (
    <div className="flex items-center">
      {displayAvatars.map((avatar, idx) => (
        <div
          key={idx}
          className={cn(
            'relative rounded-full ring-2 ring-background',
            idx > 0 && sizes[size]
          )}
        >
          <Avatar
            src={avatar.src}
            alt={avatar.alt}
            fallback={avatar.fallback}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'relative rounded-full ring-2 ring-background bg-muted flex items-center justify-center',
            sizes[size]
          )}
        >
          <span className="text-muted-foreground font-medium">+{remaining}</span>
        </div>
      )}
    </div>
  );
}

export function AvatarPreview({ src, fallback, size }: AvatarProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/50 flex justify-center">
      <Avatar src={src} fallback={fallback || 'User'} size={size} />
    </div>
  );
}

export function AvatarGroupPreview({ avatars, max, size }: AvatarGroupProps) {
  const sampleAvatars = [
    { fallback: 'JS' },
    { fallback: 'MR' },
    { fallback: 'AB' },
    { fallback: 'CD' },
    { fallback: 'EF' },
  ];

  return (
    <div className="border rounded-lg p-4 bg-muted/50 flex justify-center">
      <AvatarGroup
        avatars={Array.isArray(avatars) && avatars.length > 0 ? avatars : sampleAvatars}
        max={max || 4}
        size={size}
      />
    </div>
  );
}
