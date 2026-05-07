'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import type { BuyerLocationPreference } from '@/lib/types';
import { buildCanonicalLocationRefFromLocationLike } from '@/lib/location-catalog/shapes';

type ImobiliareLocationOption = {
  id: number;
  oldId?: number | null;
  title: string;
  depth?: number;
  county?: string;
  locality?: string;
  zone?: string;
  display: string;
  searchText: string;
};

type PickerChangePayload = {
  locationPreferencesV2: BuyerLocationPreference[];
  city: string | null;
  zones: string[];
};

type Props = {
  value?: BuyerLocationPreference[] | null;
  fallbackCity?: string | null;
  onChange: (payload: PickerChangePayload) => void;
};

const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function ImobiliareLocationPreferencePicker({ value, fallbackCity, onChange }: Props) {
  const { user } = useUser();
  const [locations, setLocations] = useState<ImobiliareLocationOption[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedLocations = useMemo(() => {
    return (value || [])
      .filter((item) => item.scope === 'location' && item.location)
      .map((item) => item.location!)
      .filter((location, index, all) => all.findIndex((entry) => entry.locationId === location.locationId) === index);
  }, [value]);

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/imobiliare/locations', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Nu am putut încărca locațiile imobiliare.ro.');
        }

        const payload = (await response.json()) as { data?: ImobiliareLocationOption[] };
        if (isMounted) {
          setLocations(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Nu am putut încărca locațiile imobiliare.ro.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLocations();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredLocations = useMemo(() => {
    const normalizedQuery = normalize(query);
    const selectedIds = new Set(selectedLocations.map((location) => location.locationId));
    const pool = normalizedQuery
      ? locations.filter((location) => normalize(location.searchText || location.display).includes(normalizedQuery))
      : locations;

    return pool.filter((location) => !selectedIds.has(location.id)).slice(0, normalizedQuery ? 30 : 12);
  }, [locations, query, selectedLocations]);

  const emitSelection = (nextOptions: ImobiliareLocationOption[]) => {
    const nextLocations = nextOptions
      .map((option) => buildCanonicalLocationRefFromLocationLike(option))
      .filter((location): location is NonNullable<ReturnType<typeof buildCanonicalLocationRefFromLocationLike>> => Boolean(location));
    const nextPreferences = nextLocations
      .map((location) => ({
        preference: 'preferred',
        scope: 'location',
        location,
        source: 'manual',
        sourceText: location.display,
        weight: 1,
      })) as BuyerLocationPreference[];

    const uniqueLocalities = Array.from(new Set(nextPreferences.map((item) => item.location?.locality).filter(Boolean)));
    const nextCity =
      uniqueLocalities.length === 1 ? uniqueLocalities[0]! : fallbackCity?.trim() ? fallbackCity.trim() : uniqueLocalities[0] || null;
    const nextZones = nextPreferences.map((item) => item.location?.zone || item.location?.locality || '').filter(Boolean);

    onChange({
      locationPreferencesV2: nextPreferences,
      city: nextCity,
      zones: nextZones,
    });
  };

  const handleAdd = (option: ImobiliareLocationOption) => {
    const nextOptions = [
      ...selectedLocations.map((selected) => ({
        id: selected.locationId,
        oldId: selected.oldId,
        depth: selected.depth,
        county: selected.county,
        locality: selected.locality,
        zone: selected.zone || undefined,
        display: selected.display,
        searchText: selected.searchText || selected.display,
        title: selected.zone || selected.locality,
      })),
      option,
    ];
    emitSelection(nextOptions);
    setQuery('');
  };

  const handleRemove = (locationId: number) => {
    const nextOptions = selectedLocations
      .filter((location) => location.locationId !== locationId)
      .map((location) => ({
        id: location.locationId,
        oldId: location.oldId,
        depth: location.depth,
        county: location.county,
        locality: location.locality,
        zone: location.zone || undefined,
        display: location.display,
        searchText: location.searchText || location.display,
        title: location.zone || location.locality,
      }));
    emitSelection(nextOptions);
  };

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Caută zonă exact cum există în imobiliare.ro"
      />
      {selectedLocations.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedLocations.map((location) => (
            <div
              key={location.locationId}
              className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1.5 text-xs"
            >
              <span>{location.display}</span>
              <button type="button" onClick={() => handleRemove(location.locationId)} aria-label={`Șterge ${location.display}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {isLoading ? <p className="text-xs text-muted-foreground">Se încarcă locațiile imobiliare.ro...</p> : null}
      {!isLoading && error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!isLoading && filteredLocations.length > 0 ? (
        <div className="max-h-60 overflow-y-auto rounded-xl border">
          {filteredLocations.map((location) => (
            <Button
              key={location.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start rounded-none px-3 py-3 text-left"
              onClick={() => handleAdd(location)}
            >
              <span className="block min-w-0">
                <span className="block truncate">{location.display}</span>
                <span className="block text-xs text-muted-foreground">
                  {location.zone || location.locality || location.county || location.title}
                </span>
              </span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
