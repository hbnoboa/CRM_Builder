'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Search, Loader2, Navigation, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface MapFieldValue {
  lat?: number;
  lng?: number;
  uf?: string;
  city?: string;
  address?: string;
  number?: string;
}

interface MapFieldProps {
  value?: MapFieldValue | null;
  onChange: (value: MapFieldValue) => void;
  mode?: 'latlng' | 'address' | 'both';
  defaultCenter?: [number, number];
  defaultZoom?: number;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
}

// ─── Nominatim API ──────────────────────────────────────────────────────────
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const NOMINATIM_HEADERS: Record<string, string> = {
  'Accept-Language': 'pt-BR,pt,en',
  'User-Agent': 'CRM-Builder/1.0',
};

interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  state?: string;
  state_district?: string;
  country?: string;
  postcode?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  place_id: number;
  address?: NominatimAddress;
}


interface NominatimReverseResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

interface ReverseGeocodeResult {
  formatted: string;
  raw: NominatimReverseResult;
  parts: {
    uf: string;
    city: string;
    address: string;
    number: string;
  };
}

/**
 * Formata o endereço no padrão: "Estado, Cidade, Endereço, Número"
 * Exemplo: "São Paulo, São Paulo, Av Paulista, 1000"
 */
function extractAddressParts(addr: NominatimAddress | undefined) {
  if (!addr) return { uf: '', city: '', address: '', number: '' };
  const uf = addr.state || '';
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || '';
  const address = addr.road || addr.neighbourhood || addr.suburb || '';
  const number = addr.house_number || '';
  return { uf, city, address, number };
}

function formatAddress(addr: NominatimAddress | undefined): string {
  const { uf, city, address, number } = extractAddressParts(addr);
  const parts = [uf, city, address, number].filter(Boolean);
  return parts.join(', ');
}

async function geocodeAddress(address: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '5',
    countrycodes: 'br',
    addressdetails: '1',
  });
  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: NOMINATIM_HEADERS,
  });
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'json',
    addressdetails: '1',
  });
  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
    headers: NOMINATIM_HEADERS,
  });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data: NominatimReverseResult = await res.json();
  const parts = extractAddressParts(data.address);
  const formatted = formatAddress(data.address);
  return { formatted: formatted || data.display_name || '', raw: data, parts };
}

// ─── Dynamic Leaflet Loader ─────────────────────────────────────────────────
function useDynamicLeaflet() {
  const [L, setL] = useState<typeof import('leaflet') | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import('leaflet');
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      if (!cancelled) setL(leaflet);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return L;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function MapField({
  value,
  onChange,
  mode = 'both',
  defaultCenter = [-15.7801, -47.9292],
  defaultZoom = 4,
  height = 300,
  placeholder,
  disabled = false,
}: MapFieldProps) {
  const t = useTranslations('map');
  const tCommon = useTranslations('common');
  const L = useDynamicLeaflet();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [addressSearch, setAddressSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLat = value?.lat;
  const currentLng = value?.lng;
  const currentAddress = value?.address || '';

  // Initialize map
  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: currentLat && currentLng ? [currentLat, currentLng] : defaultCenter,
      zoom: currentLat && currentLng ? 15 : defaultZoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (currentLat && currentLng) {
      const marker = L.marker([currentLat, currentLng], { draggable: !disabled }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        handleMapInteraction(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }

    if (!disabled) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        placeMarkerOnMap(lat, lng);
        handleMapInteraction(lat, lng);
      });
    }

    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  // Place/move marker
  const placeMarkerOnMap = useCallback(
    (lat: number, lng: number) => {
      if (!L || !mapInstanceRef.current) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { draggable: !disabled }).addTo(
          mapInstanceRef.current,
        );
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          handleMapInteraction(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }
      mapInstanceRef.current.setView([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 15));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [L, disabled],
  );

  // Handle map click or marker drag → auto reverse geocode
  const handleMapInteraction = useCallback(
    async (lat: number, lng: number) => {
      const rounded = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };

      if (mode === 'latlng') {
        onChange({ ...rounded });
        return;
      }

      // Imediatamente atualiza coords
      onChange({ ...rounded, ...value });
      setIsReverseGeocoding(true);
      try {
        const { formatted, parts } = await reverseGeocode(lat, lng);
        onChange({ ...rounded, ...parts, address: formatted });
        setAddressSearch(formatted);
      } catch {
        // Mantém coordenadas mesmo se geocoding falhar
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [mode, value, onChange],
  );

  // Search address
  const handleAddressSearch = useCallback(async () => {
    if (!addressSearch.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await geocodeAddress(addressSearch.trim());
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [addressSearch]);

  // Select a search result → format "Estado, Cidade, Endereco, Numero"
  const handleSelectResult = useCallback(
    (result: NominatimResult) => {
      const lat = Number(parseFloat(result.lat).toFixed(6));
      const lng = Number(parseFloat(result.lon).toFixed(6));
      const parts = extractAddressParts(result.address);
      const addr = formatAddress(result.address) || result.display_name;

      placeMarkerOnMap(lat, lng);
      onChange({ lat, lng, ...parts, address: addr });
      setAddressSearch(addr);
      setShowResults(false);
      setSearchResults([]);
    },
    [placeMarkerOnMap, onChange],
  );

  // Reverse geocode helper (for lat/lng manual input)
  const doReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (mode === 'latlng') return;
      setIsReverseGeocoding(true);
      try {
        const { formatted, parts } = await reverseGeocode(lat, lng);
        onChange({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), ...parts, address: formatted });
        setAddressSearch(formatted);
      } catch {
        // Ignore
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [mode, onChange],
  );

  // Handle manual lat change → auto reverse geocode after debounce
  const handleLatChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '' || val === '-') {
        onChange({ ...value, lat: undefined });
        return;
      }
      const lat = parseFloat(val);
      if (isNaN(lat)) return;

      const newValue = { ...value, lat };
      onChange(newValue);

      if (value?.lng != null) {
        placeMarkerOnMap(lat, value.lng);
        if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = setTimeout(() => {
          doReverseGeocode(lat, value.lng!);
        }, 800);
      }
    },
    [value, onChange, placeMarkerOnMap, doReverseGeocode],
  );

  const handleLngChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '' || val === '-') {
        onChange({ ...value, lng: undefined });
        return;
      }
      const lng = parseFloat(val);
      if (isNaN(lng)) return;

      const newValue = { ...value, lng };
      onChange(newValue);

      if (value?.lat != null) {
        placeMarkerOnMap(value.lat, lng);
        if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = setTimeout(() => {
          doReverseGeocode(value.lat!, lng);
        }, 800);
      }
    },
    [value, onChange, placeMarkerOnMap, doReverseGeocode],
  );

  // Go to coordinates
  const handleGoToCoords = useCallback(() => {
    if (currentLat && currentLng) {
      placeMarkerOnMap(currentLat, currentLng);
    }
  }, [currentLat, currentLng, placeMarkerOnMap]);

  // Reset
  const handleReset = useCallback(() => {
    onChange({ lat: undefined, lng: undefined, address: undefined });
    setAddressSearch('');
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(defaultCenter, defaultZoom);
    }
  }, [onChange, defaultCenter, defaultZoom]);

  return (
    <div className="space-y-3">
      {/* Address search (for 'address' and 'both' modes) */}
      {(mode === 'address' || mode === 'both') && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder={placeholder || t('searchAddress')}
                value={addressSearch}
                onChange={(e) => {
                  setAddressSearch(e.target.value);
                  setShowResults(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddressSearch();
                  }
                }}
                disabled={disabled}
                className="pr-10"
              />
              {isReverseGeocoding && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddressSearch}
              disabled={disabled || isSearching || !addressSearch.trim()}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="border rounded-md shadow-md bg-popover max-h-48 overflow-y-auto z-50 relative">
              {searchResults.map((result) => {
                const formatted = formatAddress(result.address);
                return (
                  <button
                    key={result.place_id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-0 flex items-start gap-2"
                    onClick={() => handleSelectResult(result)}
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="font-medium line-clamp-1">
                        {formatted || result.display_name}
                      </span>
                      {formatted && (
                        <span className="text-xs text-muted-foreground line-clamp-1 block">
                          {result.display_name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Formatted address display */}
          {currentAddress && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
              <MapPin className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="font-medium">{currentAddress}</span>
            </div>
          )}
        </div>
      )}

      {/* Lat/Lng inputs (for 'latlng' and 'both' modes) */}
      {(mode === 'latlng' || mode === 'both') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('latitude')}</Label>
            <Input
              type="number"
              step="any"
              placeholder="-15.7801"
              value={currentLat ?? ''}
              onChange={handleLatChange}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('longitude')}</Label>
            <Input
              type="number"
              step="any"
              placeholder="-47.9292"
              value={currentLng ?? ''}
              onChange={handleLngChange}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border">
        {!L && (
          <div
            className="flex items-center justify-center bg-muted"
            style={{ height: `${height}px` }}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{tCommon('loading')}</span>
            </div>
          </div>
        )}
        <div
          ref={mapRef}
          style={{ height: `${height}px`, display: L ? 'block' : 'none' }}
          className="z-0"
        />

        {/* Map controls */}
        {!disabled && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-[1000]">
            {currentLat && currentLng && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8 shadow-md"
                onClick={handleGoToCoords}
                title={t('goToCoordinates')}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 shadow-md"
              onClick={handleReset}
              title={t('clearMarker')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Current coordinates summary */}
      {(currentLat || currentLng) && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <p>
            📍 {currentLat?.toFixed(6)}, {currentLng?.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Map Config Component (for entity field settings) ───────────────────────
export function MapFieldConfig({
  mode,
  defaultCenter,
  defaultZoom,
  mapHeight,
  onChange,
}: {
  mode?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  mapHeight?: number;
  onChange: (key: string, value: unknown) => void;
}) {
  const t = useTranslations('map');

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      <Label className="text-sm font-medium">{t('config.title')}</Label>

      <div className="space-y-2">
        <Label className="text-xs">{t('config.inputMode')}</Label>
        <Select value={mode || 'both'} onValueChange={(val) => onChange('mapMode', val)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">{t('config.modeAddressLatLng')}</SelectItem>
            <SelectItem value="address">{t('config.modeAddress')}</SelectItem>
            <SelectItem value="latlng">{t('config.modeLatLng')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('config.defaultCenterLat')}</Label>
          <Input
            type="number"
            step="any"
            placeholder="-15.7801"
            value={defaultCenter?.[0] ?? ''}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat)) {
                onChange('mapDefaultCenter', [lat, defaultCenter?.[1] ?? -47.9292]);
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('config.defaultCenterLng')}</Label>
          <Input
            type="number"
            step="any"
            placeholder="-47.9292"
            value={defaultCenter?.[1] ?? ''}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              if (!isNaN(lng)) {
                onChange('mapDefaultCenter', [defaultCenter?.[0] ?? -15.7801, lng]);
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('config.defaultZoom')}</Label>
          <Input
            type="number"
            min={1}
            max={18}
            value={defaultZoom ?? 4}
            onChange={(e) => onChange('mapDefaultZoom', parseInt(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('config.mapHeight')}</Label>
          <Input
            type="number"
            min={150}
            max={600}
            value={mapHeight ?? 300}
            onChange={(e) => onChange('mapHeight', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
