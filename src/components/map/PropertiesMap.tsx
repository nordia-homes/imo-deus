'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, Layers3, MapPinned, Minus, Navigation, Plus, Route, TriangleAlert, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property } from '@/lib/types';
import { useGoogleMapsApi } from './useGoogleMapsApi';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type GoogleMapsWindow = Window & {
  google?: { maps?: any };
};

const MAP_STYLES = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#10233b' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#dbe7f3' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#10233b' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a5777' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ec7bf' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1f3f62' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2f547c' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2c6d79' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#5ab8a8' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#29496b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#091624' }],
  },
];

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Pret indisponibil';
  }

  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value?: string) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPropertyPath(propertyId: string) {
  return `/properties/${propertyId}`;
}

function getPrimaryImage(property: Property) {
  return property.images?.[0]?.url || 'https://placehold.co/1200x800';
}

export function PropertiesMap({
  properties,
  zoomMode = 'default',
  layoutMode = 'split',
}: {
  properties: Property[];
  zoomMode?: 'default' | 'close';
  layoutMode?: 'split' | 'map-only';
}) {
  const { isLoaded, error } = useGoogleMapsApi();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const panoramaRef = useRef<any>(null);

  const validProperties = useMemo(
    () => properties.filter((property) => property.latitude != null && property.longitude != null),
    [properties]
  );

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    layoutMode === 'map-only' ? null : validProperties[0]?.id ?? null
  );
  const [streetViewStatus, setStreetViewStatus] = useState<'idle' | 'ready' | 'unavailable'>('idle');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [streetViewVisible, setStreetViewVisible] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(layoutMode !== 'map-only');
  const [streetViewHostReady, setStreetViewHostReady] = useState(false);
  const [streetViewElement, setStreetViewElement] = useState<HTMLDivElement | null>(null);
  const [isPropertyPickerOpen, setIsPropertyPickerOpen] = useState(false);

  useEffect(() => {
    if (!validProperties.length) {
      setSelectedPropertyId(null);
      return;
    }

    if (layoutMode === 'map-only') {
      return;
    }

    setSelectedPropertyId((current) => {
      if (current && validProperties.some((property) => property.id === current)) {
        return current;
      }

      return validProperties[0]?.id ?? null;
    });
  }, [layoutMode, validProperties]);

  useEffect(() => {
    if (layoutMode !== 'map-only') {
      return;
    }

    setSelectedPropertyId((current) =>
      current && validProperties.some((property) => property.id === current) ? current : null
    );
  }, [layoutMode, validProperties]);

  const selectedProperty =
    validProperties.find((property) => property.id === selectedPropertyId) ||
    (layoutMode === 'map-only' ? null : validProperties[0] || null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !validProperties.length) {
      return;
    }

    const googleMaps = (window as GoogleMapsWindow).google?.maps;
    if (!googleMaps) {
      return;
    }

    const defaultCenter = {
      lat: selectedProperty?.latitude ?? 44.4268,
      lng: selectedProperty?.longitude ?? 26.1025,
    };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: zoomMode === 'close' ? 16 : 12,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        styles: MAP_STYLES,
        mapTypeId: mapType,
      });
    }

    if (!infoWindowRef.current) {
      infoWindowRef.current = new googleMaps.InfoWindow();
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new googleMaps.LatLngBounds();

    validProperties.forEach((property) => {
      const position = {
        lat: property.latitude as number,
        lng: property.longitude as number,
      };

      const marker = new googleMaps.Marker({
        map: mapInstanceRef.current,
        position,
        title: property.title,
        animation: selectedProperty?.id === property.id ? googleMaps.Animation.DROP : undefined,
      });
      marker.__propertyId = property.id;

      marker.addListener('click', () => {
        setSelectedPropertyId(property.id);
        if (layoutMode === 'map-only') {
          setIsDetailsOpen(true);
        }
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (validProperties.length === 1 && selectedProperty) {
      mapInstanceRef.current.setCenter({
        lat: selectedProperty.latitude as number,
        lng: selectedProperty.longitude as number,
      });
      mapInstanceRef.current.setZoom(zoomMode === 'close' ? 17 : 15);
    } else {
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [isLoaded, layoutMode, mapType, selectedProperty, validProperties, zoomMode]);

  useEffect(() => {
    if (!isLoaded || !streetViewElement || !selectedProperty) {
      return;
    }

    const googleMaps = (window as GoogleMapsWindow).google?.maps;
    if (!googleMaps) {
      return;
    }

    const panorama = new googleMaps.StreetViewPanorama(streetViewElement, {
      position: {
        lat: selectedProperty.latitude ?? 44.4268,
        lng: selectedProperty.longitude ?? 26.1025,
      },
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      motionTracking: false,
      addressControl: false,
      linksControl: false,
      fullscreenControl: false,
      disableDefaultUI: true,
    });

    panoramaRef.current = panorama;
    setStreetViewHostReady(true);

    const resizeTimer = window.setTimeout(() => {
      googleMaps.event.trigger(panorama, 'resize');
      panorama.setPosition({
        lat: selectedProperty.latitude as number,
        lng: selectedProperty.longitude as number,
      });
    }, 120);

    return () => {
      window.clearTimeout(resizeTimer);
      panoramaRef.current = null;
      setStreetViewHostReady(false);
    };
  }, [isLoaded, selectedProperty, streetViewElement]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.setMapTypeId(mapType);
    if (mapType === 'roadmap') {
      mapInstanceRef.current.setOptions({ styles: MAP_STYLES });
    } else {
      mapInstanceRef.current.setOptions({ styles: undefined });
    }
  }, [mapType]);

  useEffect(() => {
    if (
      !isLoaded ||
      !selectedProperty ||
      !mapInstanceRef.current ||
      !infoWindowRef.current ||
      !panoramaRef.current ||
      !streetViewHostReady ||
      (layoutMode === 'map-only' && !isDetailsOpen)
    ) {
      return;
    }

    const googleMaps = (window as GoogleMapsWindow).google?.maps;
    if (!googleMaps) {
      return;
    }

    const position = {
      lat: selectedProperty.latitude as number,
      lng: selectedProperty.longitude as number,
    };

    const selectedMarker = markersRef.current.find((marker) => marker.__propertyId === selectedProperty.id);
    if (layoutMode !== 'map-only') {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`;
      const infoContent = `
        <div style="max-width:220px;padding:4px 2px;color:#0f172a;">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(selectedProperty.title)}</div>
          <div style="font-size:12px;line-height:1.4;margin-bottom:6px;">${escapeHtml(selectedProperty.address || selectedProperty.location || '')}</div>
          <div style="font-size:12px;font-weight:600;">${formatCurrency(selectedProperty.price)}</div>
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:#0f766e;font-size:12px;text-decoration:none;">
            Deschide in Google Maps
          </a>
        </div>
      `;

      infoWindowRef.current.setContent(infoContent);
      if (selectedMarker) {
        infoWindowRef.current.open({
          map: mapInstanceRef.current,
          anchor: selectedMarker,
        });
      }
    } else if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    mapInstanceRef.current.panTo(position);
    if (validProperties.length === 1) {
      mapInstanceRef.current.setZoom(zoomMode === 'close' ? 17 : 15);
    }

    const streetViewService = new googleMaps.StreetViewService();
    setStreetViewStatus('idle');
    streetViewService.getPanorama({ location: position, radius: 120 }, (result: any, status: string) => {
      if (status === 'OK' && result?.location?.pano) {
        panoramaRef.current.setPano(result.location.pano);
        panoramaRef.current.setPov({ heading: 0, pitch: 0 });
        panoramaRef.current.setZoom(1);
        panoramaRef.current.setPosition(position);
        googleMaps.event.trigger(panoramaRef.current, 'resize');
        panoramaRef.current.setVisible(streetViewVisible);
        setStreetViewStatus('ready');
        return;
      }

      panoramaRef.current.setVisible(false);
      setStreetViewStatus('unavailable');
    });
  }, [isDetailsOpen, isLoaded, layoutMode, selectedProperty, streetViewHostReady, streetViewVisible, validProperties.length, zoomMode]);

  useEffect(() => {
    if (!panoramaRef.current) {
      return;
    }

    panoramaRef.current.setVisible(streetViewVisible && streetViewStatus === 'ready');
  }, [streetViewStatus, streetViewVisible]);

  function handleZoomIn() {
    if (!mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom?.() ?? 12) + 1);
  }

  function handleZoomOut() {
    if (!mapInstanceRef.current) {
      return;
    }

    mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom?.() ?? 12) - 1);
  }

  function focusProperty(property: Property) {
    if (!mapInstanceRef.current) {
      return;
    }

    const position = {
      lat: property.latitude as number,
      lng: property.longitude as number,
    };

    setSelectedPropertyId(property.id);
    mapInstanceRef.current.panTo(position);
    mapInstanceRef.current.setZoom(17);
  }

  const detailsPanel = selectedProperty ? (
    <div className="flex h-[min(91vh,1080px)] min-h-0 flex-col gap-3">
      <div className="overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(145deg,rgba(18,24,38,0.98),rgba(11,16,28,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="border-b border-white/6 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-200/90">
                <Camera className="h-3.5 w-3.5" />
                Exterior proprietate
              </div>
              <div>
                <p className="text-[1.28rem] font-semibold leading-tight tracking-[-0.03em] text-white">
                  {selectedProperty.title}
                </p>
                <p className="mt-1 max-w-[40ch] text-[13px] leading-relaxed text-white/55">
                  {selectedProperty.address || selectedProperty.location}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Locatie</p>
              <p className="mt-1 text-xs font-medium text-white/75">
                {selectedProperty.zone || selectedProperty.city || 'Romania'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-white/72">
          <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 font-medium text-white">
            {formatCurrency(selectedProperty.price)}
          </div>
          <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">{selectedProperty.rooms ?? '-'} camere</div>
          <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">{selectedProperty.squareFootage ?? '-'} mp</div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <Button asChild size="sm" className="h-9 rounded-full bg-emerald-500 px-4 text-white hover:bg-emerald-400">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedProperty.latitude},${selectedProperty.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Route className="mr-2 h-4 w-4" />
              Traseu
            </a>
          </Button>
          <Button asChild size="sm" variant="secondary" className="h-9 rounded-full border border-white/10 bg-white/[0.06] px-4 text-white hover:bg-white/[0.12]">
            <Link href={buildPropertyPath(selectedProperty.id)}>Detalii</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 rounded-full border border-white/10 bg-white/[0.06] px-4 text-white hover:bg-white/[0.12]"
            onClick={() => setStreetViewVisible((current) => !current)}
            disabled={streetViewStatus === 'unavailable'}
          >
            <Camera className="mr-2 h-4 w-4" />
            {streetViewVisible ? 'Ascunde exteriorul' : 'Arata exteriorul'}
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div ref={setStreetViewElement} className="h-full min-h-[560px] w-full" />
        {streetViewStatus === 'ready' && !streetViewVisible ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="font-semibold text-white">Exteriorul este ascuns momentan.</p>
              <p className="text-sm text-white/70">
                Foloseste butonul din card pentru a reda din nou panorama Street View.
              </p>
            </div>
          </div>
        ) : null}
        {streetViewStatus === 'unavailable' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 p-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="font-semibold text-white">Street View nu este disponibil pentru aceasta locatie.</p>
              <p className="text-sm text-white/70">
                Proprietatea ramane vizibila pe harta, dar Google nu are imagini stradale suficient de aproape.
              </p>
            </div>
          </div>
        ) : null}
        {isLoaded && !streetViewHostReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-6 text-center text-sm text-white/70">
            Se pregateste panorama Street View...
          </div>
        ) : null}
        {!isLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-6 text-center text-sm text-white/70">
            Se incarca Google Maps si Street View...
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  if (!validProperties.length) {
    return (
      <Card className="h-full rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardContent className="flex h-full min-h-[320px] items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-3">
            <MapPinned className="mx-auto h-10 w-10 text-emerald-300" />
            <p className="text-lg font-semibold">Nu exista coordonate disponibile pentru proprietatile afisate.</p>
            <p className="text-sm text-white/70">
              Completeaza adresa si geocodarea proprietatii pentru a vedea harta si Street View.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
        <CardContent className="flex h-full min-h-[320px] items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-3">
            <TriangleAlert className="mx-auto h-10 w-10 text-amber-300" />
            <p className="text-lg font-semibold">Google Maps nu a putut fi incarcat.</p>
            <p className="text-sm text-white/70">{error}</p>
            <p className="text-xs text-white/50">
              Recomandat: foloseste o cheie separata pentru browser si restrictioneaz-o pe referrer + Maps JavaScript API + Street View.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (layoutMode === 'map-only') {
    return (
      <>
        <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[#10233b] shadow-2xl">
          <div ref={mapRef} className="h-full min-h-[560px] w-full" />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <Popover open={isPropertyPickerOpen} onOpenChange={setIsPropertyPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0f2239]/85 px-3 py-2 text-xs font-medium text-white shadow-xl backdrop-blur transition-colors hover:bg-[#16314f]"
                >
                  <MapPinned className="h-4 w-4 text-emerald-300" />
                  {selectedProperty ? selectedProperty.title : `${validProperties.length} proprietati pe harta`}
                  <ChevronDown className="h-4 w-4 text-white/70" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[340px] rounded-2xl border border-white/10 bg-[#152A47] p-2 text-white shadow-2xl">
                <div className="px-2 pb-2 pt-1 text-xs font-medium text-white/60">
                  Selecteaza proprietatea pe care vrei sa o vezi pe harta
                </div>
                <div className="max-h-[320px] space-y-1 overflow-y-auto">
                  {validProperties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => {
                        focusProperty(property);
                        setIsPropertyPickerOpen(false);
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        property.id === selectedProperty?.id
                          ? 'border-emerald-300/50 bg-emerald-400/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="truncate text-sm font-semibold">{property.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-white/60">{property.address || property.location}</div>
                      <div className="mt-2 text-xs font-medium text-emerald-200">{formatCurrency(property.price)}</div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f2239]/85 p-2 shadow-xl backdrop-blur">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl text-white hover:bg-white/10"
                onClick={handleZoomIn}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl text-white hover:bg-white/10"
                onClick={handleZoomOut}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f2239]/85 p-2 shadow-xl backdrop-blur">
              <Button
                type="button"
                size="sm"
                variant={mapType === 'roadmap' ? 'default' : 'ghost'}
                className={mapType === 'roadmap' ? 'rounded-xl bg-emerald-500 text-white hover:bg-emerald-400' : 'rounded-xl text-white hover:bg-white/10'}
                onClick={() => setMapType('roadmap')}
              >
                Harta
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mapType === 'satellite' ? 'default' : 'ghost'}
                className={mapType === 'satellite' ? 'rounded-xl bg-emerald-500 text-white hover:bg-emerald-400' : 'rounded-xl text-white hover:bg-white/10'}
                onClick={() => setMapType('satellite')}
              >
                <Layers3 className="mr-2 h-4 w-4" />
                Satelit
              </Button>
            </div>
          </div>
          {selectedProperty ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-4 lg:bottom-6 lg:justify-start">
              <div className="pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-[#152A47]/95 shadow-2xl backdrop-blur">
                <div className="relative h-48 w-full">
                  <Image
                    src={getPrimaryImage(selectedProperty)}
                    alt={selectedProperty.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#152A47]/55 via-[#152A47]/12 to-transparent" />
                  <button
                    type="button"
                    onClick={() => setSelectedPropertyId(null)}
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-white">{selectedProperty.title}</div>
                    <div className="text-sm text-white/65">{selectedProperty.address || selectedProperty.location}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-white/70">
                      <span>{formatCurrency(selectedProperty.price)}</span>
                      <span>{selectedProperty.rooms ?? '-'} camere</span>
                      <span>{selectedProperty.squareFootage ?? '-'} mp</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-500 text-white hover:bg-emerald-400"
                      onClick={() => setIsDetailsOpen(true)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Street View
                    </Button>
                    <Button asChild size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                      <Link href={buildPropertyPath(selectedProperty.id)}>Detalii</Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedProperty.latitude},${selectedProperty.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Route className="mr-2 h-4 w-4" />
                        Traseu
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Dialog open={isDetailsOpen && !!selectedProperty} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[94vw] rounded-[30px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(26,36,58,0.55),rgba(6,10,18,0.98)_58%)] p-3 text-white shadow-[0_40px_140px_rgba(0,0,0,0.58)] sm:w-[calc(100vw-3rem)] sm:max-w-[760px] sm:p-4 lg:left-auto lg:right-4 lg:top-1/2 lg:h-[min(95vh,1120px)] lg:w-[min(46vw,780px)] lg:max-w-[780px] lg:translate-x-0 lg:-translate-y-1/2 lg:p-4">
            <DialogTitle className="sr-only">Detalii proprietate si Street View</DialogTitle>
            <DialogDescription className="sr-only">
              Panou cu detalii rapide ale proprietatii selectate si Street View exterior.
            </DialogDescription>
            {detailsPanel}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Card className="h-full rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Harta interactiva Google Maps</CardTitle>
            <CardDescription className="text-white/70">
              Selecteaza un marker pentru detalii rapide si vedere Street View din exterior.
            </CardDescription>
          </div>
          {selectedProperty ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                <Link href={buildPropertyPath(selectedProperty.id)}>Deschide proprietatea</Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedProperty.latitude},${selectedProperty.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Google Maps
                </a>
              </Button>
            </div>
          ) : null}
        </div>
        {validProperties.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {validProperties.map((property) => {
              const isActive = property.id === selectedProperty?.id;
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(property.id)}
                  className={`min-w-[220px] rounded-xl border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'border-emerald-300/60 bg-emerald-400/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  <div className="truncate text-sm font-semibold">{property.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-white/60">{property.address || property.location}</div>
                  <div className="mt-2 text-xs font-medium text-emerald-200">{formatCurrency(property.price)}</div>
                </button>
              );
            })}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid h-full min-h-[480px] gap-4 pb-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#10233b]">
          <div ref={mapRef} className="h-[360px] w-full lg:h-full" />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0f2239]/85 px-3 py-2 text-xs font-medium text-white shadow-xl backdrop-blur">
              <MapPinned className="h-4 w-4 text-emerald-300" />
              {validProperties.length} proprietati pe harta
            </div>
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f2239]/85 p-2 shadow-xl backdrop-blur">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl text-white hover:bg-white/10"
                onClick={handleZoomIn}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-xl text-white hover:bg-white/10"
                onClick={handleZoomOut}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f2239]/85 p-2 shadow-xl backdrop-blur">
              <Button
                type="button"
                size="sm"
                variant={mapType === 'roadmap' ? 'default' : 'ghost'}
                className={mapType === 'roadmap' ? 'rounded-xl bg-emerald-500 text-white hover:bg-emerald-400' : 'rounded-xl text-white hover:bg-white/10'}
                onClick={() => setMapType('roadmap')}
              >
                Harta
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mapType === 'satellite' ? 'default' : 'ghost'}
                className={mapType === 'satellite' ? 'rounded-xl bg-emerald-500 text-white hover:bg-emerald-400' : 'rounded-xl text-white hover:bg-white/10'}
                onClick={() => setMapType('satellite')}
              >
                <Layers3 className="mr-2 h-4 w-4" />
                Satelit
              </Button>
            </div>
          </div>
        </div>
        {detailsPanel}
      </CardContent>
    </Card>
  );
}
