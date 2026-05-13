'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Clock, Database, Gauge, PhoneCall, RefreshCw, ShieldCheck } from 'lucide-react';
import { useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ScrapingOverview = {
  generatedAt: string;
  totals: {
    scopes: number;
    activeScopes: number;
    runningScopes: number;
    failedScopes: number;
    cooldownScopes: number;
    queuedOlxPhones: number;
    failedOlxPhones: number;
    frontierJobs: number;
    frontierFailedJobs: number;
    enrichmentQueued: number;
    enrichmentFailed: number;
  };
  scopes: Array<{
    scopeKey: string;
    scopeLabel: string;
    baselineStatus: string;
    status: string;
    currentSource: string | null;
    cycleNumber: number;
    cooldownUntil: string | null;
    lastHeartbeatAt: string | null;
    lastError: string | null;
    jobs: Array<{
      source: string;
      status: string;
      nextPage: number;
      pagesProcessed: number;
      scanned: number;
      stored: number;
      errors: number;
      lastRunAt: string | null;
      lastError: string | null;
    }>;
    frontierJobs: Array<{
      id: string;
      source: string;
      label: string;
      sourceUrlKind: string;
      status: string;
      nextPage: number;
      priority: number;
      lastRunAt: string | null;
      nextRunAt: string | null;
      lastError: string | null;
    }>;
  }>;
  recentRuns: Array<{
    scopeKey: string;
    source: string;
    page: number;
    scanned: number;
    stored: number;
    errors: number;
    durationMs: number;
    finishedAt: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Nedisponibil';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Nedisponibil';
  return parsed.toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function statusTone(status: string) {
  if (status === 'running') return 'border-blue-300/30 bg-blue-400/12 text-blue-100';
  if (status === 'failed') return 'border-rose-300/30 bg-rose-400/12 text-rose-100';
  if (status === 'cooldown' || status === 'done') return 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100';
  return 'border-white/12 bg-white/8 text-white/72';
}

export default function MasterAdminScrapingPage() {
  const { user } = useUser();
  const [overview, setOverview] = useState<ScrapingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadOverview(activeUser = user) {
    if (!activeUser) {
      setOverview(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = await activeUser.getIdToken(true);
      const response = await fetch('/api/master-admin/scraping', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut incarca statusul scrapingului.');
      }
      setOverview(payload as ScrapingOverview);
    } catch (error) {
      setOverview(null);
      setErrorMessage(error instanceof Error ? error.message : 'Nu am putut incarca statusul scrapingului.');
    } finally {
      setIsLoading(false);
    }
  }

  async function runScrapingAction(body: Record<string, unknown>) {
    if (!user) return;
    setErrorMessage(null);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/master-admin/scraping/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Actiunea de scraping a esuat.');
      }
      await loadOverview(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Actiunea de scraping a esuat.');
    }
  }

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const unhealthyScopes = useMemo(() => {
    return overview?.scopes.filter((scope) => scope.status === 'failed' || scope.lastError || scope.jobs.some((job) => job.errors > 0)) || [];
  }, [overview]);

  return (
    <div className="space-y-6 text-white">
      <section className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-[#10213A] p-5 shadow-2xl md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-100/85">
            <ShieldCheck className="h-3.5 w-3.5" />
            Scraping Control
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">Sanatatea motorului de anunturi</h2>
          <p className="mt-2 text-sm text-white/64">Vizibilitate operationala pentru coverage, joburi, erori si enrichment.</p>
        </div>
        <Button
          type="button"
          onClick={() => void loadOverview()}
          disabled={isLoading}
          className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading ? 'animate-spin' : '')} />
          Actualizeaza
        </Button>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">{errorMessage}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, index) => <Skeleton key={index} className="h-32 rounded-[22px] bg-white/10" />)
        ) : (
          <>
            <Metric title="Scope-uri" value={`${overview?.totals.activeScopes || 0}/${overview?.totals.scopes || 0}`} helper="baseline complet" icon={<Database />} />
            <Metric title="Ruleaza acum" value={String(overview?.totals.runningScopes || 0)} helper={`${overview?.totals.cooldownScopes || 0} in cooldown`} icon={<Activity />} />
            <Metric title="Alerte" value={String(unhealthyScopes.length)} helper={`${overview?.totals.failedScopes || 0} scope-uri cu risc`} icon={<AlertTriangle />} />
            <Metric title="Frontier" value={String(overview?.totals.frontierJobs || 0)} helper={`${overview?.totals.frontierFailedJobs || 0} joburi esuate`} icon={<Gauge />} />
            <Metric title="Enrichment" value={String(overview?.totals.enrichmentQueued || 0)} helper={`${overview?.totals.enrichmentFailed || 0} esuate · OLX ${overview?.totals.queuedOlxPhones || 0}`} icon={<PhoneCall />} />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Coverage pe orase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(8)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl bg-white/10" />)
            ) : overview?.scopes.length ? (
              overview.scopes.map((scope) => (
                <div key={scope.scopeKey} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{scope.scopeLabel}</p>
                        <Badge className={cn('border', statusTone(scope.status))}>{scope.status}</Badge>
                        <Badge className={cn('border', statusTone(scope.baselineStatus === 'completed' ? 'done' : scope.baselineStatus))}>
                          baseline {scope.baselineStatus}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-white/58">
                        Ciclu {scope.cycleNumber} · sursa curenta {scope.currentSource || 'niciuna'} · heartbeat {formatDate(scope.lastHeartbeatAt)}
                      </p>
                      {scope.lastError ? <p className="mt-2 text-sm text-rose-200">{scope.lastError}</p> : null}
                    </div>
                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <div className="text-sm text-white/58">Cooldown {formatDate(scope.cooldownUntil)}</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-white/15 bg-white/8 text-xs text-white hover:bg-white/14"
                        onClick={() => void runScrapingAction({ action: 'rerun-scope-frontier', scopeKey: scope.scopeKey })}
                      >
                        Rerun scope
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {scope.jobs.map((job) => (
                      <div key={`${scope.scopeKey}-${job.source}`} className="rounded-xl border border-white/8 bg-black/12 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium uppercase tracking-[0.16em] text-white/78">{job.source}</span>
                          <Badge className={cn('border', statusTone(job.status))}>{job.status}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/56">
                          <span>pagina {job.nextPage}</span>
                          <span>{job.pagesProcessed} pagini</span>
                          <span>{job.scanned} scanate</span>
                          <span>{job.stored} salvate</span>
                          <span>{job.errors} erori</span>
                          <span>{formatDate(job.lastRunAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {scope.frontierJobs.length ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">Frontier jobs</p>
                      <div className="grid gap-2 xl:grid-cols-2">
                        {scope.frontierJobs.slice(0, 8).map((job) => (
                          <div key={job.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium" title={job.label}>{job.label}</p>
                                <p className="mt-1 text-xs text-white/46">
                                  {job.source} · {job.sourceUrlKind} · pagina {job.nextPage} · next {formatDate(job.nextRunAt)}
                                </p>
                                {job.lastError ? <p className="mt-1 truncate text-xs text-rose-200" title={job.lastError}>{job.lastError}</p> : null}
                              </div>
                              <Badge className={cn('shrink-0 border', statusTone(job.status))}>{job.status}</Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-full border-white/15 bg-white/8 px-3 text-xs text-white hover:bg-white/14"
                                onClick={() => void runScrapingAction({ action: 'reset-frontier-job', jobId: job.id })}
                              >
                                Reset
                              </Button>
                              {job.status === 'cooldown' || job.status === 'failed' ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-full border-emerald-300/25 bg-emerald-400/10 px-3 text-xs text-emerald-100 hover:bg-emerald-400/16"
                                  onClick={() => void runScrapingAction({ action: 'resume-frontier-job', jobId: job.id })}
                                >
                                  Resume
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-full border-amber-300/25 bg-amber-400/10 px-3 text-xs text-amber-100 hover:bg-amber-400/16"
                                  onClick={() => void runScrapingAction({ action: 'pause-frontier-job', jobId: job.id })}
                                >
                                  Pause
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/62">Nu exista scope-uri configurate.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#10213A] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Rulari recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [...Array(8)].map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl bg-white/10" />)
            ) : overview?.recentRuns.length ? (
              overview.recentRuns.slice(0, 20).map((run, index) => (
                <div key={`${run.scopeKey}-${run.source}-${run.page}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{run.scopeKey}</p>
                      <p className="mt-1 text-sm text-white/56">
                        {run.source} · pagina {run.page}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-white/56">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(run.durationMs)}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge className="border border-white/10 bg-white/8 text-white">{run.scanned} scanate</Badge>
                    <Badge className="border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">{run.stored} salvate</Badge>
                    <Badge className="border border-rose-300/20 bg-rose-400/10 text-rose-100">{run.errors} erori</Badge>
                    <Badge className="border border-white/10 bg-white/8 text-white">{formatDate(run.finishedAt)}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/62">Nu exista rulari recente.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <Card className="border-none bg-[#10213A] text-white shadow-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">{title}</p>
            <p className="mt-3 text-4xl font-semibold">{value}</p>
            <p className="mt-2 text-sm text-white/62">{helper}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-emerald-200 [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
