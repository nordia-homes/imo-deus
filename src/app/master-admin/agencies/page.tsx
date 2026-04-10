'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Mail, Phone, Search, Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type AgencyItem = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  contactEmail: string;
  contactPhone: string;
  adminCount: number;
  agentCount: number;
  propertiesCount: number;
  contactsCount: number;
};

export default function MasterAdminAgenciesPage() {
  const { user } = useUser();
  const [agencies, setAgencies] = useState<AgencyItem[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setAgencies([]);
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
        const response = await fetch('/api/master-admin/agencies', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca agențiile.');
        }
        if (!isMounted) return;
        setAgencies(Array.isArray(payload?.agencies) ? payload.agencies : []);
      } catch (error) {
        if (!isMounted) return;
        setAgencies([]);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca agențiile.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredAgencies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return agencies;

    return agencies.filter((agency) =>
      [
        agency.name,
        agency.ownerName,
        agency.ownerEmail,
        agency.contactEmail,
        agency.contactPhone,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [agencies, query]);

  return (
    <div className="space-y-6 text-white">
      <Card className="border-none bg-[#10213A] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-emerald-200" /> Agenții din platformă</CardTitle>
          <CardDescription className="text-white/68">
            Listă completă cu toate agențiile, ownerii lor și volumul principal de activitate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută după agenție, owner, email sau telefon..."
              className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/45"
            />
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>
          ) : null}
          {isLoading ? (
            [...Array(5)].map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl bg-white/10" />)
          ) : filteredAgencies.length ? (
            filteredAgencies.map((agency) => (
              <div key={agency.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <p className="text-xl font-semibold text-white">{agency.name}</p>
                    <p className="text-sm text-white/62">Owner: {agency.ownerName}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-white/70">
                      <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-200" /> {agency.ownerEmail}</span>
                      <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-200" /> {agency.contactPhone}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-none bg-white/12 text-white">{agency.adminCount} admini</Badge>
                    <Badge className="border-none bg-white/12 text-white">{agency.agentCount} agenți</Badge>
                    <Badge className="border-none bg-white/12 text-white">{agency.propertiesCount} proprietăți</Badge>
                    <Badge className="border-none bg-white/12 text-white">{agency.contactsCount} leads</Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MiniStat label="Email agenție" value={agency.contactEmail} />
                  <MiniStat label="Utilizatori" value={String(agency.adminCount + agency.agentCount)} />
                  <MiniStat label="Proprietăți" value={String(agency.propertiesCount)} />
                  <MiniStat label="Leads" value={String(agency.contactsCount)} />
                </div>
                <Button asChild variant="outline" className="mt-4 border-white/15 bg-white/8 text-white hover:bg-white/14">
                  <Link href={`/master-admin/agencies/${agency.id}`}>
                    Vezi detaliu agenție
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Nu există agenții care corespund căutării curente.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
