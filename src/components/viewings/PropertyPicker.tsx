"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, MapPin, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type PropertyPickerOption = {
  id: string;
  title: string;
  address?: string;
  location?: string;
  zone?: string;
  city?: string;
  price?: number;
  images?: { url: string; alt: string }[];
};

function formatPrice(price?: number) {
  if (typeof price !== 'number' || Number.isNaN(price)) {
    return null;
  }

  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price);
}

export function PropertyPicker({
  value,
  onValueChange,
  properties,
  placeholder = 'Selecteaza proprietatea',
  className,
  tone = 'dark',
}: {
  value?: string;
  onValueChange: (value: string) => void;
  properties: PropertyPickerOption[];
  placeholder?: string;
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isMobile = useIsMobile();
  const isLight = tone === 'light';

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === value) || null,
    [properties, value]
  );

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return properties;
    }

    return properties.filter((property) => {
      const haystack = [
        property.title,
        property.address,
        property.location,
        property.zone,
        property.city,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [properties, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            isLight ? 'h-auto min-h-10 w-full justify-between border-input bg-background px-3 py-2 text-left text-foreground hover:bg-accent hover:text-accent-foreground'
              : 'h-auto min-h-10 w-full justify-between border-white/20 bg-white/10 px-3 py-2 text-left text-white hover:bg-white/15 hover:text-white',
            className
          )}
        >
          <div className="min-w-0 flex-1">
            {selectedProperty ? (
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("h-11 w-14 shrink-0 overflow-hidden rounded-lg border", isLight ? "border-border bg-muted" : "border-white/10 bg-white/5")}>
                  <img
                    src={selectedProperty.images?.[0]?.url || 'https://placehold.co/160x120?text=Imobil'}
                    alt={selectedProperty.images?.[0]?.alt || selectedProperty.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium", isLight ? "text-foreground" : "text-white")}>{selectedProperty.title}</p>
                  <p className={cn("truncate text-xs", isLight ? "text-muted-foreground" : "text-white/65")}>
                    {selectedProperty.address || selectedProperty.location || selectedProperty.zone || 'Fara adresa'}
                  </p>
                </div>
              </div>
            ) : (
              <span className={cn(isLight ? "text-muted-foreground" : "text-white/55")}>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          "border-white/10 bg-[#13243b] p-0 text-white shadow-2xl",
          isMobile
            ? "w-[calc(100vw-4rem)] max-w-[calc(100vw-4rem)] overflow-hidden rounded-2xl"
            : "w-[var(--radix-popover-trigger-width)] min-w-[320px]"
        )}
      >
        <div className="border-b border-white/10 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cauta dupa titlu, adresa, zona..."
              className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <div
          className={cn(
            "overflow-y-auto overscroll-contain p-2 touch-pan-y [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]",
            isMobile ? "max-h-[50vh]" : "max-h-[340px]"
          )}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {filteredProperties.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-white/60">
              Nu am gasit nicio proprietate.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProperties.map((property) => {
                const metaLine =
                  property.address ||
                  property.location ||
                  [property.zone, property.city].filter(Boolean).join(', ');
                const priceLabel = formatPrice(property.price);
                const isSelected = property.id === value;

                return (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => {
                      onValueChange(property.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border border-white/8 px-3 py-3 text-left transition-colors',
                      isSelected ? 'bg-white/10' : 'bg-white/[0.03] hover:bg-white/[0.07]'
                    )}
                  >
                    <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                      <img
                        src={property.images?.[0]?.url || 'https://placehold.co/160x120?text=Imobil'}
                        alt={property.images?.[0]?.alt || property.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{property.title}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-white/60">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{metaLine || 'Fara adresa'}</span>
                      </div>
                      {priceLabel ? (
                        <p className="mt-1 text-xs font-semibold text-emerald-200">{priceLabel}</p>
                      ) : null}
                    </div>
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 text-emerald-300',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
