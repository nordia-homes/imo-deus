'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AssistantPlan } from '@/lib/ai-assistant/contracts';
import { usePlanOutcomes } from './usePlanOutcomes';

export function AssistantExecutionControls({ plan, user, onPlan, onResume, onError, resumeDisabled }: {
  plan: AssistantPlan; user: { getIdToken(): Promise<string> } | null;
  onPlan: (plan: AssistantPlan) => void; onResume: () => void; onError: (message: string) => void;
  resumeDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { outcomes, refreshing, watching, error: outcomeError, refresh } = usePlanOutcomes(plan.id, !!plan.results?.length || !!plan.stoppedStep, (plan.results?.length || 0) + (plan.stoppedStep ? 1 : 0), user);
  async function control(kind: 'pause' | 'resume' | 'cancel') {
    if (!user || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/ai-assistant/workspace', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, planId: plan.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Controlul nu a fost confirmat.');
      onPlan(result.plan);
      if (kind === 'resume') onResume();
    } catch (error) { onError(error instanceof Error ? error.message : 'Controlul nu a fost confirmat.'); }
    finally { setBusy(false); }
  }
  const controllable = ['running', 'paused'].includes(plan.status) || plan.status === 'pending' && !!plan.results?.length;
  if (!controllable && !plan.results?.length && !plan.stoppedStep && !plan.goal?.coverageRequired) return null;
  return <div className="mt-3 space-y-2">
    {plan.goal?.coverageRequired && <details className="rounded-xl border p-3 text-sm" open={!plan.goal.coverage || plan.goal.coverage.requirements.some(row => ['unsupported', 'needs_clarification'].includes(row.resolution))}>
      <summary>Cerințele acoperite de plan</summary>
      {plan.goal.coverage ? <ul className="mt-2 list-disc space-y-1 pl-4">{plan.goal.coverage.requirements.map(row => <li key={row.id}>{row.description} · {row.resolution === 'planned' ? `Pașii ${row.steps.join(', ')}` : row.resolution === 'answered' ? 'Citire efectuată' : row.resolution === 'needs_clarification' ? 'Necesită clarificare' : 'Nesuportat de acest plan'}</li>)}</ul> : <p className="mt-2">Acoperirea întregii cereri nu a fost verificată. Confirmarea execută numai pașii enumerați.</p>}
    </details>}
    {(outcomes?.outcome || plan.outcome) && <p role="status" className="text-sm">{(outcomes?.outcome || plan.outcome).note}</p>}
    <p role="status" className="text-sm">{plan.results?.length || 0} / {plan.actions.length} pași confirmați{plan.status === 'paused' ? ' · În pauză' : ''}</p>
    <progress className="h-2 w-full accent-emerald-500" value={plan.results?.length || 0} max={plan.actions.length} aria-label="Progresul execuției" />
    <div className="flex flex-wrap gap-2">
      {controllable && <><Button type="button" size="sm" variant="outline" disabled={busy || (plan.status === 'paused' && resumeDisabled)} onClick={() => control(plan.status === 'paused' ? 'resume' : 'pause')}>{plan.status === 'paused' ? 'Reia planul' : 'Pune în pauză'}</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => control('cancel')}>Oprește pașii rămași</Button></>}
      {(!!plan.results?.length || !!plan.stoppedStep) && <Button type="button" size="sm" variant="outline" disabled={busy || refreshing} onClick={() => void refresh()}>Verifică rezultatele actuale</Button>}
    </div>
    {outcomes && <div className="grid gap-2" aria-live="polite">{outcomes.rows.map((row: any) => <div key={row.step} className="rounded-xl border bg-background p-3 text-sm"><strong>{row.title}</strong><p>{({ queued: 'În coadă', running: 'În procesare', succeeded: 'Finalizat', failed: 'Eșuat', cancelled: 'Anulat', draft: 'Pregătit', unknown: 'Rezultat incert', unavailable: 'Indisponibil', accepted_unverified: 'Acceptat, de verificat', observed: 'Stare observată' } as Record<string, string>)[row.executionState] || row.executionState}{row.businessStatus ? ` · ${row.businessStatus}` : ''}</p>{row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}</div>)}<p className="text-xs text-muted-foreground">{outcomes.note}</p></div>}
    {outcomes?.checkedAt && <p className="text-xs text-muted-foreground">Verificat la {new Date(outcomes.checkedAt).toLocaleTimeString('ro-RO')}{watching ? ' · Urmărire automată cât timp pagina este vizibilă' : ''}</p>}
    {outcomeError && <p role="status" className="text-xs text-amber-700">{outcomeError}</p>}
    {plan.status === 'running' && <p className="text-xs text-muted-foreground">Pauza sau oprirea se aplică după pasul deja pornit.</p>}
  </div>;
}
