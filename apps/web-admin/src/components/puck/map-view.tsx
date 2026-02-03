'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, ZoomIn, ZoomOut, Minus } from 'lucide-react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export interface MapViewProps {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  showControls?: boolean;
  variant?: 'default' | 'satellite' | 'terrain';
}

export function MapView({
  markers = [],
  center = { lat: -23.5505, lng: -46.6333 },
  zoom = 12,
  height = '400px',
  showControls = true,
  variant = 'default',
}: MapViewProps) {
  const safeMarkers = Array.isArray(markers) ? markers : [];

  // Placeholder SVG map - in production, integrate with Google Maps, Mapbox, or Leaflet
  return (
    <div
      className={cn(
        'relative border rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-slate-900',
        variant === 'satellite' && 'from-green-900 to-green-950',
        variant === 'terrain' && 'from-amber-100 to-green-200 dark:from-amber-950 dark:to-green-950'
      )}
      style={{ height }}
    >
      {/* Grid lines to simulate map */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Roads simulation */}
      <div className="absolute inset-0 opacity-30">
        <svg className="w-full h-full">
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="3" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeWidth="3" />
          <line x1="20%" y1="0" x2="80%" y2="100%" stroke="currentColor" strokeWidth="2" />
          <line x1="80%" y1="0" x2="20%" y2="100%" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {/* Markers */}
      {safeMarkers.length > 0 ? (
        safeMarkers.map((marker, idx) => {
          // Simple positioning based on index for demo
          const x = 20 + (idx % 4) * 20;
          const y = 20 + Math.floor(idx / 4) * 25;
          return (
            <div
              key={marker.id}
              className="absolute transform -translate-x-1/2 -translate-y-full group"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <MapPin
                className="h-8 w-8 drop-shadow-lg"
                style={{ color: marker.color || '#ef4444' }}
                fill={marker.color || '#ef4444'}
              />
              {marker.label && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-white dark:bg-slate-800 rounded shadow-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {marker.label}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <MapPin className="h-10 w-10 text-red-500 drop-shadow-lg" fill="#ef4444" />
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button className="p-2 bg-white dark:bg-slate-800 rounded shadow hover:bg-muted transition-colors">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button className="p-2 bg-white dark:bg-slate-800 rounded shadow hover:bg-muted transition-colors">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button className="p-2 bg-white dark:bg-slate-800 rounded shadow hover:bg-muted transition-colors">
            <Navigation className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Coordinates info */}
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-white/80 dark:bg-slate-800/80 rounded text-xs">
        {center.lat.toFixed(4)}, {center.lng.toFixed(4)} | Zoom: {zoom}
      </div>

      {/* Integration notice */}
      <div className="absolute bottom-3 right-3 px-2 py-1 bg-white/80 dark:bg-slate-800/80 rounded text-xs text-muted-foreground">
        Integre com Google Maps ou Mapbox
      </div>
    </div>
  );
}

export function MapViewPreview() {
  return (
    <div className="border rounded-lg bg-blue-100 dark:bg-blue-950 h-24 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="1" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <MapPin className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-full h-6 w-6 text-red-500" fill="#ef4444" />
    </div>
  );
}
