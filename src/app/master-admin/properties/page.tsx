'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Home, MapPin, Search } from 'lucide-react';
import { useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type PropertyItem = {
  id: string;
  title: string;
  agencyName: string;
  agentName: string;
  status: string;
  price: number;
  city: string;
  location: string;
};

function formatCurrency(value: number) {
  return `€${Math.round(value || 0).toLocaleString('ro-RO')}`;
}

export default function MasterAdminPropertiesPage() {
  const { user } = useUser();
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProperties([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const activeUser = user;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch('/api/master-admin/properties', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca proprietățile.');
        }
        if (!isMounted) return;
        setProperties(Array.isArray(payload?.properties) ? payload.properties : []);
      } catch (error) {
        if (!isMounted) return;
        setProperties([]);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca proprietățile.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const availableStatuses = useMemo(() => {
    return Array.from(new Set(properties.map((entry) => entry.status).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ro'));
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return properties.filter((entry) => {
      const matchesStatus = statusFilter === 'all' ? true : entry.status === statusFilter;
      const matchesQuery = normalizedQuery
        ? [entry.title, entry.agencyName, entry.agentName, entry.city, entry.location].join(' ').toLowerCase().includes(normalizedQuery)
        : true;
      return matchesStatus && matchesQuery;
    });
  }, [properties, query, statusFilter]);

  return (
    <div className="space-y-6 text-white">
      <Card className="border-none bg-[#10213A] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-emerald-200" /> Proprietăți globale</CardTitle>
          <CardDescription className="text-white/68">
            Toate proprietățile introduse de agențiile din platformă, cu agenția și agentul asociat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Caută după titlu, agenție, agent sau locație..."
                className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/45"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? 'border-emerald-300/30 bg-emerald-400/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}
              >
                Toate
              </Button>
              {availableStatuses.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? 'border-emerald-300/30 bg-emerald-400/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>
          ) : null}
          {isLoading ? (
            [...Array(6)].map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl bg-white/10" />)
          ) : filteredProperties.length ? (
            filteredProperties.map((property) => (
              <div key={property.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{property.title}</p>
                      <Badge className="border-none bg-white/12 text-white">{property.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                      <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-emerald-200" /> {property.agencyName}</span>
                      <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-200" /> {property.city || property.location || 'Locație nedefinită'}</span>
                    </div>
                    <p className="text-sm text-white/62">Agent: {property.agentName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Preț</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(property.price)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Nu există proprietăți care corespund filtrului curent.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
