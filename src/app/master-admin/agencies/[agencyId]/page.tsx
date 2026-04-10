'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, Home, Mail, Phone, Shield, Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type AgencyDetailPayload = {
  agency: {
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
  agents: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'agent' | 'platform_admin' | 'unknown';
    agencyName: string;
  }>;
  properties: Array<{
    id: string;
    title: string;
    agentName: string;
    status: string;
    price: number;
    city: string;
    location: string;
  }>;
  leads: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    agentName: string;
    status: string;
    source: string;
    budget: number;
  }>;
  stats: {
    totalUsers: number;
    adminCount: number;
    agentCount: number;
    propertiesCount: number;
    activePropertiesCount: number;
    leadsCount: number;
    wonLeadsCount: number;
    activeLeadsCount: number;
    totalPortfolioValue: number;
    totalLeadBudget: number;
  };
};

function formatCurrency(value: number) {
  return `€${Math.round(value || 0).toLocaleString('ro-RO')}`;
}

export default function MasterAdminAgencyDetailPage() {
  const { user } = useUser();
  const params = useParams<{ agencyId: string }>();
  const agencyId = typeof params?.agencyId === 'string' ? params.agencyId : '';
  const [detail, setDetail] = useState<AgencyDetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !agencyId) {
      setDetail(null);
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
        const response = await fetch(`/api/master-admin/agencies/${agencyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca agenția.');
        }
        if (!isMounted) return;
        setDetail(payload as AgencyDetailPayload);
      } catch (error) {
        if (!isMounted) return;
        setDetail(null);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca agenția.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [agencyId, user]);

  const topAgents = useMemo(() => detail?.agents.filter((entry) => entry.role === 'agent') || [], [detail]);

  return (
    <div className="space-y-8 text-white">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" className="border-white/15 bg-white/8 text-white hover:bg-white/14">
          <Link href="/master-admin/agencies">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la agenții
          </Link>
        </Button>
      </div>

      {errorMessage ? (
        <Card className="border border-red-400/20 bg-red-500/10 text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Agenție indisponibilă</CardTitle>
            <CardDescription className="text-red-100/80">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.18),_transparent_30%),linear-gradient(135deg,_rgba(16,31,53,1)_0%,_rgba(9,19,34,1)_100%)] p-6 shadow-2xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-72 bg-white/10" />
            <Skeleton className="h-5 w-96 bg-white/10" />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-100/85">
                <Building2 className="h-3.5 w-3.5" />
                Detaliu agenție
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{detail.agency.name}</h1>
                <p className="mt-3 text-sm leading-7 text-white/72">
                  Owner: {detail.agency.ownerName} · Date comerciale, utilizatori, proprietăți și leads agregate într-un singur tablou.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-white/72">
                <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-200" /> {detail.agency.contactEmail}</span>
                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-200" /> {detail.agency.contactPhone}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <HeroPill label="Utilizatori" value={String(detail.stats.totalUsers)} />
              <HeroPill label="Proprietăți" value={String(detail.stats.propertiesCount)} />
              <HeroPill label="Leads" value={String(detail.stats.leadsCount)} />
              <HeroPill label="Portofoliu" value={formatCurrency(detail.stats.totalPortfolioValue)} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {isLoading ? (
          [...Array(5)].map((_, index) => <Skeleton key={index} className="h-[150px] rounded-[26px] bg-white/10" />)
        ) : detail ? (
          <>
            <StatCard title="Admini" value={String(detail.stats.adminCount)} helper="conturi cu control de agenție" icon={<Shield className="h-5 w-5" />} />
            <StatCard title="Agenți" value={String(detail.stats.agentCount)} helper="membri în echipa comercială" icon={<Users className="h-5 w-5" />} />
            <StatCard title="Anunțuri active" value={String(detail.stats.activePropertiesCount)} helper="proprietăți în piață" icon={<Home className="h-5 w-5" />} />
            <StatCard title="Leads active" value={String(detail.stats.activeLeadsCount)} helper="încă în lucru" icon={<Users className="h-5 w-5" />} />
            <StatCard title="Leads câștigate" value={String(detail.stats.wonLeadsCount)} helper={formatCurrency(detail.stats.totalLeadBudget)} icon={<Building2 className="h-5 w-5" />} />
          </>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Agenții agenției</CardTitle>
            <CardDescription className="text-white/68">Toate conturile asociate acestei agenții.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(4)].map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl bg-white/10" />)
            ) : detail?.agents.length ? (
              detail.agents.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{entry.name}</p>
                      <p className="mt-1 text-sm text-white/62">{entry.email}</p>
                      <p className="mt-1 text-sm text-white/62">{entry.phone}</p>
                    </div>
                    <Badge className="border-none bg-white/12 text-white">{entry.role === 'admin' ? 'Admin' : 'Agent'}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Nu există utilizatori în această agenție.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#10213A] text-white shadow-2xl xl:col-span-2">
          <CardHeader>
            <CardTitle>Proprietăți ale agenției</CardTitle>
            <CardDescription className="text-white/68">Inventarul complet și agenții care îl administrează.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl bg-white/10" />)
            ) : detail?.properties.length ? (
              detail.properties.map((property) => (
                <div key={property.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{property.title}</p>
                        <Badge className="border-none bg-white/12 text-white">{property.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-white/62">{property.city || property.location || 'Locație nedefinită'}</p>
                      <p className="mt-1 text-sm text-white/62">Agent: {property.agentName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Preț</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(property.price)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Nu există proprietăți în această agenție.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Top agenți ai agenției</CardTitle>
            <CardDescription className="text-white/68">Echipa comercială asociată acestui tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl bg-white/10" />)
            ) : topAgents.length ? (
              topAgents.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">{entry.name}</p>
                  <p className="mt-1 text-sm text-white/62">{entry.email}</p>
                  <p className="mt-1 text-sm text-white/62">{entry.phone}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Nu există agenți comerciali în această agenție.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Buyerii și lead-urile agenției</CardTitle>
            <CardDescription className="text-white/68">Toți cumpărătorii salvați și pipeline-ul lor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl bg-white/10" />)
            ) : detail?.leads.length ? (
              detail.leads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{lead.name}</p>
                        <Badge className="border-none bg-white/12 text-white">{lead.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-white/62">{lead.email} · {lead.phone}</p>
                      <p className="mt-1 text-sm text-white/62">Agent: {lead.agentName} · Sursă: {lead.source}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Buget</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(lead.budget)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Nu există leads în această agenție.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HeroPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-none bg-[#10213A] text-white shadow-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">{title}</p>
            <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
            <p className="mt-3 text-sm text-white/68">{helper}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-emerald-200">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
