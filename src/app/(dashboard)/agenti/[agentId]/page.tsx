'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, BarChart3, Building2, CalendarCheck, CheckSquare, Mail, Phone, Target, TrendingUp, Users } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import type { Property, Task, UserProfile, Viewing } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';

function getInitials(name?: string) {
  if (!name) return 'AG';
  return name
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatCurrency(value: number) {
  return `€${Math.round(value || 0).toLocaleString('ro-RO')}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Nedisponibil';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Nedisponibil';
  return parsed.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function sanitizePhoneForWhatsapp(value?: string | null) {
  if (!value) return '';
  return value.replace(/[^\d]/g, '');
}

type AgentStatsPayload = {
  agentProfile: UserProfile | null;
  ranking: {
    commissionRank: number;
    totalAgents: number;
    realizedCommission: number;
  };
  metrics: {
    agentProperties: Property[];
    activePropertiesCount: number;
    soldPropertiesCount: number;
    reservedPropertiesCount: number;
    rentedPropertiesCount: number;
    inactivePropertiesCount: number;
    assignedContactsCount: number;
    activeContactsCount: number;
    wonContactsCount: number;
    lostContactsCount: number;
    assignedViewings: Viewing[];
    assignedViewingsCount: number;
    completedViewingsCount: number;
    scheduledViewingsCount: number;
    cancelledViewingsCount: number;
    assignedTasks: Task[];
    assignedTasksCount: number;
    openTasksCount: number;
    completedTasksCount: number;
    activePortfolioValue: number;
    realizedSalesVolume: number;
    realizedCommission: number;
    conversionRate: number;
  };
};

export default function AgentStatsPage() {
  const { user } = useUser();
  const params = useParams<{ agentId: string }>();
  const agentId = typeof params?.agentId === 'string' ? params.agentId : '';
  const { agencyId, userProfile } = useAgency();
  const isAdmin = userProfile?.role === 'admin';
  const canViewPage = Boolean(agentId) && (isAdmin || userProfile?.id === agentId);
  const [stats, setStats] = useState<AgentStatsPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!canViewPage || !user) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadStats() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const token = await user.getIdToken(true);
        const response = await fetch(`/api/agency/agents/${agentId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca statisticile agentului.');
        }

        if (!isMounted) return;
        setStats(payload as AgentStatsPayload);
      } catch (error) {
        if (!isMounted) return;
        setStats(null);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca statisticile agentului.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [agentId, canViewPage, user]);

  const agentProfile = stats?.agentProfile;
  const metrics = stats?.metrics;
  const ranking = stats?.ranking;
  const whatsappPhone = sanitizePhoneForWhatsapp(agentProfile?.phone);

  if (!canViewPage) {
    return (
      <div className="agentfinder-agent-detail-page space-y-6 p-4 text-white">
        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Acces restricționat</CardTitle>
            <CardDescription className="text-white/70">
              Poți vedea doar statisticile tale sau, dacă ești admin, statisticile agenților din agenția ta.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isLoading && (errorMessage || !agentProfile || agentProfile.agencyId !== agencyId || !metrics)) {
    return (
      <div className="agentfinder-agent-detail-page space-y-6 p-4 text-white">
        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Agent indisponibil</CardTitle>
            <CardDescription className="text-white/70">
              {errorMessage || 'Agentul nu a fost găsit în agenția curentă sau nu mai este disponibil.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="agentfinder-agent-detail-page space-y-8 p-4 text-white">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" className="agentfinder-agent-detail-back-button border-white/15 bg-white/8 text-white hover:bg-white/14">
          <Link href="/agenti">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la agenți
          </Link>
        </Button>
      </div>

      <section className="agentfinder-agent-detail-hero overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.22),_transparent_32%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(14,29,49,1)_55%,_rgba(10,18,33,1)_100%)] p-4 shadow-2xl sm:p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-20 rounded-3xl bg-white/10" />
            <Skeleton className="h-8 w-64 bg-white/10" />
            <Skeleton className="h-5 w-80 bg-white/10" />
          </div>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <Avatar className="h-20 w-20 shrink-0 self-start rounded-3xl border border-white/10">
                <AvatarImage src={agentProfile?.photoUrl || undefined} alt={agentProfile?.name || 'Agent'} />
                <AvatarFallback className="rounded-3xl bg-white/10 text-2xl text-white">
                  {getInitials(agentProfile?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-3">
                <div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{agentProfile?.name}</h1>
                    <Badge variant={agentProfile?.role === 'admin' ? 'default' : 'secondary'} className={agentProfile?.role === 'admin' ? '' : 'border-none bg-white/15 text-white'}>
                      {agentProfile?.role === 'admin' ? 'Admin' : 'Agent'}
                    </Badge>
                    {ranking ? (
                      <Badge className="agentfinder-agent-detail-rank-badge max-w-full whitespace-normal border-none bg-amber-400/15 text-amber-100">
                        Locul {ranking.commissionRank} din {ranking.totalAgents} la comision
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/72 sm:max-w-2xl">
                    Dashboard de performanță pentru agent: anunțuri, lead-uri, task-uri, vizionări și randament comercial.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm text-white/75 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="agentfinder-agent-detail-contact-pill inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
                    <Mail className="h-4 w-4 text-emerald-200" />
                    <span className="truncate">{agentProfile?.email || 'Email indisponibil'}</span>
                  </span>
                  <span className="agentfinder-agent-detail-contact-pill inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5">
                    <Phone className="h-4 w-4 text-emerald-200" />
                    <span className="truncate">{agentProfile?.phone || 'Telefon necompletat'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {agentProfile?.email ? (
                      <a
                        href={`mailto:${agentProfile.email}`}
                        aria-label="Trimite email agentului"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/85 transition hover:bg-white/12 hover:text-white"
                      >
                        <Mail className="h-4 w-4 text-emerald-200" />
                      </a>
                    ) : null}
                    {whatsappPhone ? (
                      <a
                        href={`https://wa.me/${whatsappPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Deschide WhatsApp"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/85 transition hover:bg-white/12 hover:text-white"
                      >
                        <WhatsappIcon className="h-4 w-4 text-emerald-200" />
                      </a>
                    ) : null}
                    {agentProfile?.phone ? (
                      <a
                        href={`tel:${agentProfile.phone}`}
                        aria-label="Sună agentul"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/85 transition hover:bg-white/12 hover:text-white"
                      >
                        <Phone className="h-4 w-4 text-emerald-200" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[42%]">
              <QuickStat label="Anunțuri active" value={String(metrics.activePropertiesCount)} />
              <QuickStat label="Lead-uri active" value={String(metrics.activeContactsCount)} />
              <QuickStat label="Comision realizat" value={formatCurrency(metrics.realizedCommission)} />
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, index) => <Skeleton key={index} className="h-[150px] rounded-3xl bg-white/10" />)
        ) : (
          <>
            <MetricCard title="Portofoliu activ" value={String(metrics.activePropertiesCount)} helper={`${formatCurrency(metrics.activePortfolioValue)} valoare în piață`} icon={<Building2 className="h-5 w-5" />} />
            <MetricCard title="Lead-uri atribuite" value={String(metrics.assignedContactsCount)} helper={`${metrics.wonContactsCount} câștigate, ${metrics.lostContactsCount} pierdute`} icon={<Users className="h-5 w-5" />} />
            <MetricCard title="Vizionări" value={String(metrics.assignedViewingsCount)} helper={`${metrics.completedViewingsCount} finalizate, ${metrics.scheduledViewingsCount} programate`} icon={<CalendarCheck className="h-5 w-5" />} />
            <MetricCard title="Task-uri" value={String(metrics.assignedTasksCount)} helper={`${metrics.openTasksCount} deschise, ${metrics.completedTasksCount} finalizate`} icon={<CheckSquare className="h-5 w-5" />} />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-200" /> Portofoliu proprietăți</CardTitle>
            <CardDescription className="text-white/70">Distribuția actuală a anunțurilor agentului.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full bg-white/10 sm:col-span-2" />
            ) : (
              <>
                <MiniMetric label="Active" value={metrics.activePropertiesCount} text="anunțuri în piață" />
                <MiniMetric label="Rezervate" value={metrics.reservedPropertiesCount} text="aproape de închidere" />
                <MiniMetric label="Vândute" value={metrics.soldPropertiesCount} text="tranzacții finalizate" />
                <MiniMetric label="Închiriate/Inactice" value={metrics.rentedPropertiesCount + metrics.inactivePropertiesCount} text="portofoliu ieșit din piață" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-200" /> Lead-uri și conversie</CardTitle>
            <CardDescription className="text-white/70">Calitatea pipeline-ului și randamentul comercial al agentului.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full bg-white/10 sm:col-span-2" />
            ) : (
              <>
                <MiniMetric label="Lead-uri active" value={metrics.activeContactsCount} text="încă în lucru" />
                <MiniMetric label="Câștigate" value={metrics.wonContactsCount} text="lead-uri convertite" />
                <MiniMetric label="Pierdute" value={metrics.lostContactsCount} text="lead-uri ieșite din pipeline" />
                <MiniMetric label="Rată conversie" value={`${metrics.conversionRate.toFixed(1)}%`} text="din lead-urile atribuite" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-200" /> Performanță comercială</CardTitle>
            <CardDescription className="text-white/70">Volum și comision estimat pe tranzacțiile finalizate.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full bg-white/10" />
            ) : (
              <>
                <MiniPanel title="Volum tranzacții finalizate" value={formatCurrency(metrics.realizedSalesVolume)} subtitle={`${metrics.soldPropertiesCount + metrics.rentedPropertiesCount} proprietăți finalizate`} />
                <MiniPanel title="Comision realizat" value={formatCurrency(metrics.realizedCommission)} subtitle="calculat din comisioanele setate pe proprietăți" />
                <MiniPanel title="Task-uri deschise" value={String(metrics.openTasksCount)} subtitle="acțiuni care au nevoie de follow-up" />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-200" /> Anunțuri recente</CardTitle>
                <CardDescription className="text-white/70">Ultimele proprietăți atribuite acestui agent.</CardDescription>
              </div>
              <Button asChild variant="outline" className="agentfinder-agent-detail-back-button border-white/15 bg-white/8 text-white hover:bg-white/14">
                <Link href={`/properties?agentId=${encodeURIComponent(agentId)}&agentName=${encodeURIComponent(agentProfile?.name || 'Agent')}`}>
                  Vezi anunțurile agentului
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-[260px] w-full bg-white/10" />
            ) : metrics.agentProperties.length ? (
              metrics.agentProperties.map((property) => (
                <div key={property.id} className="agentfinder-agent-detail-list-item rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{property.title}</p>
                      <p className="mt-1 text-sm text-white/65">{property.address || property.location}</p>
                    </div>
                    <Badge variant="secondary" className="border-none bg-white/15 text-white">
                      {property.status || 'Nedefinit'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/70">
                    <span>{formatCurrency(property.price || 0)}</span>
                    <span>{property.rooms || 0} camere</span>
                    <span>Creat: {formatDate(property.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="agentfinder-agent-detail-list-item rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Agentul nu are încă proprietăți atribuite.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="agentfinder-agent-detail-card border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-emerald-200" /> Activitate recentă</CardTitle>
            <CardDescription className="text-white/70">Vizionări și task-uri programate sau finalizate recent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-[260px] w-full bg-white/10" />
            ) : (
              <>
                {metrics.assignedViewings.map((viewing) => (
                  <div key={`viewing-${viewing.id}`} className="agentfinder-agent-detail-list-item rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-base font-semibold text-white">{viewing.propertyTitle}</p>
                    <p className="mt-1 text-sm text-white/65">Vizionare cu {viewing.contactName}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/70">
                      <span>{formatDate(viewing.viewingDate)}</span>
                      <span>Status: {viewing.status}</span>
                    </div>
                  </div>
                ))}
                {metrics.assignedTasks.map((task) => (
                  <div key={`task-${task.id}`} className="agentfinder-agent-detail-list-item rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-base font-semibold text-white">{task.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/70">
                      <span>Scadență: {formatDate(task.dueDate)}</span>
                      <span>Status: {task.status === 'open' ? 'Deschis' : 'Finalizat'}</span>
                    </div>
                  </div>
                ))}
                {!metrics.assignedViewings.length && !metrics.assignedTasks.length ? (
                  <div className="agentfinder-agent-detail-list-item rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    Nu există încă activitate recentă pentru acest agent.
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="agentfinder-agent-detail-quick-stat rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
      <p className="whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-white/55 sm:text-xs sm:tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
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
  icon: React.ReactNode;
}) {
  return (
    <Card className="agentfinder-agent-detail-metric-card border-none bg-[#152A47] text-white shadow-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">{title}</p>
            <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
            <p className="mt-3 text-sm text-white/68">{helper}</p>
          </div>
          <div className="agentfinder-agent-detail-icon-tile rounded-2xl border border-white/10 bg-white/6 p-3 text-emerald-200">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, text }: { label: string; value: number | string; text: string }) {
  return (
    <div className="agentfinder-agent-detail-mini rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/70">{text}</p>
    </div>
  );
}

function MiniPanel({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="agentfinder-agent-detail-mini rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}
