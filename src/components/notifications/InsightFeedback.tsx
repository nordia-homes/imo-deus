"use client";
import { useRef, useState } from 'react';
import { useUser } from '@/firebase';
import type { AppNotification } from '@/lib/notifications/types';

export function InsightFeedback({ item }: { item: AppNotification }) {
  const { user } = useUser();
  const [saved, setSaved] = useState<{ key: string; feedback: NonNullable<AppNotification['feedback']> } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const key = `${user?.uid}:${item.id}`;
  const feedback = saved?.key === key && saved.feedback.revision >= (item.feedback?.revision || 0) ? saved.feedback : item.feedback;
  const submit = async (value: 'useful' | 'not_useful') => {
    if (!user || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/notifications/feedback', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: item.id, value, expectedRevision: feedback?.revision || 0 }) });
      if (!response.ok) throw new Error(response.status === 409 ? 'Feedbackul s-a schimbat. Reîncarcă notificările.' : 'Feedbackul nu a putut fi confirmat. Poți reîncerca.');
      const result = await response.json();
      if (result.notificationId !== item.id || result.feedback?.value !== value || !Number.isSafeInteger(result.feedback?.revision) || result.feedback.revision < 1) throw new Error('Feedbackul nu a putut fi confirmat. Poți reîncerca.');
      setSaved({ key, feedback: result.feedback });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Feedbackul nu a putut fi confirmat.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const conditions = [item.insightCondition, item.matchingCondition, item.ownerWatchCondition].filter(condition => condition !== undefined);
  if (!user || item.recipientId !== user.uid || item.type !== 'ai_assistant' || conditions.length !== 1 || !conditions[0] || !item.automationId) return null;
  return <div className="px-3 py-2 text-xs" role="group" aria-label={`Feedback pentru ${item.title}`}>
    <div className="flex flex-wrap items-center gap-2"><span>A fost utilă alerta?</span>{(['useful', 'not_useful'] as const).map(value => <button key={value} type="button" disabled={busy || feedback?.value === value} aria-pressed={feedback?.value === value} onClick={() => void submit(value)} className="rounded-md border px-3 py-1.5 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:font-semibold disabled:opacity-60">{value === 'useful' ? 'Utilă' : 'Neutilă'}</button>)}<span role="status">{busy ? 'Se salvează…' : error ? '' : feedback ? 'Feedback salvat.' : ''}</span></div>
    <p className="mt-1 text-muted-foreground">{item.insightCondition ? 'Timp de 30 de zile, evaluarea poate departaja priorități cu aceeași urgență. Nu oprește alertele și nu reordonează incidentele urgente.' : 'Evaluarea este salvată pentru această alertă, în contul tău. Deocamdată nu schimbă ordinea rezultatelor sau frecvența alertelor.'}</p>
    {error && <p role="alert" className="mt-1 text-destructive">{error}</p>}
  </div>;
}
