'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Home, Shield, Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type MasterAdminOverview = {
  totals: {
    agencies: number;
    users: number;
    admins: number;
    agents: number;
    platformAdmins: number;
    properties: number;
    contacts: number;
  };
  agencies: Array<{
    id: string;
    name: string;
    ownerId?: string;
    ownerName: string;
    ownerEmail: string;
    adminCount: number;
    agentCount: number;
    propertiesCount: number;
    contactsCount: number;
  }>;
  topAgencies: Array<{
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    adminCount: number;
    agentCount: number;
    propertiesCount: number;
    contactsCount: number;
  }>;
};

export default function MasterAdminPage() {
  const { user } = useUser();
  const [overview, setOverview] = useState<MasterAdminOverview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOverview(null);
      setIsLoading(false);
      return;
    }

    const activeUser = user;
    let isMounted = true;

    async function loadOverview() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch('/api/master-admin/overview', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca dashboardul master admin.');
        }

        if (!isMounted) return;
        setOverview(payload as MasterAdminOverview);
      } catch (error) {
        if (!isMounted) return;
        setOverview(null);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca dashboardul master admin.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const totalManagedRecords = useMemo(() => {
    if (!overview) return 0;
    return overview.totals.properties + overview.totals.contacts;
  }, [overview]);

  return (
    <div className="space-y-8 text-white">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.18),_transparent_30%),linear-gradient(135deg,_rgba(16,31,53,1)_0%,_rgba(9,19,34,1)_100%)] p-6 shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-100/85">
              <Shield className="h-3.5 w-3.5" />
              Master Admin
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Pulse-ul complet al platformei</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                Din această zonă poți monitoriza toate agențiile, utilizatorii, proprietățile și cumpărătorii din platformă,
                fără să intri în contul fiecărei agenții în parte.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <OverviewPill label="Agenții" value={isLoading ? '...' : String(overview?.totals.agencies || 0)} />
            <OverviewPill label="Utilizatori" value={isLoading ? '...' : String(overview?.totals.users || 0)} />
            <OverviewPill label="Proprietăți" value={isLoading ? '...' : String(overview?.totals.properties || 0)} />
            <OverviewPill label="Leads" value={isLoading ? '...' : String(overview?.totals.contacts || 0)} />
          </div>
        </div>
      </section>

      {errorMessage ? (
        <Card className="border border-red-400/20 bg-red-500/10 text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Nu am putut încărca dashboardul</CardTitle>
            <CardDescription className="text-red-100/80">{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, index) => <Skeleton key={index} className="h-[170px] rounded-[26px] bg-white/10" />)
        ) : (
          <>
            <MetricCard
              title="Agenții active"
              value={String(overview?.totals.agencies || 0)}
              helper={`${overview?.totals.admins || 0} admini de agenție și ${overview?.totals.agents || 0} agenți`}
              icon={<Building2 className="h-5 w-5" />}
            />
            <MetricCard
              title="Conturi platformă"
              value={String(overview?.totals.users || 0)}
              helper={`${overview?.totals.platformAdmins || 0} conturi master admin`}
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              title="Proprietăți totale"
              value={String(overview?.totals.properties || 0)}
              helper="Anunțuri agregate din toate agențiile"
              icon={<Home className="h-5 w-5" />}
            />
            <MetricCard
              title="Date gestionate"
              value={String(totalManagedRecords)}
              helper={`${overview?.totals.contacts || 0} cumpărători și lead-uri în CRM`}
              icon={<Shield className="h-5 w-5" />}
            />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Agenții înregistrate</CardTitle>
            <CardDescription className="text-white/68">
              Vezi rapid fiecare agenție, volumul de date și cine o administrează.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(4)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl bg-white/10" />)
            ) : overview?.agencies.length ? (
              overview.agencies.map((agency) => (
                <div key={agency.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-white">{agency.name}</p>
                      <p className="mt-1 text-sm text-white/62">
                        Owner: {agency.ownerName} · {agency.ownerEmail}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-none bg-white/12 text-white">{agency.adminCount} admini</Badge>
                      <Badge className="border-none bg-white/12 text-white">{agency.agentCount} agenți</Badge>
                      <Badge className="border-none bg-white/12 text-white">{agency.propertiesCount} proprietăți</Badge>
                      <Badge className="border-none bg-white/12 text-white">{agency.contactsCount} leads</Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Nu există încă agenții înregistrate.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Top agenții după activitate</CardTitle>
            <CardDescription className="text-white/68">
              Ranking rapid după proprietăți, lead-uri și utilizatori activi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl bg-white/10" />)
            ) : overview?.topAgencies.length ? (
              overview.topAgencies.map((agency, index) => (
                <div key={agency.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-white/45">Locul {index + 1}</p>
                      <p className="mt-2 text-base font-semibold text-white">{agency.name}</p>
                      <p className="mt-1 text-sm text-white/62">{agency.ownerName}</p>
                    </div>
                    <div className="text-right text-sm text-white/70">
                      <p>{agency.propertiesCount} proprietăți</p>
                      <p>{agency.contactsCount} leads</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Topul va apărea după ce există agenții și activitate în platformă.
              </div>
            )}

            <Button asChild variant="outline" className="mt-2 w-full border-white/15 bg-white/8 text-white hover:bg-white/14">
              <Link href="/master-admin">
                Refresh overview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickLinkCard
          title="Agenții"
          description="Lista completă cu toate agențiile și ownerii lor."
          href="/master-admin/agencies"
        />
        <QuickLinkCard
          title="Utilizatori"
          description="Toate conturile din platformă, inclusiv platform adminii."
          href="/master-admin/users"
        />
        <QuickLinkCard
          title="Proprietăți"
          description="Vizibilitate globală asupra întregului inventar."
          href="/master-admin/properties"
        />
        <QuickLinkCard
          title="Leads"
          description="Toți cumpărătorii și lead-urile din CRM."
          href="/master-admin/leads"
        />
      </section>
    </div>
  );
}

function OverviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricCard({
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
          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-emerald-200">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinkCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Card className="border-none bg-[#10213A] text-white shadow-2xl">
      <CardContent className="p-5">
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm text-white/68">{description}</p>
        <Button asChild variant="outline" className="mt-4 w-full border-white/15 bg-white/8 text-white hover:bg-white/14">
          <Link href={href}>
            Deschide
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
