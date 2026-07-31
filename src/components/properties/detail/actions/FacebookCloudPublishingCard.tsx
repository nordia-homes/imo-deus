'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Facebook,
  Loader2,
  Play,
  Square,
  Star,
  Timer,
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { facebookCloudFetch } from '@/lib/facebook-cloud-client';
import { getAgencyFacebookGroups } from '@/lib/facebook-groups';
import type {
  FacebookCloudConnection,
  FacebookCloudPublishingJob,
  Property,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ACTION_ICON_CLASSNAME, ACTION_ICON_WRAPPER_CLASSNAME } from './cardStyles';

function formatDuration(groupCount: number) {
  if (!groupCount) return 'Selectează grupurile';
  const minMinutes = Math.max(1, Math.ceil(((groupCount - 1) * 90 + groupCount * 15) / 60));
  const maxMinutes = Math.max(2, Math.ceil(((groupCount - 1) * 120 + groupCount * 30) / 60));
  return `aprox. ${minMinutes}–${maxMinutes} min`;
}

function jobLabel(job: FacebookCloudPublishingJob) {
  const labels: Record<FacebookCloudPublishingJob['status'], string> = {
    queued: 'În coadă',
    running: 'Se publică',
    cooldown: 'În așteptare',
    completed: 'Finalizat',
    cancelled: 'Oprit',
    needs_reauthentication: 'Reconectare necesară',
    error: 'Eroare',
  };
  return labels[job.status];
}

export function FacebookCloudPublishingCard({ property }: { property: Property }) {
  const { user } = useUser();
  const { agency, agencyId } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const groups = useMemo(() => getAgencyFacebookGroups(agency), [agency]);
  const [connections, setConnections] = useState<FacebookCloudConnection[]>([]);
  const [globalDefaultId, setGlobalDefaultId] = useState<string | null>(null);
  const [propertyDefaultId, setPropertyDefaultId] = useState(property.defaultFacebookConnectionId || null);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [showGroups, setShowGroups] = useState(false);
  const [jobs, setJobs] = useState<FacebookCloudPublishingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    try {
      const [connectionsResponse, jobsResponse] = await Promise.all([
        facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections'),
        facebookCloudFetch(user, `/api/marketing/facebook-cloud/jobs?propertyId=${encodeURIComponent(property.id)}`),
      ]);
      const connectionsPayload = await connectionsResponse.json().catch(() => ({}));
      const jobsPayload = await jobsResponse.json().catch(() => ({}));
      if (!connectionsResponse.ok) throw new Error(connectionsPayload.message || 'Conturile nu au putut fi încărcate.');
      setConnections(connectionsPayload.connections || []);
      setGlobalDefaultId(connectionsPayload.defaultConnectionId || null);
      setJobs(jobsResponse.ok ? jobsPayload.jobs || [] : []);
      setSelectedConnectionId((current) => {
        if (current && connectionsPayload.connections?.some((item: FacebookCloudConnection) => item.id === current)) return current;
        const preferred = propertyDefaultId || connectionsPayload.defaultConnectionId;
        if (preferred && connectionsPayload.connections?.some((item: FacebookCloudConnection) => item.id === preferred)) return preferred;
        return connectionsPayload.connections?.find((item: FacebookCloudConnection) => item.status === 'connected')?.id || '';
      });
    } catch (error) {
      if (!quiet) {
        toast({ variant: 'destructive', title: 'Publicarea cloud nu este disponibilă', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [property.id, propertyDefaultId, toast, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasActiveJob = jobs.some((job) => ['queued', 'running', 'cooldown'].includes(job.status));
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void load(true), 7000);
    return () => window.clearInterval(timer);
  }, [jobs, load]);

  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) || null;
  const activeJob = jobs.find((job) => ['queued', 'running', 'cooldown'].includes(job.status)) || null;
  const latestJob = activeJob || jobs[0] || null;
  const isActive = Boolean(activeJob);
  const completedGroups = latestJob?.groups.filter((group) => ['submitted', 'pending_approval'].includes(group.status)).length || 0;

  function toggleGroup(url: string, checked: boolean) {
    setSelectedUrls((current) => checked ? [...current, url] : current.filter((item) => item !== url));
  }

  async function savePropertyDefault() {
    if (!agencyId || !selectedConnectionId) return;
    setSavingDefault(true);
    try {
      await updateDoc(
        doc(firestore, 'agencies', agencyId, 'properties', property.id),
        { defaultFacebookConnectionId: selectedConnectionId }
      );
      setPropertyDefaultId(selectedConnectionId);
      toast({ title: 'Cont atribuit proprietății', description: selectedConnection?.label || selectedConnection?.displayName });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Atribuire eșuată', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setSavingDefault(false);
    }
  }

  async function publish() {
    if (!user || !selectedConnectionId || !selectedUrls.length) return;
    setPublishing(true);
    try {
      const response = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/jobs', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: property.id,
          connectionId: selectedConnectionId,
          groupUrls: selectedUrls,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Publicarea nu a putut fi pornită.');
      setJobs((current) => [body.job, ...current]);
      toast({
        title: 'Publicarea a început',
        description: `${selectedUrls.length} grupuri · ${selectedConnection?.label || selectedConnection?.displayName}`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Publicare eșuată', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setPublishing(false);
    }
  }

  async function cancelJob() {
    if (!user || !latestJob) return;
    const response = await facebookCloudFetch(user, `/api/marketing/facebook-cloud/jobs/${latestJob.id}`, { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ variant: 'destructive', title: 'Jobul nu a putut fi oprit', description: body.message || 'A apărut o eroare.' });
      return;
    }
    setJobs((current) => current.map((job) => job.id === latestJob.id ? { ...job, status: 'cancelled' } : job));
    toast({ title: 'Publicare oprită', description: 'Runnerul se va opri înaintea următorului grup.' });
  }

  return (
    <Card className="overflow-hidden border-sky-300/15 bg-[#152A47] p-0 text-white shadow-xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={ACTION_ICON_WRAPPER_CLASSNAME}>
              <Facebook className={ACTION_ICON_CLASSNAME} />
            </div>
            <div>
              <p className="font-semibold">Publicare automată în grupuri</p>
              <p className="text-xs text-white/55">Runner cloud self-hosted</p>
            </div>
          </div>
          {latestJob ? (
            <Badge className={cn(
              'border-0',
              latestJob.status === 'completed' ? 'bg-emerald-500/15 text-emerald-100' :
              latestJob.status === 'error' || latestJob.status === 'needs_reauthentication' ? 'bg-rose-500/15 text-rose-100' :
              'bg-sky-500/15 text-sky-100'
            )}>{jobLabel(latestJob)}</Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-white/8 p-6 text-sm text-white/55">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Se încarcă...
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-4 text-sm">
            <p className="text-white/65">Conectează un cont Facebook înainte de publicare.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/marketing/facebook-accounts">Gestionează conturile</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/45">Cont Facebook</span>
                {propertyDefaultId === selectedConnectionId ? (
                  <span className="flex items-center text-[11px] text-amber-200"><Star className="mr-1 h-3 w-3 fill-current" />Implicit proprietate</span>
                ) : null}
              </div>
              <Select value={selectedConnectionId} onValueChange={(value) => {
                setSelectedConnectionId(value);
                setSelectedUrls([]);
              }}>
                <SelectTrigger className="border-white/10 bg-black/15 text-white">
                  <SelectValue placeholder="Alege contul" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.label || connection.displayName}
                      {connection.status !== 'connected' ? ' · reconectare necesară' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedConnectionId && propertyDefaultId !== selectedConnectionId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={savingDefault}
                  className="h-auto px-0 text-xs text-sky-200 hover:bg-transparent hover:text-sky-100"
                  onClick={() => void savePropertyDefault()}
                >
                  {savingDefault ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Star className="mr-1 h-3 w-3" />}
                  Atribuie acest cont proprietății
                </Button>
              ) : null}
              {!propertyDefaultId && globalDefaultId === selectedConnectionId ? (
                <p className="text-[11px] text-white/45">Este folosit contul implicit al agentului.</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/8 bg-black/10">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
                onClick={() => setShowGroups((current) => !current)}
              >
                <div>
                  <p className="text-sm font-medium">Grupuri Facebook</p>
                  <p className="text-xs text-white/50">{selectedUrls.length} din {groups.length} selectate</p>
                </div>
                {showGroups ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showGroups ? (
                <div className="max-h-64 space-y-2 overflow-y-auto border-t border-white/8 p-3">
                  <div className="flex gap-2 pb-1">
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedUrls(groups.map((group) => group.url))}>Toate</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedUrls([])}>Niciunul</Button>
                  </div>
                  {groups.map((group, index) => {
                    const id = `cloud-facebook-${property.id}-${index}`;
                    return (
                      <label key={`${group.url}-${index}`} htmlFor={id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/8 p-2 hover:bg-white/5">
                        <Checkbox id={id} checked={selectedUrls.includes(group.url)} onCheckedChange={(checked) => toggleGroup(group.url, Boolean(checked))} />
                        <span className="min-w-0">
                          <span className="block text-sm">{group.name || `Grup ${index + 1}`}</span>
                          <span className="block truncate text-[11px] text-white/40">{group.url}</span>
                        </span>
                      </label>
                    );
                  })}
                  {!groups.length ? <p className="text-xs text-white/50">Configurează grupurile în cardul „Grupurile tale Facebook”.</p> : null}
                </div>
              ) : null}
            </div>

            {latestJob ? (
              <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{jobLabel(latestJob)}</span>
                  <span>{completedGroups}/{latestJob.groups.length}</span>
                </div>
                {latestJob.nextRunAt && latestJob.status === 'cooldown' ? (
                  <p className="mt-2 flex items-center text-xs text-white/50">
                    <Timer className="mr-1 h-3.5 w-3.5" />
                    Următoarea publicare după {new Date(latestJob.nextRunAt).toLocaleTimeString('ro-RO')}
                  </p>
                ) : null}
                {latestJob.errorMessage ? <p className="mt-2 text-xs text-rose-200">{latestJob.errorMessage}</p> : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-white/50">
                <p>{formatDuration(selectedUrls.length)}</p>
                <p>pauză 90–120 sec. per cont</p>
              </div>
              {isActive ? (
                <Button type="button" variant="outline" className="border-rose-300/20 bg-rose-500/10 text-rose-100" onClick={() => void cancelJob()}>
                  <Square className="mr-2 h-3.5 w-3.5" />
                  Oprește
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={publishing || !selectedConnection || selectedConnection.status !== 'connected' || selectedUrls.length === 0}
                  className="bg-sky-400 text-slate-950 hover:bg-sky-300"
                  onClick={() => void publish()}
                >
                  {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Publică în {selectedUrls.length} {selectedUrls.length === 1 ? 'grup' : 'grupuri'}
                </Button>
              )}
            </div>

            {latestJob?.status === 'completed' ? (
              <p className="flex items-center text-xs text-emerald-200">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Publicarea s-a încheiat. Poți porni un job nou.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
