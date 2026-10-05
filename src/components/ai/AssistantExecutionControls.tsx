'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AssistantPlan } from '@/lib/ai-assistant/contracts';

export function AssistantExecutionControls({ plan, user, onPlan, onResume, onError, resumeDisabled }: {
  plan: AssistantPlan; user: { getIdToken(): Promise<string> } | null;
  onPlan: (plan: AssistantPlan) => void; onResume: () => void; onError: (message: string) => void;
  resumeDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
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
  if (!['running', 'paused'].includes(plan.status) && !(plan.status === 'pending' && plan.results?.length)) return null;
  return <div className="mt-3 space-y-2">
    <p role="status" className="text-sm">{plan.results?.length || 0} / {plan.actions.length} pași confirmați{plan.status === 'paused' ? ' · În pauză' : ''}</p>
    <progress className="h-2 w-full accent-emerald-500" value={plan.results?.length || 0} max={plan.actions.length} aria-label="Progresul execuției" />
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy || (plan.status === 'paused' && resumeDisabled)} onClick={() => control(plan.status === 'paused' ? 'resume' : 'pause')}>{plan.status === 'paused' ? 'Reia planul' : 'Pune în pauză'}</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => control('cancel')}>Oprește pașii rămași</Button>
    </div>
    {plan.status === 'running' && <p className="text-xs text-muted-foreground">Pauza sau oprirea se aplică după pasul deja pornit.</p>}
  </div>;
}
