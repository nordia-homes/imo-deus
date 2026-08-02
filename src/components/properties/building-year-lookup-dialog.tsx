"use client";

import { useEffect, useRef, useState } from 'react';
import { Building2, ExternalLink, Loader2, Search } from 'lucide-react';

import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type BuildingLookupDetail = { label: string; value: string };

type BuildingLookupResult = {
  id: number;
  name: string;
  address: string;
  constructionYear: string;
  exactMatch: boolean;
  details: BuildingLookupDetail[];
  sourceUrl: string;
};

type BuildingLookupPayload = {
  query?: string;
  results?: BuildingLookupResult[];
  disclaimer?: string;
  message?: string;
};

function isPrimaryDetail(label: string) {
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized === 'nume' || normalized === 'anul finalizarii';
}

export function BuildingYearLookupDialog({ initialAddress }: { initialAddress: string }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<BuildingLookupPayload | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setAddress(initialAddress);
    setHasSearched(false);
    setError('');
    setPayload(null);
  }, [initialAddress, open]);

  useEffect(() => () => activeRequestRef.current?.abort(), []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      setIsLoading(false);
    }
  };

  const handleLookup = async () => {
    const normalizedAddress = address.trim();
    if (normalizedAddress.length < 5) {
      setError('Introdu adresa completă, inclusiv strada și numărul.');
      setHasSearched(true);
      setPayload(null);
      return;
    }
    if (!user) {
      setError('Trebuie să fii autentificat pentru a verifica imobilul.');
      setHasSearched(true);
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setIsLoading(true);
    setHasSearched(true);
    setError('');
    setPayload(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/building-year-lookup', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: normalizedAddress }),
        cache: 'no-store',
        signal: controller.signal,
      });
      const responsePayload = await response.json().catch(() => ({})) as BuildingLookupPayload;
      if (!response.ok) {
        throw new Error(responsePayload.message || 'Nu am putut verifica imobilul momentan.');
      }
      setPayload(responsePayload);
    } catch (lookupError) {
      if (lookupError instanceof Error && lookupError.name === 'AbortError') return;
      setError(lookupError instanceof Error && lookupError.message
        ? lookupError.message
        : 'Nu am putut verifica imobilul momentan.');
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const results = payload?.results || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20 hover:text-emerald-50"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Verifica anul de constructie
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden border-white/10 bg-[#0F1E33] p-0 text-white">
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <Building2 className="h-5 w-5 text-emerald-300" />
            Verifică anul de construcție
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Scrie adresa completă. Detaliile publicate pentru imobil vor fi preluate din HartaBlocuri.ro.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-white/10 px-6 py-4">
          <label htmlFor="building-year-address" className="text-sm font-medium text-white/80">
            Adresa completă a imobilului
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="building-year-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!isLoading) void handleLookup();
                }
              }}
              placeholder="ex: Strada 11 Iunie nr. 75, București"
              autoComplete="street-address"
              className="h-11 flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/40"
              disabled={isLoading}
            />
            <Button
              type="button"
              onClick={() => void handleLookup()}
              disabled={isLoading || address.trim().length < 5}
              className="h-11 shrink-0"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {isLoading ? 'Se verifică...' : 'Verifică adresa'}
            </Button>
          </div>
          {isLoading ? (
            <p className="text-xs text-white/50">
              Prima verificare poate dura până la un minut, deoarece sursa încarcă harta completă.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {!isLoading && hasSearched && !error && results.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-50">
              Nu am găsit un imobil pentru această adresă. Verifică denumirea străzii și numărul, apoi încearcă din nou.
            </div>
          ) : null}

          {!isLoading && results.length > 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-emerald-200">
                  {results.length === 1 ? 'Imobil identificat' : `${results.length} imobile identificate`}
                </p>
                {payload?.query ? <p className="mt-1 text-xs text-white/45">Adresă căutată: {payload.query}</p> : null}
              </div>

              {results.map((result) => (
                <article key={result.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <div className="border-b border-white/10 bg-emerald-400/[0.08] px-4 py-4">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-white">
                        {result.name || 'Imobil identificat'}
                      </h3>
                      {result.address ? <p className="mt-1 break-words text-sm text-white/65">{result.address}</p> : null}
                    </div>
                    <div className="mt-4 w-full min-w-0 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-left">
                      <p className="text-[11px] uppercase tracking-[0.15em] text-emerald-200/70">An finalizare</p>
                      <p className="mt-1 whitespace-normal break-words text-base font-semibold leading-relaxed text-emerald-100 [overflow-wrap:anywhere]">
                        {result.constructionYear || 'Necunoscut'}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2">
                    {result.details.filter((detail) => !isPrimaryDetail(detail.label)).map((detail) => (
                      <div key={`${result.id}-${detail.label}`} className="text-sm">
                        <dt className="font-medium text-white/80">{detail.label}</dt>
                        <dd className="mt-0.5 break-words text-white/60">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex justify-end border-t border-white/10 px-4 py-3">
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200 hover:text-emerald-100"
                    >
                      Vezi imobilul în HartaBlocuri.ro
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              ))}

              <p className="text-xs leading-relaxed text-white/45">
                {payload?.disclaimer || 'Datele sunt orientative și trebuie confirmate din documentele oficiale ale imobilului.'}
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
